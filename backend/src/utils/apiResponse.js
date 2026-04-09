function sendSuccess(res, { statusCode = 200, message = 'Success', data = null, meta } = {}) {
  const timestamp = new Date().toISOString();
  const payload = {
    success: true,
    message,
    data,
    timestamp
  };

  if (meta) {
    payload.meta = {
      lastUpdated: meta.lastUpdated || timestamp,
      ...meta
    };
  }

  return res.status(statusCode).json(payload);
}

module.exports = {
  sendSuccess
};
