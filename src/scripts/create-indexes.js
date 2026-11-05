const mongoose = require('mongoose');
const logger = require('../logger');
const { connectDatabase, disconnectDatabase } = require('../config/database');

async function createIndexes() {
  try {
    // Loading the application registers every model before index provisioning.
    require('../app');
    await connectDatabase();
    const results = await Promise.all(mongoose.modelNames().map(async (name) => {
      const model = mongoose.model(name);
      await model.createIndexes();
      return { model: name, indexCount: model.schema.indexes().length };
    }));
    logger.info('MongoDB indexes provisioned', { models: results });
  } catch (error) {
    logger.error(`MongoDB index provisioning failed: ${error.message}`, { stack: error.stack });
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

if (require.main === module) void createIndexes();

module.exports = createIndexes;
