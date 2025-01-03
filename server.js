// server.js
const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);

// Create a WebSocket server on top of the HTTP server.
const wss = new WebSocketServer({ server });

// In-memory array of messages (for demo only - not persistent!)
let messages = [];

// When a client connects:
wss.on('connection', (ws) => {
  console.log('Client connected via WebSocket.');

  // Immediately send existing messages to the newly connected client.
  ws.send(JSON.stringify({ type: 'init', messages }));

  // When this WebSocket receives a message:
  ws.on('message', (data) => {
    try {
      const parsed = JSON.parse(data);

      // If the message type is "chat", broadcast it to everyone.
      if (parsed.type === 'chat') {
        const newMessage = {
          id: parsed.id,       // e.g., unique user ID
          text: parsed.text,   // the message text
          timestamp: new Date().toLocaleTimeString(),
        };

        // Push to local array
        messages.push(newMessage);

        // Broadcast to all clients
        wss.clients.forEach((client) => {
          if (client.readyState === client.OPEN) {
            client.send(JSON.stringify({ type: 'chat', message: newMessage }));
          }
        });
      }
    } catch (err) {
      console.error('Error parsing message:', err);
    }
  });

  // When a client disconnects:
  ws.on('close', () => {
    console.log('Client disconnected.');
  });
});

// Start the server
const PORT = 3001;
server.listen(PORT, () => {
  console.log(`WebSocket server is listening on port ${PORT}`);
});
