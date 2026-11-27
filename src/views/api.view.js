/**
 * API View / Presenter Layer
 * Standardizes outbound JSON serialization and envelopes.
 */

export class ApiView {
  static success(res, data, meta = null, statusCode = 200) {
    const payload = { success: true, data };
    if (meta) payload.meta = meta;
    return res.status(statusCode).json(payload);
  }

  static created(res, data, meta = null) {
    return ApiView.success(res, data, meta, 201);
  }

  static paginated(res, items, total, page, limit, additionalMeta = {}) {
    return res.status(200).json({
      success: true,
      data: items,
      meta: {
        page: Number(page) || 1,
        limit: Number(limit) || 20,
        total: Number(total) || items.length,
        totalPages: Math.ceil((Number(total) || items.length) / (Number(limit) || 20)),
        ...additionalMeta
      }
    });
  }

  static error(res, message, code = 'ERROR', statusCode = 400, details = null) {
    const payload = {
      success: false,
      error: {
        code,
        message
      }
    };
    if (details) payload.error.details = details;
    return res.status(statusCode).json(payload);
  }
}
