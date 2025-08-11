const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

let messages = {}; // { roomId: [ { name, text, time, userId, isOwner, theme } ] }
let users = {};    // { socketId: { name, userId, theme, isOwner, roomId } }

io.on('connection', socket => {
  console.log('User connected:', socket.id);

  socket.on('setUserInfo', ({ name, userId, theme, isOwner, roomId }) => {
    users[socket.id] = { name, userId, theme, isOwner, roomId: roomId || "main" };
    socket.join(users[socket.id].roomId);

    if (!messages[users[socket.id].roomId]) {
      messages[users[socket.id].roomId] = [];
    }

    io.to(users[socket.id].roomId).emit('onlineUsers',
      Object.values(users).filter(u => u.roomId === users[socket.id].roomId)
    );

    // Send chat history for that room
    socket.emit('chatHistory', messages[users[socket.id].roomId]);
  });

  socket.on('chatMessage', msg => {
    const user = users[socket.id] || {};
    const messageData = {
      name: user.name || 'Unknown',
      text: msg,
      time: new Date().toLocaleString(),
      userId: user.userId || '',
      isOwner: user.isOwner || false,
      theme: user.theme || 'purple'
    };

    if (!messages[user.roomId]) messages[user.roomId] = [];
    messages[user.roomId].push(messageData);

    io.to(user.roomId).emit('chatMessage', messageData);
  });

  socket.on('createGroup', ({ groupId, members }) => {
    // Just join the socket to the group
    socket.leave(users[socket.id].roomId);
    socket.join(groupId);
    users[socket.id].roomId = groupId;

    if (!messages[groupId]) messages[groupId] = [];
    socket.emit('chatHistory', messages[groupId]);

    io.to(groupId).emit('onlineUsers',
      Object.values(users).filter(u => u.roomId === groupId)
    );
  });

  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      delete users[socket.id];
      io.to(user.roomId).emit('onlineUsers',
        Object.values(users).filter(u => u.roomId === user.roomId)
      );
    }
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log('Server is running');
});
