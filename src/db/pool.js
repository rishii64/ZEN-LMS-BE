import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Executes queries inside a transaction with strict PostgreSQL RLS tenant context.
 * Never trusts client-supplied organization_id directly; receives verified orgId from session/membership.
 */
export async function withTenantContext(organizationId, fn) {
  if (!organizationId) {
    throw new Error('organizationId is required for tenant database context');
  }
  return withTransaction(async (client) => {
    if (env.enforceAppRole) {
      await client.query('SET LOCAL ROLE lms_app_user');
    }
    await client.query("SELECT set_config('app.is_platform_admin', 'false', true)");
    await client.query("SELECT set_config('app.current_organization_id', $1, true)", [String(organizationId)]);
    return fn(client);
  });
}

/**
 * Executes queries inside a transaction with Platform Super Admin RLS context.
 */
export async function withPlatformContext(fn) {
  return withTransaction(async (client) => {
    await client.query("SELECT set_config('app.is_platform_admin', 'true', true)");
    await client.query("SELECT set_config('app.current_organization_id', '', true)");
    return fn(client);
  });
}

export async function query(text, params = []) {
  return pool.query(text, params);
}
