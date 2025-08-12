let messages = {}; // room messages
let users = {};    // connected users
let timeouts = {}; // { userId: timestampWhenTimeoutEnds }

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

    socket.emit('chatHistory', messages[users[socket.id].roomId]);
  });

  socket.on('chatMessage', msg => {
    const user = users[socket.id] || {};

    // Prevent sending if timed out
    if (timeouts[user.userId] && Date.now() < timeouts[user.userId]) {
      socket.emit('timeoutWarning', { remaining: timeouts[user.userId] - Date.now() });
      return;
    }

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

  // Owner sets timeout
  socket.on('setTimeoutStatus', ({ targetUserId, durationMs }) => {
    const sender = users[socket.id];
    if (!sender?.isOwner) return; // Only owners can timeout

    timeouts[targetUserId] = Date.now() + durationMs;

    // Tell that user they're timed out
    Object.entries(users).forEach(([id, u]) => {
      if (u.userId === targetUserId) {
        io.to(id).emit('timedOut', { until: timeouts[targetUserId] });
      }
    });
  });

  socket.on('createGroup', ({ groupId, members }) => {
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
