const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const baseEnv = {
  PATH: process.env.PATH,
  NODE_ENV: 'production',
  MONGODB_URI: 'mongodb://db.internal:27017/worksphere?replicaSet=rs0',
  CORS_ORIGIN: 'https://app.example.test'
};

function loadEnv(overrides = {}) {
  return spawnSync(process.execPath, ['-e', "const env=require('./src/config/env'); process.stdout.write(JSON.stringify(env))"], {
    cwd: ROOT,
    env: { ...baseEnv, ...overrides },
    encoding: 'utf8'
  });
}

describe('Environment configuration', () => {
  test('refuses production startup with a missing, placeholder, or weak JWT secret', () => {
    for (const secret of [undefined, 'replace-with-a-random-secret-at-least-32-characters-long', 'short']) {
      const env = { ...baseEnv };
      if (secret !== undefined) env.JWT_ACCESS_SECRET = secret;
      const result = loadEnv(env);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('JWT_ACCESS_SECRET');
    }
  });

  test('requires explicit non-wildcard production CORS origins', () => {
    const missing = loadEnv({ JWT_ACCESS_SECRET: 'a'.repeat(48), CORS_ORIGIN: '' });
    expect(missing.status).not.toBe(0);
    expect(missing.stderr).toContain('CORS_ORIGIN');
    const wildcard = loadEnv({ JWT_ACCESS_SECRET: 'a'.repeat(48), CORS_ORIGIN: '*' });
    expect(wildcard.status).not.toBe(0);
    expect(wildcard.stderr).toContain('wildcard');
  });

  test('loads valid production settings with index creation disabled by default', () => {
    const result = loadEnv({ JWT_ACCESS_SECRET: 'strong-random-production-secret-value-123456', COOKIE_SAME_SITE: 'none' });
    expect(result.status).toBe(0);
    const config = JSON.parse(result.stdout);
    expect(config.isProduction).toBe(true);
    expect(config.mongooseAutoIndex).toBe(false);
    expect(config.corsOrigins).toEqual(['https://app.example.test']);
    expect(config.cookieSameSite).toBe('none');
    expect(config.emailVerificationEnabled).toBe(false);

    const enabled = loadEnv({
      JWT_ACCESS_SECRET: 'strong-random-production-secret-value-123456',
      EMAIL_VERIFICATION_ENABLED: 'true'
    });
    expect(enabled.status).toBe(0);
    expect(JSON.parse(enabled.stdout).emailVerificationEnabled).toBe(true);
  });
});
