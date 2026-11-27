import { AuditLog, withTenantContext } from '../models/index.js';
import { parsePagination, paginatedResponse } from '../utils/pagination.js';

export class AuditController {
  static async listLogs(req, res, next) {
    try {
      const pg = parsePagination(req.query);
      const data = await withTenantContext(req.organizationId, async (t) => {
        const { count, rows } = await AuditLog.findAndCountAll({
          where: { organization_id: req.organizationId },
          limit: pg.limit,
          offset: pg.offset,
          order: [['created_at', 'DESC']],
          transaction: t
        });
        return paginatedResponse(rows, count, pg);
      });
      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }
}
