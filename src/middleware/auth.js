import { withPlatformContext } from '../db/pool.js';
import { verifyAccessToken } from '../utils/crypto.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!token) {
      throw new UnauthorizedError('Missing Bearer access token');
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      throw new UnauthorizedError('Invalid or expired access token');
    }

    const sessionRow = await withPlatformContext(async (client) => {
      const { rows } = await client.query(
        `SELECT s.id AS session_id, s.active_organization_id, s.revoked_at, s.expires_at,
                u.id, u.email, u.phone, u.full_name, u.avatar_url,
                u.is_platform_admin, u.platform_role, u.is_active, u.mfa_enabled,
                u.email_verified_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.id = $1 AND u.id = $2`,
        [decoded.sid, decoded.sub]
      );
      return rows[0] || null;
    });

    if (!sessionRow || sessionRow.revoked_at || new Date(sessionRow.expires_at) < new Date()) {
      throw new UnauthorizedError('Session is invalid or revoked');
    }
    if (!sessionRow.is_active) {
      throw new ForbiddenError('User account is deactivated', 'ACCOUNT_DEACTIVATED');
    }

    req.user = {
      id: sessionRow.id,
      email: sessionRow.email,
      phone: sessionRow.phone,
      fullName: sessionRow.full_name,
      avatarUrl: sessionRow.avatar_url,
      isPlatformAdmin: sessionRow.is_platform_admin,
      platformRole: sessionRow.platform_role,
      mfaEnabled: sessionRow.mfa_enabled,
      emailVerified: Boolean(sessionRow.email_verified_at),
      activeOrganizationId: sessionRow.active_organization_id
    };
    req.sessionId = sessionRow.session_id;
    next();
  } catch (err) {
    next(err);
  }
}

export function requirePlatformAdmin(req, _res, next) {
  if (!req.user?.isPlatformAdmin) {
    return next(new ForbiddenError('Platform Super Admin privileges required'));
  }
  return next();
}
