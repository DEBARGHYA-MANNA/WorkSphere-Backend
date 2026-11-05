const authCrypto = require('../../src/utils/auth-crypto');
const { createAuthService } = require('../../src/modules/auth/auth.service');

function query(value) {
  const promise = Promise.resolve(value);
  promise.select = () => promise;
  return promise;
}

function createMemoryModels() {
  const users = new Map();
  const refreshTokens = new Map();
  let userSequence = 0;
  let tokenSequence = 0;

  class MemoryUser {
    constructor(data) {
      Object.assign(this, data);
      this._id = `user-${++userSequence}`;
    }

    async save() {
      const existing = users.get(this.email);
      if (existing && existing !== this) {
        const duplicate = new Error('Duplicate email');
        duplicate.code = 11000;
        throw duplicate;
      }
      if (this.passwordHash && !this.passwordHash.startsWith('$2')) {
        this.passwordHash = await authCrypto.hashPassword(this.passwordHash);
      }
      users.set(this.email, this);
      return this;
    }

    static findOne(filter) {
      return query(users.get(filter.email) || null);
    }

    static findById(id) {
      return Promise.resolve([...users.values()].find((user) => String(user._id) === String(id)) || null);
    }

    static findOneAndUpdate(filter, update) {
      const user = [...users.values()].find((candidate) =>
        Object.entries(filter).every(([key, expected]) => {
          if (expected && expected.$gt) return candidate[key] > expected.$gt;
          return candidate[key] === expected;
        })
      );
      if (!user) return Promise.resolve(null);
      Object.assign(user, update.$set);
      return Promise.resolve(user);
    }
  }

  class MemoryRefreshToken {
    constructor(data) {
      Object.assign(this, data);
      this._id = `refresh-${++tokenSequence}`;
      this.usedAt = null;
      this.revokedAt = null;
    }

    async save() {
      refreshTokens.set(this.tokenHash, this);
      return this;
    }

    static findOne(filter) {
      return Promise.resolve(refreshTokens.get(filter.tokenHash) || null);
    }

    static findOneAndUpdate(filter, update) {
      const record = [...refreshTokens.values()].find((token) =>
        token._id === filter._id &&
        token.usedAt === filter.usedAt &&
        token.revokedAt === filter.revokedAt &&
        token.expiresAt > filter.expiresAt.$gt
      );
      if (!record) return Promise.resolve(null);
      Object.assign(record, update.$set);
      return Promise.resolve(record);
    }

    static updateMany(filter, update) {
      let modifiedCount = 0;
      for (const token of refreshTokens.values()) {
        const userMatches = filter.userId === undefined || String(token.userId) === String(filter.userId);
        const sessionMatches = filter.sessionId === undefined || token.sessionId === filter.sessionId;
        const revocationMatches = filter.revokedAt !== null || token.revokedAt === null;
        if (userMatches && sessionMatches && revocationMatches) {
          Object.assign(token, update.$set);
          modifiedCount += 1;
        }
      }
      return Promise.resolve({ modifiedCount });
    }
  }

  return { UserModel: MemoryUser, RefreshTokenModel: MemoryRefreshToken, users, refreshTokens };
}

const validRegistration = {
  name: 'Avery Example',
  email: 'avery@example.com',
  password: 'Correct-Horse-Battery-9'
};

