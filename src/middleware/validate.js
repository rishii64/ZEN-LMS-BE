import { BadRequestError } from '../utils/errors.js';

export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(new BadRequestError('Validation failed', result.error.flatten().fieldErrors));
    }
    req[source] = result.data;
    return next();
  };
}
