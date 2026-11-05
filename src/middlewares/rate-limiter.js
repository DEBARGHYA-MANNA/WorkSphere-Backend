const rateLimit = require('express-rate-limit');

const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler(req, res) {
    res.status(429).json({
      success: false,
      message: 'Too many requests; please try again later',
      error: { code: 'RATE_LIMITED' },
      requestId: req.id
    });
  }
});

module.exports = apiRateLimiter;
