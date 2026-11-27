import http from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { pool } from './db/pool.js';
import { sequelize, testConnection } from './db/sequelize.js';
import { initSocketServer } from './services/socket.service.js';

await testConnection();

const app = createApp();
const server = http.createServer(app);
const io = initSocketServer(server);

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Enterprise LMS API listening (Sequelize Postgres ORM + Socket.IO)');
});

async function shutdown(signal) {
  logger.info({ signal }, 'Shutting down gracefully');
  io.close();
  server.close(async () => {
    await sequelize.close();
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
