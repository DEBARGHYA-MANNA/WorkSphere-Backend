const userService = require('./user.service');
const asyncHandler = require('../../utils/async-handler');
const { clearRefreshCookie } = require('../auth/auth.cookies');

function serializeUser(user) {
  return typeof user.toJSON === 'function' ? user.toJSON() : user;
}

const getMe = asyncHandler(async (req, res) => {
  const user = await userService.getProfile(req.auth.userId);
  res.status(200).json({
    success: true,
    message: 'User profile retrieved successfully',
    data: { user: serializeUser(user) },
    requestId: req.id
  });
});

const getById = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.validated.params.userId, req.auth.userId);
  res.status(200).json({
    success: true,
    message: 'User retrieved successfully',
    data: { user: serializeUser(user) },
    requestId: req.id
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  const result = await userService.updateProfile(req.auth.userId, req.validated.body);
  if (result.emailVerificationRequired) clearRefreshCookie(res);
  res.status(200).json({
    success: true,
    message: result.emailVerificationRequired
      ? 'Profile updated. Verify the new email address before signing in again.'
      : 'Profile updated successfully',
    data: { user: serializeUser(result.user), emailVerificationRequired: result.emailVerificationRequired },
    requestId: req.id
  });
});

const changePassword = asyncHandler(async (req, res) => {
  await userService.changePassword(req.auth.userId, req.validated.body);
  clearRefreshCookie(res);
  res.status(200).json({
    success: true,
    message: 'Password changed successfully. Sign in again on your devices.',
    data: null,
    requestId: req.id
  });
});

const deactivateAccount = asyncHandler(async (req, res) => {
  await userService.deactivateAccount(req.auth.userId, req.validated.body);
  clearRefreshCookie(res);
  res.status(200).json({
    success: true,
    message: 'Account deactivated successfully',
    data: null,
    requestId: req.id
  });
});

module.exports = { getMe, getById, updateProfile, changePassword, deactivateAccount };
