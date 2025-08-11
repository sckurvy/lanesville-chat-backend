const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

let messages = [];
let users = {};

io.on('connection', socket => {
  console.log('User connected:', socket.id);

  socket.on('setName', name => {
    users[socket.id] = name;
    io.emit('onlineUsers', Object.values(users));
  });

  socket.emit('chatHistory', messages);

  socket.on('chatMessage', msg => {
    const messageData = {
      name: users[socket.id] || 'Unknown',
      text: msg,
      time: new Date().toLocaleString()
    };
    messages.push(messageData);
    io.emit('chatMessage', messageData);
  });

  socket.on('disconnect', () => {
    delete users[socket.id];
    io.emit('onlineUsers', Object.values(users));
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log('Server is running');
});
