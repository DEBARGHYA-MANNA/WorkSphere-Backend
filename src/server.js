const app = require('./app');
const env = require('./config/env');
const logger = require('./logger');
const { connectDatabase, disconnectDatabase } = require('./config/database');

let server;
let shuttingDown = false;

async function startServer() {
  await connectDatabase();
  server = app.listen(env.port, '0.0.0.0', () => {
    logger.info(`WorkSphere API listening on port ${env.port}`);
  });
  return server;
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}; shutting down gracefully`);
  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out');
    process.exit(1);
  }, 10000);
  forceExit.unref();

  try {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await disconnectDatabase();
    process.exitCode = 0;
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
    process.exitCode = 1;
  } finally {
    clearTimeout(forceExit);
  }
}

if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Unable to start WorkSphere API', { error: error.message, stack: error.stack });
    process.exitCode = 1;
  });
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = { startServer, shutdown };
