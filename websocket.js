const WebSocket = require('ws');
const url = require('url');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./config/jwtConfig');
const Usuario = require('./models/usuario');

const clients = new Map();

function initializeWebSocket(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    const token = url.parse(req.url, true).query.token;

    if (!token) {
      ws.terminate();
      return;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const userId = decoded.id;

      // If there's an existing connection for this user, notify and close it.
      if (clients.has(userId)) {
        const oldWs = clients.get(userId);
        oldWs.send(JSON.stringify({ type: 'FORCE_LOGOUT', message: 'Has iniciado sesión en otro dispositivo.' }));
        oldWs.terminate();
      }

      // Store the new connection
      clients.set(userId, ws);
      console.log(`Cliente conectado: ${userId}`);

      ws.on('close', () => {
        // Only remove the client if the closing connection is the current one
        if (clients.get(userId) === ws) {
          clients.delete(userId);
          console.log(`Cliente desconectado: ${userId}`);
        }
      });

      ws.on('error', (error) => {
        console.error(`Error en WebSocket para el usuario ${userId}:`, error);
      });

    } catch (error) {
      ws.terminate();
    }
  });

  console.log('Servidor de WebSocket inicializado.');
  return wss;
}

function notifyClient(userId, message) {
    if (clients.has(userId)) {
        clients.get(userId).send(JSON.stringify(message));
    }
}

module.exports = { initializeWebSocket, notifyClient, clients };
