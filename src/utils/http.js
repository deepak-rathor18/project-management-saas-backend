export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

export function requireFields(body, fields) {
  for (const field of fields) {
    if (!body || typeof body[field] !== 'string' || !body[field].trim()) {
      throw new HttpError(400, `${field} is required`);
    }
  }
}

export function validateStringFields(body, fields) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object');
  }
  for (const field of fields) {
    if (field in body && typeof body[field] !== 'string') {
      throw new HttpError(400, `${field} must be text`);
    }
  }
}
