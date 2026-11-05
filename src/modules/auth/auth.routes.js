const express = require('express');
const rateLimit = require('express-rate-limit');
const validate = require('../../middlewares/validate');
const authenticate = require('../../middlewares/authenticate');
const controller = require('./auth.controller');
const validation = require('./auth.validation');

const router = express.Router();
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler(req, res) {
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts; please try again later',
      error: { code: 'RATE_LIMITED' },
      requestId: req.id
    });
  }
});

router.use(authRateLimiter);
router.post('/register', validate(validation.registerSchema), controller.register);
router.post('/login', validate(validation.loginSchema), controller.login);
router.post('/resend-verification', validate(validation.forgotPasswordSchema), controller.resendVerification);
router.post('/verify-email', validate(validation.verifyEmailSchema), controller.verifyEmail);
router.post('/refresh', controller.refresh);
router.post('/logout', controller.logout);
router.post('/logout-all', authenticate, controller.logoutAll);
router.post('/forgot-password', validate(validation.forgotPasswordSchema), controller.forgotPassword);
router.post('/reset-password', validate(validation.resetPasswordSchema), controller.resetPassword);

module.exports = router;
