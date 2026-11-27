import { withPlatformContext, withTenantContext } from '../db/pool.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

const SCOPE_RANK = {
  self: 1,
  group: 2,
  course: 3,
  branch: 4,
  department: 5,
  organization: 6,
  platform: 7
};

export function computeEffectivePermissions(rows) {
  const map = {};
  const denied = new Set();

  for (const row of rows) {
    const key = `${row.module}:${row.action}`;
    if (row.allow === false) {
      denied.add(key);
      delete map[key];
      continue;
    }
    if (denied.has(key)) continue;

    const rank = SCOPE_RANK[row.scope] || 1;
    if (!map[key]) {
      map[key] = {
        module: row.module,
        action: row.action,
        scope: row.scope,
        rank,
        scopeEntities: {
          department: [],
          branch: [],
          course: [],
          group: []
        }
      };
    } else if (rank > map[key].rank) {
      map[key].scope = row.scope;
      map[key].rank = rank;
    }

    if (row.scope_entity_type && row.scope_entity_id && map[key].scopeEntities[row.scope_entity_type]) {
      if (!map[key].scopeEntities[row.scope_entity_type].includes(row.scope_entity_id)) {
        map[key].scopeEntities[row.scope_entity_type].push(row.scope_entity_id);
      }
    }
  }
  return map;
}

export async function resolveTenant(req, _res, next) {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const headerOrgId = req.headers['x-organization-id'];
    const orgId = (typeof headerOrgId === 'string' && headerOrgId.trim()) || req.user.activeOrganizationId;

    if (!orgId) {
      throw new ForbiddenError('No active organization selected for this session', 'NO_ACTIVE_ORGANIZATION');
    }

    // Validate UUID shape to prevent SQL cast errors on tampered headers
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orgId)) {
      throw new ForbiddenError('Invalid organization identifier', 'INVALID_ORGANIZATION');
    }

    const context = await withPlatformContext(async (client) => {
      const orgRes = await client.query(
        `SELECT o.*, s.logo_url, s.primary_color, s.secondary_color, s.default_language,
                s.timezone, s.date_format, s.time_format, s.terminology, s.completion_policy,
                s.security_policy, s.dashboard_layout, s.retention_policy
         FROM organizations o
         LEFT JOIN organization_settings s ON s.organization_id = o.id
         WHERE o.id = $1`,
        [orgId]
      );
      const org = orgRes.rows[0];
      if (!org) return null;

      const memRes = await client.query(
        `SELECT * FROM organization_memberships
         WHERE organization_id = $1 AND user_id = $2`,
        [orgId, req.user.id]
      );
      const membership = memRes.rows[0];
      if (!membership || membership.status !== 'active') {
        return { org, membership: null };
      }

      const subRes = await client.query(
        `SELECT os.*, sp.code AS plan_code, sp.name AS plan_name,
                sp.max_users AS plan_max_users, sp.max_courses AS plan_max_courses,
                sp.max_storage_bytes AS plan_max_storage_bytes, sp.max_custom_roles AS plan_max_custom_roles
         FROM organization_subscriptions os
         JOIN subscription_plans sp ON sp.id = os.plan_id
         WHERE os.organization_id = $1
         ORDER BY os.created_at DESC
         LIMIT 1`,
        [orgId]
      );
      const subscription = subRes.rows[0] || null;

      const modRes = await client.query(
        `SELECT module_key, is_enabled, config FROM organization_modules WHERE organization_id = $1`,
        [orgId]
      );

      let planFeatures = [];
      if (subscription) {
        const pfRes = await client.query(
          `SELECT module_key, is_enabled, limit_value FROM plan_features WHERE plan_id = $1`,
          [subscription.plan_id]
        );
        planFeatures = pfRes.rows;
      }

      return { org, membership, subscription, orgModules: modRes.rows, planFeatures };
    });

    if (!context || !context.org) {
      throw new ForbiddenError('Organization access denied', 'TENANT_ACCESS_DENIED');
    }

    if (!context.membership) {
      throw new ForbiddenError('You do not have an active membership in this organization', 'TENANT_ACCESS_DENIED');
    }

    if (context.org.status !== 'active') {
      throw new ForbiddenError(`Organization is currently ${context.org.status}`, 'ORGANIZATION_INACTIVE');
    }

    const permRows = await withTenantContext(orgId, async (client) => {
      const { rows } = await client.query(
        `SELECT p.module, p.action, rp.scope, rp.allow, mr.scope_entity_type, mr.scope_entity_id
         FROM membership_roles mr
         JOIN roles r ON r.id = mr.role_id AND r.organization_id = mr.organization_id
         JOIN role_permissions rp ON rp.role_id = r.id
         JOIN permissions p ON p.id = rp.permission_id
         WHERE mr.organization_id = $1
           AND mr.membership_id = $2
           AND r.is_active = TRUE`,
        [orgId, context.membership.id]
      );
      return rows;
    });

    const modulesMap = {};
    for (const pf of context.planFeatures) {
      modulesMap[pf.module_key] = pf.is_enabled;
    }
    for (const om of context.orgModules) {
      modulesMap[om.module_key] = om.is_enabled;
    }

    const sub = context.subscription;
    req.organization = context.org;
    req.organizationId = context.org.id;
    req.membership = context.membership;
    req.subscription = sub;
    req.entitlements = {
      modules: modulesMap,
      limits: {
        maxUsers: sub?.custom_max_users ?? sub?.plan_max_users ?? 50,
        maxCourses: sub?.custom_max_courses ?? sub?.plan_max_courses ?? 25,
        maxStorageBytes: Number(sub?.custom_max_storage_bytes ?? sub?.plan_max_storage_bytes ?? 5368709120),
        maxCustomRoles: sub?.plan_max_custom_roles ?? 10
      }
    };
    req.effectivePermissions = computeEffectivePermissions(permRows);
    next();
  } catch (err) {
    next(err);
  }
}
