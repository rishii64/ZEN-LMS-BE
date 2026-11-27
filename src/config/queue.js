import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';
import { withPlatformContext } from '../db/pool.js';

let redisConnection = null;
const queues = new Map();

export function getRedisConnection() {
  if (!env.redisEnabled) return null;
  if (!redisConnection) {
    redisConnection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });
    redisConnection.on('error', (err) => {
      logger.warn({ err: err.message }, 'Redis connection warning');
    });
  }
  return redisConnection;
}

const inProcessHandlers = new Map();

export function registerJobHandler(jobType, handler) {
  inProcessHandlers.set(jobType, handler);
}

/**
 * Enqueues a background job idempotently into PostgreSQL background_job_records
 * and dispatches via BullMQ when Redis is enabled, or runs via async micro-queue fallback in dev.
 */
export async function enqueueJob({
  organizationId = null,
  queueName = 'lms-default',
  jobType,
  idempotencyKey = null,
  payload = {},
  createdByUserId = null
}) {
  const record = await withPlatformContext(async (client) => {
    if (idempotencyKey) {
      const existing = await client.query(
        `SELECT * FROM background_job_records WHERE idempotency_key = $1`,
        [idempotencyKey]
      );
      if (existing.rows[0]) {
        return { job: existing.rows[0], deduplicated: true };
      }
    }

    const { rows } = await client.query(
      `INSERT INTO background_job_records
       (organization_id, queue_name, job_type, idempotency_key, payload, status, created_by_user_id)
       VALUES ($1,$2,$3,$4,$5,'queued',$6)
       RETURNING *`,
      [organizationId, queueName, jobType, idempotencyKey, JSON.stringify(payload), createdByUserId]
    );
    return { job: rows[0], deduplicated: false };
  });

  if (record.deduplicated) {
    return record;
  }

  const conn = getRedisConnection();
  if (conn) {
    try {
      if (!queues.has(queueName)) {
        queues.set(queueName, new Queue(queueName, { connection: conn }));
      }
      await queues.get(queueName).add(jobType, { jobId: record.job.id, organizationId, payload });
      return record;
    } catch (err) {
      logger.warn({ err: err.message }, 'BullMQ enqueue failed, falling back to local processor');
    }
  }

  // Local async execution fallback when Redis is disabled (preserves job record lifecycle)
  const handler = inProcessHandlers.get(jobType);
  if (handler && !env.isTest) {
    setImmediate(() => {
      executeJobRecord(record.job.id, handler).catch((e) =>
        logger.error({ err: e.message, jobId: record.job.id }, 'In-process job failed')
      );
    });
  }

  return record;
}

export async function executeJobRecord(jobId, handler) {
  const job = await withPlatformContext(async (client) => {
    const { rows } = await client.query(
      `UPDATE background_job_records
       SET status = 'running', attempts = attempts + 1, started_at = NOW()
       WHERE id = $1 AND status IN ('queued', 'failed')
       RETURNING *`,
      [jobId]
    );
    return rows[0] || null;
  });

  if (!job) return null;

  try {
    const result = await handler(job);
    return await withPlatformContext(async (client) => {
      const { rows } = await client.query(
        `UPDATE background_job_records
         SET status = 'completed', result = $2, completed_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [jobId, JSON.stringify(result || {})]
      );
      return rows[0];
    });
  } catch (err) {
    await withPlatformContext(async (client) => {
      await client.query(
        `UPDATE background_job_records
         SET status = 'failed', error_message = $2
         WHERE id = $1`,
        [jobId, err.message]
      );
    });
    throw err;
  }
}
