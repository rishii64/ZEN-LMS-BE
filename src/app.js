import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { openApiSpec, renderDocsHtml } from './docs/openapi.js';
import { registerRoutes } from './routes/index.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(requestIdMiddleware);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({
    origin: env.isProd ? [env.APP_BASE_URL] : true,
    credentials: true
  }));
  app.use(compression());
  app.use(
    express.json({
      limit: '5mb',
      verify: (req, _res, buf) => {
        req.rawBody = buf.toString('utf8');
      }
    })
  );
  app.use(express.urlencoded({ extended: true }));
  if (!env.isTest) {
    app.use(pinoHttp({ logger, genReqId: (req) => req.requestId }));
  }
  app.use('/api', apiLimiter);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'enterprise-lms-api', orm: 'sequelize-postgres', timestamp: new Date().toISOString() });
  });

  app.get('/api/v1/docs.json', (_req, res) => res.json(openApiSpec));
  app.get('/api/v1/docs', (_req, res) => res.type('html').send(renderDocsHtml()));

  // Mount MVC Routes
  registerRoutes(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
