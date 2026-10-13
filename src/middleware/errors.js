import mongoose from 'mongoose';

export function notFound(_req, res) {
  res.status(404).json({ message: 'Endpoint not found' });
}

export function errorHandler(error, _req, res, _next) {
  if (error instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ message: error.message });
  }
  if (error.code === 11000) {
    return res.status(409).json({ message: 'A record with this value already exists' });
  }
  if (error instanceof mongoose.Error.CastError) {
    return res.status(400).json({ message: 'Invalid resource identifier' });
  }
  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) console.error(error);
  res.status(status).json({ message: status >= 500 ? 'Something went wrong' : error.message });
}
