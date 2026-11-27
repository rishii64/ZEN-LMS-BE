import { logger } from '../config/logger.js';
import { AppError } from '../utils/errors.js';

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`,
      requestId: req.requestId
    }
  });
}

export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId: req.requestId
      }
    });
  }

  // Handle PostgreSQL constraint errors cleanly
  if (err?.code === '23505') {
    return res.status(409).json({
      error: {
        code: 'UNIQUE_VIOLATION',
        message: 'A record with this unique value already exists.',
        requestId: req.requestId
      }
    });
  }
  if (err?.code === '23503') {
    return res.status(400).json({
      error: {
        code: 'FOREIGN_KEY_VIOLATION',
        message: 'Referenced record does not exist or belongs to a different organization.',
        requestId: req.requestId
      }
    });
  }
  if (err?.code === '42501') {
    return res.status(403).json({
      error: {
        code: 'TENANT_ISOLATION_VIOLATION',
        message: 'Cross-tenant access denied by database policy.',
        requestId: req.requestId
      }
    });
  }

  logger.error({ err, requestId: req.requestId, path: req.originalUrl }, 'Unhandled error');
  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
      requestId: req.requestId
    }
  });
}
