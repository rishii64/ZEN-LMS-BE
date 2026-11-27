import { withPlatformContext } from '../db/pool.js';

export async function recordAudit({
  organizationId = null,
  actorUserId = null,
  actorEmail = null,
  action,
  resourceType,
  resourceId = null,
  requestId = null,
  ipAddress = null,
  userAgent = null,
  details = {}
}) {
  await withPlatformContext(async (client) => {
    await client.query(
      `INSERT INTO audit_logs
       (organization_id, actor_user_id, actor_email, action, resource_type, resource_id, request_id, ip_address, user_agent, details)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        organizationId,
        actorUserId,
        actorEmail,
        action,
        resourceType,
        resourceId ? String(resourceId) : null,
        requestId,
        ipAddress,
        userAgent,
        JSON.stringify(details || {})
      ]
    );
  });
}

export function auditFromReq(req, action, resourceType, resourceId = null, details = {}) {
  return recordAudit({
    organizationId: req.organizationId || null,
    actorUserId: req.user?.id || null,
    actorEmail: req.user?.email || null,
    action,
    resourceType,
    resourceId,
    requestId: req.requestId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] || null,
    details
  });
}
