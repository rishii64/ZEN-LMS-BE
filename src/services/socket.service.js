import { Server } from 'socket.io';
import { verifyAccessToken } from '../utils/crypto.js';
import { logger } from '../config/logger.js';

let io = null;

export function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    path: '/socket.io',
    cors: {
      origin: true,
      credentials: true
    }
  });

  io.use((socket, next) => {
    try {
      const rawToken =
        socket.handshake.auth?.token ||
        (socket.handshake.headers?.authorization || '').replace(/^Bearer\s+/i, '');
      if (!rawToken) {
        return next(new Error('Authentication required'));
      }
      const decoded = verifyAccessToken(rawToken);
      socket.user = {
        id: decoded.sub,
        isPlatformAdmin: Boolean(decoded.platformAdmin)
      };
      return next();
    } catch {
      return next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    socket.join('platform');
    socket.join(`user:${userId}`);

    const orgId = socket.handshake.auth?.organizationId;
    if (orgId) {
      socket.join(`org:${orgId}`);
    }

    logger.debug({ userId, socketId: socket.id }, 'Socket connected');

    socket.on('org:switch', (newOrgId) => {
      for (const room of socket.rooms) {
        if (room.startsWith('org:')) socket.leave(room);
      }
      if (newOrgId) {
        socket.join(`org:${newOrgId}`);
      }
    });

    socket.on('disconnect', () => {
      logger.debug({ userId, socketId: socket.id }, 'Socket disconnected');
    });
  });

  return io;
}

export function getSocketServer() {
  return io;
}

export function emitAnnouncement(announcement) {
  if (!io || !announcement) return;
  io.to('platform').emit('platform:announcement', announcement);
}

export function emitUserNotification(userId, notification) {
  if (!io || !userId || !notification) return;
  io.to(`user:${userId}`).emit('notification:new', notification);
}
