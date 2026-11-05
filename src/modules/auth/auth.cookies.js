const env = require('../../config/env');

const REFRESH_COOKIE_NAME = 'worksphereRefreshToken';

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.cookieSameSite,
    path: '/api/v1/auth',
    maxAge: env.refreshTokenTtlDays * 24 * 60 * 60 * 1000
  };
}

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions());
}

function clearRefreshCookie(res) {
  const options = refreshCookieOptions();
  delete options.maxAge;
  res.clearCookie(REFRESH_COOKIE_NAME, options);
}

module.exports = { REFRESH_COOKIE_NAME, refreshCookieOptions, setRefreshCookie, clearRefreshCookie };
