const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const env = require('../config/env');
const User = require('../models/User');
const { normalizeRole } = require('../constants/appConstants');

let io = null;

function getUserRoom(userId) {
  return `user:${String(userId || '').trim()}`;
}

function normalizeOrigin(origin) {
  return String(origin || '').trim().replace(/\/+$/, '');
}

function getSocketToken(socket) {
  const authToken = socket?.handshake?.auth?.token;
  if (authToken) {
    return String(authToken).trim();
  }

  const authorizationHeader = socket?.handshake?.headers?.authorization || '';
  if (authorizationHeader.startsWith('Bearer ')) {
    return authorizationHeader.slice(7).trim();
  }

  return '';
}

async function authenticateSocket(socket) {
  const token = getSocketToken(socket);

  if (!token) {
    throw new Error('Authentication token is required for realtime updates.');
  }

  if (!env.jwtSessionSecret) {
    throw new Error('JWT_SESSION_SECRET is not configured.');
  }

  const decoded = jwt.verify(token, env.jwtSessionSecret, { algorithms: ['HS256'] });
  const userId = decoded.sub || decoded.id;
  const user = await User.findById(userId).select('_id role isActive');

  if (!user || !user.isActive) {
    throw new Error('User is not active.');
  }

  return {
    id: user._id.toString(),
    role: normalizeRole(user.role) || user.role
  };
}

function createRealtimeServer(server) {
  io = new Server(server, {
    path: '/socket.io',
    cors: {
      origin(origin, callback) {
        if (!origin) {
          callback(null, true);
          return;
        }

        if ((Array.isArray(env.allowedOrigins) ? env.allowedOrigins : []).includes(normalizeOrigin(origin))) {
          callback(null, true);
          return;
        }

        if (env.isDevelopment) {
          callback(null, true);
          return;
        }

        callback(new Error(`Origin ${origin} is not allowed by CORS`));
      },
      credentials: true
    }
  });

  io.use(async (socket, next) => {
    try {
      socket.data.user = await authenticateSocket(socket);
      next();
    } catch (error) {
      next(error);
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    socket.join(getUserRoom(user.id));

    socket.emit('notifications:connected', {
      userId: user.id,
      role: user.role,
      connectedAt: new Date().toISOString()
    });
  });

  return io;
}

async function closeRealtimeServer() {
  if (!io) {
    return;
  }

  await io.close();
  io = null;
}

function emitNotificationCreated(notification) {
  if (!io || !notification?.recipientId) {
    return;
  }

  io.to(getUserRoom(notification.recipientId)).emit('notification:created', notification);
}

function emitNotificationsRead(recipientId, notificationIds = [], readAt = null) {
  if (!io || !recipientId || !notificationIds.length) {
    return;
  }

  io.to(getUserRoom(recipientId)).emit('notification:read', {
    notificationIds,
    readAt,
    updatedCount: notificationIds.length
  });
}

function emitAllNotificationsRead(recipientId, readAt = null) {
  if (!io || !recipientId) {
    return;
  }

  io.to(getUserRoom(recipientId)).emit('notification:read-all', {
    readAt
  });
}

module.exports = {
  closeRealtimeServer,
  createRealtimeServer,
  emitAllNotificationsRead,
  emitNotificationCreated,
  emitNotificationsRead
};
