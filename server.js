// server.js
const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server });

// In-memory array of public chat messages
let publicMessages = [];

// When a client connects:
wss.on('connection', (ws) => {
  console.log('Client connected via WebSocket.');

  // Send current history to the new client
  ws.send(JSON.stringify({ type: 'init-public', messages: publicMessages }));

  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const parsed = JSON.parse(data);

      // Handle public chat messages
      if (parsed.type === 'public-chat') {
        const newMessage = {
          username: parsed.username, 
          text: parsed.text,
          timestamp: new Date().toLocaleTimeString(),
        };

        publicMessages.push(newMessage);

        // Broadcast to everyone
        wss.clients.forEach((client) => {
          if (client.readyState === client.OPEN) {
            client.send(JSON.stringify({ type: 'public-chat', message: newMessage }));
          }
        });
      }
    } catch (err) {
      console.error('Error parsing WebSocket message:', err);
    }
  });

  // On disconnect
  ws.on('close', () => {
    console.log('Client disconnected.');
  });
});

// Start server
const PORT = 3001;
server.listen(PORT, () => {
  console.log(`WebSocket server is listening on port ${PORT}`);
});
