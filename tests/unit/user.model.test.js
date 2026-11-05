const User = require('../../src/modules/users/user.model');
const bcrypt = require('bcrypt');
const RefreshToken = require('../../src/modules/auth/refresh-token.model');

describe('Authentication persistence models', () => {
  test('user JSON serialization never exposes password or one-time token material', () => {
    const user = new User({
      name: 'Avery Example',
      email: 'avery@example.com',
      passwordHash: 'plaintext-is-only-provided-to-the-hashing-hook',
      emailVerificationTokenHash: 'verification-hash',
      emailVerificationExpiresAt: new Date(),
      passwordResetTokenHash: 'reset-hash',
      passwordResetExpiresAt: new Date()
    });

    const json = user.toJSON();
    expect(json.passwordHash).toBeUndefined();
    expect(json.emailVerificationTokenHash).toBeUndefined();
    expect(json.emailVerificationExpiresAt).toBeUndefined();
    expect(json.passwordResetTokenHash).toBeUndefined();
    expect(json.passwordResetExpiresAt).toBeUndefined();
    expect(json.email).toBe('avery@example.com');
  });

  test('document save middleware bcrypt-hashes a plaintext password before persistence', async () => {
    const user = new User({ name: 'Avery Example', email: 'avery@example.com', passwordHash: 'Plain-text-password-value' });
    const hook = User.schema.s.hooks._pres.get('save').find(({ fn }) => fn.name === 'hashPasswordWhenChanged');
    await hook.fn.call(user);

    expect(user.passwordHash).not.toBe('Plain-text-password-value');
    await expect(bcrypt.compare('Plain-text-password-value', user.passwordHash)).resolves.toBe(true);
  });

  test('query update middleware also hashes plaintext password updates', async () => {
    const update = { $set: { passwordHash: 'Plain-text-password-value' } };
    const queryContext = {
      getUpdate: () => update,
      setUpdate(nextUpdate) { this.update = nextUpdate; }
    };
    const hook = User.schema.s.hooks._pres.get('findOneAndUpdate').find(({ fn }) => fn.name === 'hashPasswordInQueryUpdate');
    await hook.fn.call(queryContext);

    const storedHash = queryContext.update.$set.passwordHash;
    expect(storedHash).not.toBe('Plain-text-password-value');
    await expect(bcrypt.compare('Plain-text-password-value', storedHash)).resolves.toBe(true);
  });

  test('sensitive credentials are excluded by default and refresh tokens have retention indexing', () => {
    expect(User.schema.path('passwordHash').options.select).toBe(false);
    expect(User.schema.path('emailVerificationTokenHash').options.select).toBe(false);
    expect(User.schema.path('passwordResetTokenHash').options.select).toBe(false);
    expect(RefreshToken.schema.path('tokenHash').options.select).toBe(false);
    expect(RefreshToken.schema.indexes()).toEqual(expect.arrayContaining([
      [expect.objectContaining({ purgeAt: 1 }), expect.objectContaining({ expireAfterSeconds: 0 })]
    ]));
  });
});
