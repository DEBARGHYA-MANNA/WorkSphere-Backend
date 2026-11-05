const { createHash, randomBytes } = require('node:crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function createOpaqueToken(bytes = 48) {
  return randomBytes(bytes).toString('base64url');
}

function hashPassword(password) {
  return bcrypt.hash(password, env.bcryptRounds);
}

function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

function createAccessToken(userId, sessionId, options = {}) {
  return jwt.sign({ sid: sessionId }, options.secret || env.accessTokenSecret, {
    algorithm: 'HS256',
    subject: String(userId),
    expiresIn: options.expiresIn || env.accessTokenTtl,
    issuer: 'worksphere-api',
    audience: 'worksphere-client'
  });
}

function verifyAccessToken(token, secret = env.accessTokenSecret) {
  return jwt.verify(token, secret, {
    algorithms: ['HS256'],
    issuer: 'worksphere-api',
    audience: 'worksphere-client'
  });
}

module.exports = { hashToken, createOpaqueToken, hashPassword, verifyPassword, createAccessToken, verifyAccessToken };
