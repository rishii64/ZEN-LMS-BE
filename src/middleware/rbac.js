import { EntitlementError, ForbiddenError } from '../utils/errors.js';

// Modules gated by subscription plan entitlements
export const ENTITLEMENT_MODULE_MAP = {
  certificates: 'certificates',
  compliance: 'compliance',
  reports: 'reports',
  workflows: 'workflows',
  integrations: 'integrations',
  sso: 'sso',
  custom_branding: 'custom_branding',
  live_sessions: 'live_sessions',
  gamification: 'gamification',
  analytics_advanced: 'analytics_advanced'
};

export function requireEntitlement(entitlementKey) {
  return (req, _res, next) => {
    const enabled = req.entitlements?.modules?.[entitlementKey];
    if (enabled === false || enabled === undefined) {
      return next(new EntitlementError(entitlementKey));
    }
    return next();
  };
}

/**
 * Enforces subscription entitlement (when gated) AND dynamic RBAC permission.
 * Note: Subscription upgrades never bypass RBAC; isOrgAdmin grants organization-wide RBAC within entitled modules.
 */
export function requirePermission(module, action, options = {}) {
  const { entitlementKey = ENTITLEMENT_MODULE_MAP[module] || null, allowReadOnlyOnPastDue = true } = options;

  return (req, _res, next) => {
    if (!req.membership || !req.organizationId) {
      return next(new ForbiddenError('Tenant context required'));
    }

    // Check subscription status for write operations
    const subStatus = req.subscription?.status;
    if (subStatus && ['suspended', 'cancelled', 'expired'].includes(subStatus)) {
      const isBillingRoute = req.baseUrl?.includes('/billing') || req.baseUrl?.includes('/subscriptions');
      if (!isBillingRoute && (!allowReadOnlyOnPastDue || req.method !== 'GET')) {
        return next(new ForbiddenError(`Subscription is ${subStatus}. Please renew to continue.`, 'SUBSCRIPTION_INACTIVE'));
      }
    }

    // 1. Subscription Entitlement Check (independent from RBAC)
    if (entitlementKey) {
      const isEntitled = req.entitlements?.modules?.[entitlementKey];
      if (isEntitled !== true) {
        return next(new EntitlementError(entitlementKey));
      }
    }

    // 2. Tenant Admin RBAC check
    if (req.membership.is_org_admin) {
      req.permissionScope = {
        module,
        action,
        scope: 'organization',
        rank: 6,
        scopeEntities: { department: [], branch: [], course: [], group: [] }
      };
      return next();
    }

    // 3. Dynamic RBAC permission check (explicit action or module:manage)
    const direct = req.effectivePermissions?.[`${module}:${action}`];
    const manage = req.effectivePermissions?.[`${module}:manage`];
    const chosen = direct && manage ? (direct.rank >= manage.rank ? direct : manage) : (direct || manage);

    if (!chosen) {
      return next(new ForbiddenError(`Missing required permission: ${module}:${action}`));
    }

    req.permissionScope = chosen;
    return next();
  };
}
