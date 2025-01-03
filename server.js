// server.js
const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// ------------------------------
// In-memory data
// ------------------------------
let publicMessages = [];        // all public (global) chat messages
let privateMessages = [];       // all private messages
let activeConnections = {};     // map: username -> ws

wss.on('connection', (ws) => {
  console.log('Client connected via WebSocket.');

  // We always send the existing public chat to anyone who connects
  ws.send(JSON.stringify({
    type: 'init-public',
    messages: publicMessages
  }));

  ws.on('message', (data) => {
    try {
      const parsed = JSON.parse(data);

      // 1) Register username
      //    The client sends { type: "register-username", username: "..." }
      if (parsed.type === 'register-username') {
        const uname = parsed.username;
        // Map the username to this WebSocket
        activeConnections[uname] = ws;
        console.log(`User "${uname}" registered their WebSocket connection.`);

        // On registration, send them all private messages relevant to them
        const relevant = privateMessages.filter(
          (pm) => pm.from === uname || pm.to === uname
        );
        ws.send(JSON.stringify({
          type: 'init-private',
          messages: relevant
        }));
      }

      // 2) Public chat
      //    The client sends { type: "public-chat", username, text }
      else if (parsed.type === 'public-chat') {
        const newMessage = {
          username: parsed.username,
          text: parsed.text,
          timestamp: new Date().toLocaleTimeString(),
        };
        publicMessages.push(newMessage);

        // Broadcast to all
        wss.clients.forEach((client) => {
          if (client.readyState === client.OPEN) {
            client.send(JSON.stringify({
              type: 'public-chat',
              message: newMessage
            }));
          }
        });
      }

      // 3) Private chat
      //    The client sends { type: "private-chat", from, to, text }
      else if (parsed.type === 'private-chat') {
        const newPrivateMsg = {
          from: parsed.from,
          to: parsed.to,
          text: parsed.text,
          timestamp: new Date().toLocaleTimeString(),
        };
        privateMessages.push(newPrivateMsg);

        // Deliver to recipient if online
        const recipientWs = activeConnections[parsed.to];
        if (recipientWs && recipientWs.readyState === recipientWs.OPEN) {
          recipientWs.send(JSON.stringify({
            type: 'private-chat',
            message: newPrivateMsg
          }));
        }

        // Also deliver back to sender so they see their own message
        const senderWs = activeConnections[parsed.from];
        if (senderWs && senderWs.readyState === senderWs.OPEN) {
          senderWs.send(JSON.stringify({
            type: 'private-chat',
            message: newPrivateMsg
          }));
        }
      }
    } catch (err) {
      console.error('Error parsing WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected.');
    // Optionally, you could find the username in `activeConnections`
    // and remove them. We'll omit for brevity.
  });
});

// Start the server
const PORT = 3001;
server.listen(PORT, () => {
  console.log(`WebSocket server listening on port ${PORT}`);
});
