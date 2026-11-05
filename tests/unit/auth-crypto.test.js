const { hashPassword, verifyPassword, hashToken, createOpaqueToken, createAccessToken, verifyAccessToken } = require('../../src/utils/auth-crypto');

describe('Authentication cryptography utilities', () => {
  test('passwords are bcrypt hashed and verified', async () => {
    const password = 'Correct-Horse-Battery-9';
    const hash = await hashPassword(password);
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(hash).not.toBe(password);
    await expect(verifyPassword(password, hash)).resolves.toBe(true);
    await expect(verifyPassword('incorrect-password', hash)).resolves.toBe(false);
  });

  test('opaque tokens are random and persisted as one-way SHA-256 hashes', () => {
    const first = createOpaqueToken();
    const second = createOpaqueToken();
    expect(first).not.toBe(second);
    expect(hashToken(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken(first)).not.toBe(first);
  });

  test('expired access tokens fail verification', () => {
    const expired = createAccessToken('user-expired', 'session-expired', { expiresIn: '-1s' });
    expect(() => verifyAccessToken(expired)).toThrow();
  });

  test('access tokens carry a user and session and reject tampering', () => {
    const token = createAccessToken('user-123', 'session-456');
    expect(verifyAccessToken(token)).toMatchObject({ sub: 'user-123', sid: 'session-456' });
    expect(() => verifyAccessToken(`${token}tampered`)).toThrow();
  });
});
