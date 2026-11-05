const mongoose = require('mongoose');
const AppError = require('../utils/app-error');
const asyncHandler = require('../utils/async-handler');
const { verifyAccessToken } = require('../utils/auth-crypto');
const User = require('../modules/users/user.model');
const RefreshToken = require('../modules/auth/refresh-token.model');
const env = require('../config/env');

const authenticate = asyncHandler(async (req, res, next) => {
  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');

  let claims;
  try {
    claims = verifyAccessToken(match[1]);
  } catch (_error) {
    throw new AppError('Access token is invalid or expired', 401, 'INVALID_ACCESS_TOKEN');
  }

  if (!claims.sub || !claims.sid) {
    throw new AppError('Access token is invalid or expired', 401, 'INVALID_ACCESS_TOKEN');
  }

  const [user, activeSession] = await Promise.all([
    User.findById(claims.sub).select('_id name email emailVerified status'),
    RefreshToken.exists({ sessionId: claims.sid, revokedAt: null, expiresAt: mongoose.trusted({ $gt: new Date() }) })
  ]);

  if (!user || user.status !== 'active' || (env.emailVerificationEnabled && !user.emailVerified) || !activeSession) {
    throw new AppError('Access token is invalid or expired', 401, 'INVALID_ACCESS_TOKEN');
  }

  req.user = user;
  req.auth = { userId: String(user._id), sessionId: claims.sid };
  return next();
});

module.exports = authenticate;
