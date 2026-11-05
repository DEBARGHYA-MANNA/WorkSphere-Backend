const bcrypt = require('bcrypt');
const authCrypto = require('../../src/utils/auth-crypto');
const env = require('../../src/config/env');
const { createUserService } = require('../../src/modules/users/user.service');

const USER_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const PASSWORD = 'Correct-Horse-Battery-9';

function query(value) {
  const promise = Promise.resolve(value);
  promise.select = () => promise;
  return promise;
}

function createMemoryModels() {
  const users = new Map();
  const refreshTokens = [];

  class MemoryUser {
    constructor(data) { Object.assign(this, data); }

    async save() {
      if (this.passwordHash && !/^\$2[aby]\$\d{2}\$/.test(this.passwordHash)) {
        this.passwordHash = await bcrypt.hash(this.passwordHash, 4);
      }
      users.set(String(this._id), this);
      return this;
    }

    static findById(id) {
      return query(users.get(String(id)) || null);
    }

    static findOne({ email }) {
      return Promise.resolve([...users.values()].find((user) => user.email === email) || null);
    }
  }

  class MemoryRefreshToken {
    static updateMany(filter, update) {
      let modifiedCount = 0;
      for (const token of refreshTokens) {
        if (String(token.userId) === String(filter.userId) && token.revokedAt === null) {
          token.revokedAt = update.$set.revokedAt;
          modifiedCount += 1;
        }
      }
      return Promise.resolve({ modifiedCount });
    }
  }

  return { UserModel: MemoryUser, RefreshTokenModel: MemoryRefreshToken, users, refreshTokens };
}

function makeUser(id, email = 'avery@example.com') {
  return {
    _id: id,
    name: 'Avery Example',
    email,
    passwordHash: bcrypt.hashSync(PASSWORD, 4),
    emailVerified: true,
    emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    emailVerificationTokenHash: null,
    emailVerificationExpiresAt: null,
    passwordResetTokenHash: null,
    passwordResetExpiresAt: null,
    status: 'active',
    bio: '',
    avatarUrl: null,
    timezone: 'UTC',
    toJSON() {
      const safe = { ...this };
      delete safe.passwordHash;
      delete safe.emailVerificationTokenHash;
      delete safe.emailVerificationExpiresAt;
      delete safe.passwordResetTokenHash;
      delete safe.passwordResetExpiresAt;
      delete safe.toJSON;
      delete safe.save;
      return safe;
    },
    async save() {
      if (this.passwordHash && !/^\$2[aby]\$\d{2}\$/.test(this.passwordHash)) {
        this.passwordHash = await authCrypto.hashPassword(this.passwordHash);
      }
      return this;
    }
  };
}

describe('User management service', () => {
  let models;
  let service;
  let mail;
  let user;

  beforeEach(() => {
    models = createMemoryModels();
    user = makeUser(USER_ID);
    models.users.set(USER_ID, user);
    models.refreshTokens.push(
      { userId: USER_ID, sessionId: 'session-one', revokedAt: null },
      { userId: OTHER_ID, sessionId: 'other-session', revokedAt: null }
    );
    mail = { sendVerificationEmail: jest.fn().mockResolvedValue(undefined) };
    service = createUserService({
      UserModel: models.UserModel,
      RefreshTokenModel: models.RefreshTokenModel,
      mail,
      config: { ...env, emailVerificationEnabled: true }
    });
  });

  test('retrieves profile and rejects lookup outside the current-user scope', async () => {
    await expect(service.getProfile(USER_ID)).resolves.toBe(user);
    await expect(service.getUserById(USER_ID, USER_ID)).resolves.toBe(user);
    await expect(service.getUserById(OTHER_ID, USER_ID)).rejects.toMatchObject({ code: 'USER_NOT_FOUND', statusCode: 404 });
  });

  test('updates profile and requires email verification when the email changes', async () => {
    user.passwordResetTokenHash = 'old-email-reset-hash';
    user.passwordResetExpiresAt = new Date(Date.now() + 60000);
    const result = await service.updateProfile(USER_ID, {
      name: 'Avery Updated',
      email: 'avery.new@example.com',
      bio: 'Product designer',
      timezone: 'Asia/Kolkata'
    });

    expect(result.user.name).toBe('Avery Updated');
    expect(result.user.email).toBe('avery.new@example.com');
    expect(result.user.emailVerified).toBe(false);
    expect(result.emailVerificationRequired).toBe(true);
    expect(user.emailVerificationTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(user.passwordResetTokenHash).toBeNull();
    expect(user.passwordResetExpiresAt).toBeNull();
    const emailedToken = mail.sendVerificationEmail.mock.calls[0][0].token;
    expect(user.emailVerificationTokenHash).toBe(authCrypto.hashToken(emailedToken));
    expect(models.refreshTokens[0].revokedAt).toBeInstanceOf(Date);
    expect(models.refreshTokens[1].revokedAt).toBeNull();
  });

  test('email changes do not require verification while the feature is disabled', async () => {
    const noVerificationService = createUserService({
      UserModel: models.UserModel,
      RefreshTokenModel: models.RefreshTokenModel,
      mail,
      config: { ...env, emailVerificationEnabled: false }
    });

    const result = await noVerificationService.updateProfile(USER_ID, { email: 'avery.new@example.com' });
    expect(result.user.emailVerified).toBe(false);
    expect(result.emailVerificationRequired).toBe(false);
    expect(result.user.emailVerificationTokenHash).toBeNull();
    expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
    expect(models.refreshTokens[0].revokedAt).toBeInstanceOf(Date);
  });

  test('rejects profile email conflicts', async () => {
    models.users.set(OTHER_ID, makeUser(OTHER_ID, 'other@example.com'));
    await expect(service.updateProfile(USER_ID, { email: 'other@example.com' })).rejects.toMatchObject({
      code: 'EMAIL_ALREADY_EXISTS', statusCode: 409
    });
  });

  test('changes password only after verifying the current password and revokes all sessions', async () => {
    user.passwordResetTokenHash = 'pending-reset-hash';
    user.passwordResetExpiresAt = new Date(Date.now() + 60000);
    await expect(service.changePassword(USER_ID, {
      currentPassword: 'wrong-password', newPassword: 'New-Secure-Password-41'
    })).rejects.toMatchObject({ code: 'INVALID_CURRENT_PASSWORD', statusCode: 401 });

    await service.changePassword(USER_ID, {
      currentPassword: PASSWORD, newPassword: 'New-Secure-Password-41'
    });
    expect(user.passwordHash).not.toBe('New-Secure-Password-41');
    await expect(bcrypt.compare('New-Secure-Password-41', user.passwordHash)).resolves.toBe(true);
    expect(user.passwordResetTokenHash).toBeNull();
    expect(models.refreshTokens[0].revokedAt).toBeInstanceOf(Date);
    expect(models.refreshTokens[1].revokedAt).toBeNull();
  });

  test('deactivates the account after password confirmation and prevents it being treated as active', async () => {
    await expect(service.deactivateAccount(USER_ID, { password: 'wrong-password' })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS', statusCode: 401
    });
    await service.deactivateAccount(USER_ID, { password: PASSWORD });

    expect(user.status).toBe('disabled');
    expect(user.emailVerificationTokenHash).toBeNull();
    expect(models.refreshTokens[0].revokedAt).toBeInstanceOf(Date);
  });
});
