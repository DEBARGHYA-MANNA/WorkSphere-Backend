const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const AppError = require('../../utils/app-error');
const User = require('../users/user.model');
const RefreshToken = require('./refresh-token.model');
const mailer = require('../../services/mailer');
const env = require('../../config/env');
const authCrypto = require('../../utils/auth-crypto');
const logger = require('../../logger');

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const TOKEN_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

async function deliverEmailSafely(send) {
  try {
    await send();
  } catch (_error) {
    // Do not make account-existence or provider failures observable through auth responses.
    logger.error('Authentication email delivery failed');
  }
}

function createAuthService({
  UserModel = User,
  RefreshTokenModel = RefreshToken,
  mail = mailer,
  crypto = authCrypto,
  config = env,
  clock = () => new Date()
} = {}) {
  let dummyPasswordHashPromise;

  function makeTokenRecord({ tokenHash, userId, sessionId, familyId, expiresAt }) {
    return new RefreshTokenModel({
      tokenHash,
      userId,
      sessionId,
      familyId,
      expiresAt,
      purgeAt: new Date(expiresAt.getTime() + TOKEN_RETENTION_MS)
    });
  }

  async function issueSession(user) {
    const sessionId = randomUUID();
    const rawRefreshToken = crypto.createOpaqueToken();
    const now = clock();
    const expiresAt = new Date(now.getTime() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000);

    await makeTokenRecord({
      tokenHash: crypto.hashToken(rawRefreshToken),
      userId: user._id,
      sessionId,
      familyId: sessionId,
      expiresAt
    }).save();

    return {
      accessToken: crypto.createAccessToken(user._id, sessionId),
      refreshToken: rawRefreshToken,
      expiresAt,
      sessionId,
      user
    };
  }

  async function register({ name, email, password }) {
    const verificationToken = crypto.createOpaqueToken(32);
    const now = clock();
    try {
      const user = new UserModel({
        name,
        email: email.toLowerCase(),
        passwordHash: password,
        emailVerified: false,
        status: 'active',
        emailVerificationTokenHash: crypto.hashToken(verificationToken),
        emailVerificationExpiresAt: new Date(now.getTime() + VERIFICATION_TOKEN_TTL_MS)
      });
      await user.save();
      await deliverEmailSafely(() => mail.sendVerificationEmail({ to: user.email, token: verificationToken }));
      return user;
    } catch (error) {
      if (error.code === 11000) {
        throw new AppError('An account with this email already exists', 409, 'EMAIL_ALREADY_EXISTS');
      }
      throw error;
    }
  }

  async function resendVerification(email) {
    const user = await UserModel.findOne({ email: email.toLowerCase() });
    if (!user || user.emailVerified || user.status !== 'active') return;

    const token = crypto.createOpaqueToken(32);
    user.emailVerificationTokenHash = crypto.hashToken(token);
    user.emailVerificationExpiresAt = new Date(clock().getTime() + VERIFICATION_TOKEN_TTL_MS);
    await user.save();
    await deliverEmailSafely(() => mail.sendVerificationEmail({ to: user.email, token }));
  }

  async function verifyEmail(token) {
    const user = await UserModel.findOneAndUpdate({
      emailVerificationTokenHash: crypto.hashToken(token),
      emailVerificationExpiresAt: mongoose.trusted({ $gt: clock() }),
      emailVerified: false,
      status: 'active'
    }, {
      $set: {
        emailVerified: true,
        emailVerifiedAt: clock(),
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null
      }
    }, { new: true, runValidators: true });

    if (!user) throw new AppError('Verification token is invalid or expired', 400, 'INVALID_VERIFICATION_TOKEN');
    return issueSession(user);
  }

  async function login({ email, password }) {
    const user = await UserModel.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    if (!user && !dummyPasswordHashPromise) {
      dummyPasswordHashPromise = crypto.hashPassword(crypto.createOpaqueToken());
    }
    const passwordHash = user ? user.passwordHash : await dummyPasswordHashPromise;
    const passwordMatches = await crypto.verifyPassword(password, passwordHash);
    if (!user || !passwordMatches || !user.emailVerified || user.status !== 'active') {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }
    return issueSession(user);
  }

  async function refresh(rawToken) {
    if (!rawToken) throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
    const tokenHash = crypto.hashToken(rawToken);
    const current = await RefreshTokenModel.findOne({ tokenHash });
    if (!current) throw new AppError('Refresh token is invalid or expired', 401, 'INVALID_REFRESH_TOKEN');

    const now = clock();
    if (current.usedAt || current.revokedAt) {
      await RefreshTokenModel.updateMany({ sessionId: current.sessionId }, { $set: { revokedAt: now } });
      throw new AppError('Refresh token reuse detected; this session has been revoked', 401, 'REFRESH_TOKEN_REUSE');
    }
    if (current.expiresAt <= now) {
      await RefreshTokenModel.updateMany({ sessionId: current.sessionId }, { $set: { revokedAt: now } });
      throw new AppError('Refresh token is invalid or expired', 401, 'INVALID_REFRESH_TOKEN');
    }

    const user = await UserModel.findById(current.userId);
    if (!user || user.status !== 'active' || !user.emailVerified) {
      await RefreshTokenModel.updateMany({ sessionId: current.sessionId }, { $set: { revokedAt: now } });
      throw new AppError('Refresh token is invalid or expired', 401, 'INVALID_REFRESH_TOKEN');
    }

    const nextRawToken = crypto.createOpaqueToken();
    const nextTokenHash = crypto.hashToken(nextRawToken);
    const nextExpiresAt = new Date(now.getTime() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000);

    // Insert the replacement first so a concurrent reuse-detection update cannot miss it.
    await makeTokenRecord({
      tokenHash: nextTokenHash,
      userId: current.userId,
      sessionId: current.sessionId,
      familyId: current.familyId,
      expiresAt: nextExpiresAt
    }).save();

    const rotated = await RefreshTokenModel.findOneAndUpdate({
      _id: current._id,
      usedAt: null,
      revokedAt: null,
      expiresAt: mongoose.trusted({ $gt: now })
    }, {
      $set: { usedAt: now, revokedAt: now, replacedByTokenHash: nextTokenHash }
    }, { new: true });

    if (!rotated) {
      await RefreshTokenModel.updateMany({ sessionId: current.sessionId }, { $set: { revokedAt: now } });
      throw new AppError('Refresh token reuse detected; this session has been revoked', 401, 'REFRESH_TOKEN_REUSE');
    }

    return {
      accessToken: crypto.createAccessToken(user._id, current.sessionId),
      refreshToken: nextRawToken,
      expiresAt: nextExpiresAt,
      sessionId: current.sessionId,
      user
    };
  }

  async function logout(rawToken) {
    if (!rawToken) return;
    const current = await RefreshTokenModel.findOne({ tokenHash: crypto.hashToken(rawToken) });
    if (!current) return;
    await RefreshTokenModel.updateMany({ sessionId: current.sessionId }, { $set: { revokedAt: clock() } });
  }

  async function logoutAll(userId) {
    const result = await RefreshTokenModel.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: clock() } }
    );
    return result.modifiedCount || 0;
  }

  async function forgotPassword(email) {
    const user = await UserModel.findOne({ email: email.toLowerCase() });
    if (!user || !user.emailVerified || user.status !== 'active') return;

    const token = crypto.createOpaqueToken(32);
    user.passwordResetTokenHash = crypto.hashToken(token);
    user.passwordResetExpiresAt = new Date(clock().getTime() + RESET_TOKEN_TTL_MS);
    await user.save();
    await deliverEmailSafely(() => mail.sendPasswordResetEmail({ to: user.email, token }));
  }

  async function resetPassword({ token, password }) {
    const newPasswordHash = await crypto.hashPassword(password);
    const user = await UserModel.findOneAndUpdate({
      passwordResetTokenHash: crypto.hashToken(token),
      passwordResetExpiresAt: mongoose.trusted({ $gt: clock() }),
      status: 'active',
      emailVerified: true
    }, {
      $set: {
        passwordHash: newPasswordHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null
      }
    }, { new: true, runValidators: true });

    if (!user) throw new AppError('Password reset token is invalid or expired', 400, 'INVALID_RESET_TOKEN');
    await RefreshTokenModel.updateMany({ userId: user._id, revokedAt: null }, { $set: { revokedAt: clock() } });
    return user;
  }

  return { register, resendVerification, verifyEmail, login, refresh, logout, logoutAll, forgotPassword, resetPassword };
}

module.exports = createAuthService();
module.exports.createAuthService = createAuthService;
module.exports.constants = { RESET_TOKEN_TTL_MS, VERIFICATION_TOKEN_TTL_MS, TOKEN_RETENTION_MS };
