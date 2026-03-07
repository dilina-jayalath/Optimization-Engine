// backend/routes/settings-events.js
// Server-Sent Events (SSE) for real-time settings updates

const express = require('express');
const router = express.Router();

// Store active SSE connections per userId
const connections = new Map(); // userId -> Set of response objects

/**
 * GET /api/settings-events/:userId
 * Open SSE connection for real-time settings updates
 */
router.get('/:userId', (req, res) => {
  const { userId } = req.params;

  // Disable request timeout so the SSE stream stays open indefinitely
  req.setTimeout(0);

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering if proxied
  res.flushHeaders(); // flush headers immediately to establish the connection

  // Send initial connection message
  res.write('data: {"type":"connected","userId":"' + userId + '"}\n\n');

  // Store this connection
  if (!connections.has(userId)) {
    connections.set(userId, new Set());
  }
  connections.get(userId).add(res);

  console.log(`[SSE] Client connected for user ${userId} (total: ${connections.get(userId).size})`);

  // Send periodic keepalive comments to prevent proxy/firewall timeouts
  const keepalive = setInterval(() => {
    try { res.write(':keepalive\n\n'); } catch { clearInterval(keepalive); }
  }, 25000);

  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(keepalive);
    const userConnections = connections.get(userId);
    if (userConnections) {
      userConnections.delete(res);
      if (userConnections.size === 0) {
        connections.delete(userId);
      }
      console.log(`[SSE] Client disconnected for user ${userId} (remaining: ${userConnections.size})`);
    }
  });
});

/**
 * Broadcast settings update to all connected clients for a user
 * @param {string} userId 
 * @param {object} settings - The updated settings object
 * @param {string} source - 'manual' | 'ml' | 'trial'
 */
function broadcastSettingsUpdate(userId, settings, source = 'manual') {
  const userConnections = connections.get(userId);
  
  if (!userConnections || userConnections.size === 0) {
    console.log(`[SSE] No active connections for user ${userId}`);
    return;
  }

  const event = {
    type: 'settings_update',
    userId,
    source,
    settings,
    timestamp: new Date().toISOString(),
  };

  const data = `data: ${JSON.stringify(event)}\n\n`;

  // Send to all connected clients
  let sentCount = 0;
  userConnections.forEach((clientRes) => {
    try {
      clientRes.write(data);
      sentCount++;
    } catch (error) {
      console.error(`[SSE] Failed to send to client:`, error.message);
      userConnections.delete(clientRes);
    }
  });

  console.log(`[SSE] Broadcasted settings update to ${sentCount} client(s) for user ${userId}`);
}

/**
 * Get count of active connections for a user
 */
function getConnectionCount(userId) {
  const userConnections = connections.get(userId);
  return userConnections ? userConnections.size : 0;
}

/**
 * Broadcast to all users (for admin operations)
 */
function broadcastToAll(event) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  
  connections.forEach((userConnections, userId) => {
    userConnections.forEach((clientRes) => {
      try {
        clientRes.write(data);
      } catch (error) {
        console.error(`[SSE] Failed to broadcast to user ${userId}:`, error.message);
      }
    });
  });
}

module.exports = { 
  router, 
  broadcastSettingsUpdate,
  getConnectionCount,
  broadcastToAll,
};
