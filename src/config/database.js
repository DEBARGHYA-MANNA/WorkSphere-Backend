const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../logger');

mongoose.set('sanitizeFilter', true);
mongoose.set('autoIndex', env.mongooseAutoIndex);

async function connectDatabase(uri = env.mongoUri) {
  await mongoose.connect(uri, {
    appName: 'WorkSphere Backend',
    serverSelectionTimeoutMS: env.mongoServerSelectionTimeoutMs,
    socketTimeoutMS: env.mongoSocketTimeoutMs,
    maxPoolSize: env.mongoMaxPoolSize,
    minPoolSize: env.mongoMinPoolSize,
    autoIndex: env.mongooseAutoIndex
  });
  logger.info('Connected to MongoDB');
  return mongoose.connection;
}

async function disconnectDatabase() {
  await mongoose.disconnect();
}

module.exports = { connectDatabase, disconnectDatabase };
