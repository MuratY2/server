// server.js
const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ------------------------------
// In-memory data
// ------------------------------
let publicMessages = [];       // plaintext messages for global chat
let privateMessages = [];      // ciphertext messages for 1-to-1
let activeConnections = {};    // username -> ws
let publicKeys = {};           // username -> base64-encoded public key

wss.on('connection', (ws) => {
  console.log('Client connected via WebSocket.');

  // Immediately send the existing public chat
  ws.send(JSON.stringify({
    type: 'init-public',
    messages: publicMessages
  }));

  // Handle incoming WebSocket messages
  ws.on('message', (data) => {
    try {
      const parsed = JSON.parse(data);

      // 1) Register username => store in activeConnections
      if (parsed.type === 'register-username') {
        activeConnections[parsed.username] = ws;
        console.log(`User "${parsed.username}" registered connection.`);

        // Send relevant private messages for them
        const relevant = privateMessages.filter(
          (pm) => pm.from === parsed.username || pm.to === parsed.username
        );
        ws.send(JSON.stringify({
          type: 'init-private',
          messages: relevant
        }));
      }

      // 2) Register user's public key => store in publicKeys
      else if (parsed.type === 'register-publickey') {
        publicKeys[parsed.username] = parsed.publicKey; 
        console.log(`Stored public key of ${parsed.username}`);
      }

      // 3) Request public key => user A wants user B's key
      else if (parsed.type === 'request-publickey') {
        const fromUser = parsed.from;
        const target = parsed.forUser;

        const pk = publicKeys[target] || null;
        const fromWs = activeConnections[fromUser];
        if (fromWs && fromWs.readyState === fromWs.OPEN) {
          fromWs.send(JSON.stringify({
            type: 'response-publickey',
            username: target,
            publicKey: pk
          }));
        }
      }

      // 4) Public chat => store plaintext
      else if (parsed.type === 'public-chat') {
        const newPublic = {
          username: parsed.username,
          text: parsed.text,  // Not encrypted (plaintext)
          timestamp: new Date().toLocaleTimeString()
        };
        publicMessages.push(newPublic);

        // Broadcast to all
        wss.clients.forEach((client) => {
          if (client.readyState === client.OPEN) {
            client.send(JSON.stringify({
              type: 'public-chat',
              message: newPublic
            }));
          }
        });
      }

      // 5) Private chat => store ciphertext
      else if (parsed.type === 'private-chat') {
        const cipherObj = {
          from: parsed.from,
          to: parsed.to,
          text: parsed.text,  // ciphertext
          timestamp: new Date().toLocaleTimeString()
        };
        privateMessages.push(cipherObj);

        // Deliver to recipient
        const recipientWs = activeConnections[parsed.to];
        if (recipientWs && recipientWs.readyState === recipientWs.OPEN) {
          recipientWs.send(JSON.stringify({
            type: 'private-chat',
            message: cipherObj
          }));
        }

        // Also deliver back to sender (so sender sees their own message)
        const senderWs = activeConnections[parsed.from];
        if (senderWs && senderWs.readyState === senderWs.OPEN) {
          senderWs.send(JSON.stringify({
            type: 'private-chat',
            message: cipherObj
          }));
        }
      }
    } catch (err) {
      console.error('Error parsing message:', err);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected.');
    // If you like, remove them from activeConnections here. We’ll skip for brevity.
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
