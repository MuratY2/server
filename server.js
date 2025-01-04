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
let publicMessages = [];      // For global (plaintext) chat
let privateMessages = [];     // Now each message has 2 ciphertext fields
let activeConnections = {};   // username -> ws
let publicKeys = {};          // username -> base64 public key

wss.on('connection', (ws) => {
  console.log('Client connected via WebSocket.');

  // Send existing public chat to new connections
  ws.send(JSON.stringify({
    type: 'init-public',
    messages: publicMessages
  }));

  ws.on('message', (data) => {
    try {
      const parsed = JSON.parse(data);

      // 1) Register username
      if (parsed.type === 'register-username') {
        activeConnections[parsed.username] = ws;
        console.log(`User "${parsed.username}" registered connection.`);

        // Send them their relevant private messages
        const relevant = privateMessages.filter(
          (pm) => pm.from === parsed.username || pm.to === parsed.username
        );
        ws.send(JSON.stringify({
          type: 'init-private',
          messages: relevant
        }));
      }

      // 2) Store public key
      else if (parsed.type === 'register-publickey') {
        publicKeys[parsed.username] = parsed.publicKey;
        console.log(`Stored public key of ${parsed.username}`);
      }

      // 3) Provide public key on request
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

      // 4) Public chat (plaintext)
      else if (parsed.type === 'public-chat') {
        const newPub = {
          username: parsed.username,
          text: parsed.text,
          timestamp: new Date().toLocaleTimeString()
        };
        publicMessages.push(newPub);

        // Broadcast to all
        wss.clients.forEach((client) => {
          if (client.readyState === client.OPEN) {
            client.send(JSON.stringify({
              type: 'public-chat',
              message: newPub
            }));
          }
        });
      }

      // 5) Private chat (two ciphertexts)
      //    The client sends:
      //    { from, to, text_for_recipient, text_for_sender, ... }
      else if (parsed.type === 'private-chat') {
        const newPM = {
          from: parsed.from,
          to: parsed.to,
          text_for_recipient: parsed.text_for_recipient,
          text_for_sender: parsed.text_for_sender,
          timestamp: new Date().toLocaleTimeString()
        };
        privateMessages.push(newPM);

        // Deliver to recipient if online
        const recipientWs = activeConnections[parsed.to];
        if (recipientWs && recipientWs.readyState === recipientWs.OPEN) {
          recipientWs.send(JSON.stringify({
            type: 'private-chat',
            message: newPM
          }));
        }

        // Also deliver back to sender
        const senderWs = activeConnections[parsed.from];
        if (senderWs && senderWs.readyState === senderWs.OPEN) {
          senderWs.send(JSON.stringify({
            type: 'private-chat',
            message: newPM
          }));
        }
      }
    } catch (err) {
      console.error('Error parsing WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected.');
    // Optionally remove them from activeConnections if you want.
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`WebSocket server listening on port ${PORT}`);
});
