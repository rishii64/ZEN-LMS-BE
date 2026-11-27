export class AppError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Invalid request', details = null) {
    super(400, 'BAD_REQUEST', message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied', code = 'FORBIDDEN') {
    super(403, code, message);
  }
}

export class EntitlementError extends AppError {
  constructor(moduleKey) {
    super(403, 'ENTITLEMENT_REQUIRED', `Your organization subscription plan does not include the "${moduleKey}" module.`);
  }
}

export class QuotaExceededError extends AppError {
  constructor(message = 'Subscription quota exceeded') {
    super(403, 'QUOTA_EXCEEDED', message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(404, 'NOT_FOUND', `${resource} not found`);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(409, 'CONFLICT', message);
  }
}
