const socket = (io) => {
    io.on('connect', (socket) => {
        socket.on('disconnect', () => {
            const userId = socket.userId;
        });

        socket.on('join', (userId) => {
            socket.userId = userId;
            socket.join(userId);
            // handleJoin(userId);
        });

        socket.on('join-room', (room) => {
            room.forEach((id) => socket.join(id));
        });

        socket.on('join-chat', (chatId) => {
            socket.join(chatId);
        });

        socket.on('leave-conversation', (chatId) => {
            socket.leave(chatId);
        });

        socket.on('typing', (chatId, me) => {
            socket.broadcast
                .to(chatId)
                .emit('typing', chatId, me);
        });

        socket.on('not-typing', (chatId, me) => {
            socket.broadcast
                .to(chatId)
                .emit('not-typing', chatId, me);
        });

    });
};

module.exports = socket;
