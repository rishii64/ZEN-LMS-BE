import {
  IntegrationConnection,
  WebhookDelivery,
  withTenantContext
} from '../models/index.js';
import { EntitlementError } from '../utils/errors.js';
import { auditFromReq } from '../services/audit.service.js';

export class IntegrationController {
  static async listIntegrations(req, res, next) {
    try {
      const data = await withTenantContext(req.organizationId, async (t) => {
        const [connections, deliveries] = await Promise.all([
          IntegrationConnection.findAll({
            where: { organization_id: req.organizationId },
            order: [['created_at', 'DESC']],
            transaction: t
          }),
          WebhookDelivery.findAll({
            where: { organization_id: req.organizationId },
            order: [['created_at', 'DESC']],
            limit: 30,
            transaction: t
          })
        ]);
        return { connections, deliveries };
      });
      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async createIntegration(req, res, next) {
    try {
      const b = req.body;
      if ((b.provider === 'oidc' || b.provider === 'saml') && req.entitlements?.modules?.sso !== true) {
        throw new EntitlementError('sso');
      }

      const row = await withTenantContext(req.organizationId, async (t) => {
        return IntegrationConnection.create(
          {
            organization_id: req.organizationId,
            provider: b.provider,
            name: b.name,
            config: b.config || {}
          },
          { transaction: t }
        );
      });

      await auditFromReq(req, 'integration.created', 'integration', row.id, { provider: b.provider });
      return res.status(201).json({ data: row });
    } catch (err) {
      next(err);
    }
  }
}
