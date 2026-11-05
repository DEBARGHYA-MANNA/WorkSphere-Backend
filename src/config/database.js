const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../logger');

mongoose.set('sanitizeFilter', true);

async function connectDatabase(uri = env.mongoUri) {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000
  });
  logger.info('Connected to MongoDB');
  return mongoose.connection;
}

async function disconnectDatabase() {
  await mongoose.disconnect();
}

module.exports = { connectDatabase, disconnectDatabase };
