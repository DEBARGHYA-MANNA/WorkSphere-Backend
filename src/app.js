const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const env = require('./config/env');
const swaggerSpec = require('./config/swagger');
const requestContext = require('./middlewares/request-context');
const rejectUnsafeKeys = require('./middlewares/reject-unsafe-keys');
const rateLimiter = require('./middlewares/rate-limiter');
const notFound = require('./middlewares/not-found');
const errorHandler = require('./middlewares/error-handler');
const healthRoutes = require('./routes/health.routes');

const app = express();

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"]
    }
  }
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.corsOrigins.includes('*') || env.corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    const error = new Error('Origin is not allowed by CORS');
    error.statusCode = 403;
    error.code = 'CORS_ORIGIN_DENIED';
    return callback(error);
  },
  credentials: true
}));
app.use(requestContext);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(rejectUnsafeKeys);
app.use('/api', rateLimiter);

app.get('/openapi.json', (req, res) => res.json(swaggerSpec));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: false,
  customSiteTitle: 'WorkSphere API Documentation'
}));
app.use('/api/v1', healthRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
