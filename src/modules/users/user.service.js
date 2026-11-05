const User = require('./user.model');
const RefreshToken = require('../auth/refresh-token.model');
const AppError = require('../../utils/app-error');
const authCrypto = require('../../utils/auth-crypto');
const mailer = require('../../services/mailer');
const logger = require('../../logger');

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

function createUserService({
  UserModel = User,
  RefreshTokenModel = RefreshToken,
  crypto = authCrypto,
  mail = mailer,
  clock = () => new Date()
} = {}) {
  async function findById(userId, includePassword = false) {
    const query = UserModel.findById(userId);
    return includePassword ? query.select('+passwordHash') : query;
  }

  async function getProfile(userId) {
    const user = await findById(userId);
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    return user;
  }

  async function getUserById(userId, requesterId) {
    // Until organization memberships exist, user lookup is intentionally self-scoped.
    if (String(userId) !== String(requesterId)) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    return getProfile(requesterId);
  }

  async function revokeSessions(userId) {
    await RefreshTokenModel.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: clock() } }
    );
  }

  async function sendVerificationSafely(user, token) {
    try {
      await mail.sendVerificationEmail({ to: user.email, token });
    } catch (_error) {
      logger.error('Authentication email delivery failed');
    }
  }

  async function updateProfile(userId, changes) {
    const user = await getProfile(userId);
    const normalizedEmail = changes.email?.toLowerCase();
    const emailChanged = Boolean(normalizedEmail && normalizedEmail !== user.email);
    const verificationToken = emailChanged ? crypto.createOpaqueToken(32) : null;

    if (emailChanged) {
      const existing = await UserModel.findOne({ email: normalizedEmail });
      if (existing && String(existing._id) !== String(user._id)) {
        throw new AppError('An account with this email already exists', 409, 'EMAIL_ALREADY_EXISTS');
      }
      user.email = normalizedEmail;
      user.emailVerified = false;
      user.emailVerifiedAt = null;
      user.passwordResetTokenHash = null;
      user.passwordResetExpiresAt = null;
      user.emailVerificationTokenHash = crypto.hashToken(verificationToken);
      user.emailVerificationExpiresAt = new Date(clock().getTime() + EMAIL_VERIFICATION_TTL_MS);
    }

    for (const field of ['name', 'bio', 'avatarUrl', 'timezone']) {
      if (Object.hasOwn(changes, field)) user[field] = changes[field];
    }

    try {
      await user.save();
    } catch (error) {
      if (error.code === 11000) {
        throw new AppError('An account with this email already exists', 409, 'EMAIL_ALREADY_EXISTS');
      }
      throw error;
    }

    if (emailChanged) {
      await revokeSessions(userId);
      await sendVerificationSafely(user, verificationToken);
    }

    return { user, emailVerificationRequired: emailChanged };
  }

  async function changePassword(userId, { currentPassword, newPassword }) {
    const user = await findById(userId, true);
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    const matches = await crypto.verifyPassword(currentPassword, user.passwordHash);
    if (!matches) throw new AppError('Current password is incorrect', 401, 'INVALID_CURRENT_PASSWORD');

    user.passwordHash = newPassword;
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await user.save();
    await revokeSessions(userId);
    return user;
  }

  async function deactivateAccount(userId, { password }) {
    const user = await findById(userId, true);
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    const matches = await crypto.verifyPassword(password, user.passwordHash);
    if (!matches) throw new AppError('Password is incorrect', 401, 'INVALID_CREDENTIALS');

    user.status = 'disabled';
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpiresAt = null;
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await user.save();
    await revokeSessions(userId);
    return user;
  }

  return { getProfile, getUserById, updateProfile, changePassword, deactivateAccount };
}

module.exports = createUserService();
module.exports.createUserService = createUserService;
module.exports.constants = { EMAIL_VERIFICATION_TTL_MS };
