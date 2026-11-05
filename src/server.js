const appModule = require('./app');
const app = appModule.createApp({
  configureRoutes(app) {
    app.get('/', (_req, res) => {
      res.status(200).json({
        success: true,
        message: 'Welcome to WorkSphere API',
        status: 'Server is running'
      });
    });
  }
});
const env = require('./config/env');
const logger = require('./logger');
const { connectDatabase, disconnectDatabase } = require('./config/database');
const { startDeadlineReminderScheduler, stopDeadlineReminderScheduler } = require('./modules/notifications/deadline-reminder.scheduler');

let server;
let deadlineReminderTimer;
let shuttingDown = false;

async function startServer() {
  await connectDatabase();
  if (!deadlineReminderTimer) deadlineReminderTimer = startDeadlineReminderScheduler();
  server = app.listen(env.port, '0.0.0.0', () => {
    logger.info(`WorkSphere API listening on port ${env.port}`);
  });
  server.requestTimeout = env.requestTimeoutMs;
  server.headersTimeout = Math.min(66000, env.requestTimeoutMs);
  server.keepAliveTimeout = 65000;
  return server;
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}; shutting down gracefully`);
  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out');
    process.exit(1);
  }, env.shutdownTimeoutMs);
  forceExit.unref();

  try {
    await stopDeadlineReminderScheduler(deadlineReminderTimer);
    deadlineReminderTimer = null;
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

module.exports = { app, startServer, shutdown };
