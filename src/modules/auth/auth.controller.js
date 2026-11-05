const authService = require('./auth.service');
const asyncHandler = require('../../utils/async-handler');
const env = require('../../config/env');

const REFRESH_COOKIE_NAME = 'worksphereRefreshToken';
const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.cookieSameSite,
  path: '/api/v1/auth',
  maxAge: env.refreshTokenTtlDays * 24 * 60 * 60 * 1000
});

function clearRefreshCookie(res) {
  const options = refreshCookieOptions();
  delete options.maxAge;
  res.clearCookie(REFRESH_COOKIE_NAME, options);
}

function sessionPayload(session) {
  return {
    accessToken: session.accessToken,
    tokenType: 'Bearer',
    accessTokenExpiresIn: env.accessTokenTtl,
    user: serializeUser(session.user)
  };
}

function serializeUser(user) {
  if (typeof user.toJSON === 'function') return user.toJSON();
  const safeUser = { ...user };
  delete safeUser.passwordHash;
  delete safeUser.emailVerificationTokenHash;
  delete safeUser.emailVerificationExpiresAt;
  delete safeUser.passwordResetTokenHash;
  delete safeUser.passwordResetExpiresAt;
  return safeUser;
}

const register = asyncHandler(async (req, res) => {
  const user = await authService.register(req.validated.body);
  res.status(201).json({
    success: true,
    message: 'Registration successful. Check your email to verify your account.',
    data: { user: serializeUser(user), emailVerificationRequired: true },
    requestId: req.id
  });
});

const login = asyncHandler(async (req, res) => {
  const session = await authService.login(req.validated.body);
  res.cookie(REFRESH_COOKIE_NAME, session.refreshToken, refreshCookieOptions());
  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: sessionPayload(session),
    requestId: req.id
  });
});

const resendVerification = asyncHandler(async (req, res) => {
  await authService.resendVerification(req.validated.body.email);
  res.status(200).json({
    success: true,
    message: 'If the account exists and needs verification, instructions have been sent',
    data: null,
    requestId: req.id
  });
});

const verifyEmail = asyncHandler(async (req, res) => {
  const session = await authService.verifyEmail(req.validated.body.token);
  res.cookie(REFRESH_COOKIE_NAME, session.refreshToken, refreshCookieOptions());
  res.status(200).json({
    success: true,
    message: 'Email verified successfully',
    data: sessionPayload(session),
    requestId: req.id
  });
});

const refresh = asyncHandler(async (req, res) => {
  const session = await authService.refresh(req.cookies?.[REFRESH_COOKIE_NAME]);
  res.cookie(REFRESH_COOKIE_NAME, session.refreshToken, refreshCookieOptions());
  res.status(200).json({
    success: true,
    message: 'Token refreshed successfully',
    data: sessionPayload(session),
    requestId: req.id
  });
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.cookies?.[REFRESH_COOKIE_NAME]);
  clearRefreshCookie(res);
  res.status(200).json({ success: true, message: 'Logged out successfully', data: null, requestId: req.id });
});

const logoutAll = asyncHandler(async (req, res) => {
  const revokedSessions = await authService.logoutAll(req.auth.userId);
  clearRefreshCookie(res);
  res.status(200).json({
    success: true,
    message: 'Logged out from all devices successfully',
    data: { revokedSessions },
    requestId: req.id
  });
});

const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.validated.body.email);
  res.status(200).json({
    success: true,
    message: 'If an account exists for that email, password reset instructions have been sent',
    data: null,
    requestId: req.id
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.validated.body);
  clearRefreshCookie(res);
  res.status(200).json({ success: true, message: 'Password reset successfully', data: null, requestId: req.id });
});

module.exports = {
  register,
  login,
  resendVerification,
  verifyEmail,
  refresh,
  logout,
  logoutAll,
  forgotPassword,
  resetPassword,
  REFRESH_COOKIE_NAME,
  refreshCookieOptions
};