describe('Authentication service', () => {
  let models;
  let service;
  let mail;

  beforeEach(() => {
    models = createMemoryModels();
    mail = {
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined)
    };
    service = createAuthService({ UserModel: models.UserModel, RefreshTokenModel: models.RefreshTokenModel, mail });
  });

  test('registration bcrypt-hashes passwords and stores only a hashed verification token', async () => {
    const user = await service.register(validRegistration);
    const persisted = models.users.get(validRegistration.email);
    const mailedToken = mail.sendVerificationEmail.mock.calls[0][0].token;

    expect(persisted.passwordHash).not.toBe(validRegistration.password);
    expect(persisted.passwordHash).toMatch(/^\$2[aby]\$/);
    await expect(authCrypto.verifyPassword(validRegistration.password, persisted.passwordHash)).resolves.toBe(true);
    expect(persisted.emailVerificationTokenHash).toBe(authCrypto.hashToken(mailedToken));
    expect(persisted.emailVerificationTokenHash).not.toBe(mailedToken);
    expect(user.emailVerified).toBe(false);
  });

  test('duplicate registrations are rejected without creating a second account', async () => {
    await service.register(validRegistration);
    await expect(service.register(validRegistration)).rejects.toMatchObject({ code: 'EMAIL_ALREADY_EXISTS', statusCode: 409 });
    expect(models.users.size).toBe(1);
  });

  test('unverified accounts cannot log in; verification enables login', async () => {
    await service.register(validRegistration);
    await expect(service.login(validRegistration)).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', statusCode: 401 });

    const verificationToken = mail.sendVerificationEmail.mock.calls[0][0].token;
    const verifiedSession = await service.verifyEmail(verificationToken);
    expect(verifiedSession.user.emailVerified).toBe(true);
    expect(verifiedSession.refreshToken).toBeTruthy();

    const session = await service.login(validRegistration);
    expect(session.user.email).toBe(validRegistration.email);
    expect(session.accessToken).toBeTruthy();
  });

  test('refresh rotates tokens and replay of a consumed token revokes its session', async () => {
    const user = await service.register(validRegistration);
    const verificationToken = mail.sendVerificationEmail.mock.calls[0][0].token;
    await service.verifyEmail(verificationToken);
    const initial = await service.login(validRegistration);

    const initialHash = authCrypto.hashToken(initial.refreshToken);
    const rotated = await service.refresh(initial.refreshToken);
    expect(rotated.refreshToken).not.toBe(initial.refreshToken);
    expect(models.refreshTokens.get(initialHash).usedAt).toBeInstanceOf(Date);
    expect(models.refreshTokens.get(authCrypto.hashToken(rotated.refreshToken))).toBeDefined();

    await expect(service.refresh(initial.refreshToken)).rejects.toMatchObject({ code: 'REFRESH_TOKEN_REUSE' });
    const activeSessionTokens = [...models.refreshTokens.values()].filter((token) =>
      token.sessionId === rotated.sessionId && token.revokedAt === null
    );
    expect(activeSessionTokens).toHaveLength(0);
    expect(user.email).toBe(validRegistration.email);
  });

  test('expired refresh tokens are rejected and their session is revoked', async () => {
    let now = new Date('2026-01-01T00:00:00.000Z');
    const timedModels = createMemoryModels();
    const timedMail = {
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined)
    };
    const timedService = createAuthService({
      UserModel: timedModels.UserModel,
      RefreshTokenModel: timedModels.RefreshTokenModel,
      mail: timedMail,
      clock: () => now
    });
    await timedService.register(validRegistration);
    await timedService.verifyEmail(timedMail.sendVerificationEmail.mock.calls[0][0].token);
    const session = await timedService.login(validRegistration);
    now = new Date('2026-03-01T00:00:00.000Z');

    await expect(timedService.refresh(session.refreshToken)).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
    const expiredSessionRecords = [...timedModels.refreshTokens.values()].filter((token) => token.sessionId === session.sessionId);
    expect(expiredSessionRecords.every((token) => token.revokedAt instanceof Date)).toBe(true);
  });

  test('logout revokes the session and logout-all revokes every session for the user', async () => {
    await service.register(validRegistration);
    const verificationToken = mail.sendVerificationEmail.mock.calls[0][0].token;
    const verified = await service.verifyEmail(verificationToken);
    const first = await service.login(validRegistration);
    const second = await service.login(validRegistration);

    await service.logout(first.refreshToken);
    expect([...models.refreshTokens.values()].find((token) => token.sessionId === first.sessionId).revokedAt).toBeInstanceOf(Date);

    const count = await service.logoutAll(verified.user._id);
    expect(count).toBeGreaterThan(0);
    expect([...models.refreshTokens.values()].every((token) => token.revokedAt instanceof Date)).toBe(true);
    expect(second.sessionId).not.toBe(first.sessionId);
  });

  test('forgot/reset password uses one-time tokens and revokes existing sessions', async () => {
    await service.register(validRegistration);
    const verificationToken = mail.sendVerificationEmail.mock.calls[0][0].token;
    await service.verifyEmail(verificationToken);
    const session = await service.login(validRegistration);

    await service.forgotPassword(validRegistration.email);
    const resetToken = mail.sendPasswordResetEmail.mock.calls[0][0].token;
    expect(models.users.get(validRegistration.email).passwordResetTokenHash).toBe(authCrypto.hashToken(resetToken));
    await service.resetPassword({ token: resetToken, password: 'New-Secure-Password-42' });

    await expect(service.login(validRegistration)).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await expect(service.login({ ...validRegistration, password: 'New-Secure-Password-42' })).resolves.toMatchObject({ user: { email: validRegistration.email } });
    expect([...models.refreshTokens.values()].find((token) => token.sessionId === session.sessionId).revokedAt).toBeInstanceOf(Date);
    await expect(service.resetPassword({ token: resetToken, password: 'Another-New-Password-43' })).rejects.toMatchObject({ code: 'INVALID_RESET_TOKEN' });
  });
});
