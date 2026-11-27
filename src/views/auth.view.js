/**
 * Auth View Serializer
 */

export class AuthView {
  static formatLoginResponse({ user, session, accessToken, refreshToken, activeMembership, memberships = [] }) {
    return {
      message: 'Authentication successful',
      accessToken,
      refreshToken,
      sessionId: session.id,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        fullName: user.full_name,
        avatarUrl: user.avatar_url,
        isPlatformAdmin: user.is_platform_admin,
        platformRole: user.platform_role,
        mfaEnabled: user.mfa_enabled,
        emailVerified: Boolean(user.email_verified_at)
      },
      activeOrganization: activeMembership ? {
        id: activeMembership.organization_id,
        slug: activeMembership.org_slug || activeMembership.organization?.slug,
        name: activeMembership.org_name || activeMembership.organization?.name,
        logoUrl: activeMembership.logo_url || activeMembership.organization?.settings?.logo_url,
        isOrgAdmin: activeMembership.is_org_admin
      } : null,
      memberships: memberships.map((m) => ({
        organizationId: m.organization_id,
        slug: m.org_slug || m.organization?.slug,
        name: m.org_name || m.organization?.name,
        isOrgAdmin: m.is_org_admin,
        jobTitle: m.job_title
      }))
    };
  }

  static formatUserMe({ user, memberships = [], activeMembership = null, activeOrganization = null }) {
    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        fullName: user.fullName || user.full_name,
        avatarUrl: user.avatarUrl || user.avatar_url,
        isPlatformAdmin: user.isPlatformAdmin || user.is_platform_admin,
        platformRole: user.platformRole || user.platform_role,
        mfaEnabled: user.mfaEnabled || user.mfa_enabled,
        emailVerified: user.emailVerified ?? Boolean(user.email_verified_at)
      },
      activeOrganization: activeOrganization || (activeMembership ? {
        id: activeMembership.organization_id,
        slug: activeMembership.org_slug || activeMembership.organization?.slug,
        name: activeMembership.org_name || activeMembership.organization?.name,
        isOrgAdmin: activeMembership.is_org_admin
      } : null),
      memberships: memberships.map((m) => ({
        organizationId: m.organization_id,
        slug: m.org_slug || m.organization?.slug,
        name: m.org_name || m.organization?.name,
        isOrgAdmin: m.is_org_admin,
        status: m.status
      }))
    };
  }
}
