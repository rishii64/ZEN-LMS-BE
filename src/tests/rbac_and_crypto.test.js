import { describe, expect, it } from 'vitest';
import { computeEffectivePermissions } from '../middleware/tenant.js';
import { generateTotpCode, generateTotpSecret, signDownloadToken, verifyDownloadToken, verifyTotpCode } from '../utils/crypto.js';

describe('Dynamic RBAC Permission Combination & Security Primitives', () => {
  it('combines multiple roles using widest scope and enforces explicit deny', () => {
    const effective = computeEffectivePermissions([
      { module: 'courses', action: 'view', scope: 'self', allow: true, scope_entity_type: null, scope_entity_id: null },
      { module: 'courses', action: 'view', scope: 'department', allow: true, scope_entity_type: 'department', scope_entity_id: 'dept-1' },
      { module: 'courses', action: 'edit', scope: 'course', allow: true, scope_entity_type: 'course', scope_entity_id: 'course-1' },
      { module: 'courses', action: 'delete', scope: 'organization', allow: true },
      { module: 'courses', action: 'delete', scope: 'organization', allow: false }
    ]);

    expect(effective['courses:view'].scope).toBe('department');
    expect(effective['courses:view'].scopeEntities.department).toEqual(['dept-1']);
    expect(effective['courses:edit'].scopeEntities.course).toEqual(['course-1']);
    expect(effective['courses:delete']).toBeUndefined();
  });

  it('generates and verifies RFC-6238 TOTP MFA codes', () => {
    const secret = generateTotpSecret();
    const code = generateTotpCode(secret);
    expect(code).toMatch(/^\d{6}$/);
    expect(verifyTotpCode(secret, code)).toBe(true);
    expect(verifyTotpCode(secret, '000000')).toBe(false);
  });

  it('signs and verifies short-lived download URLs and rejects tampered tokens', () => {
    const token = signDownloadToken({ orgId: 'org-1', assetId: 'asset-1', key: 'org-1/doc.pdf' }, 60);
    const decoded = verifyDownloadToken(token);
    expect(decoded.orgId).toBe('org-1');
    expect(verifyDownloadToken(`${token}tamper`)).toBeNull();
  });
});
