const ObjectId = require('mongoose').Types.ObjectId;
const multer = require('multer');
const User = require('../../../models/user.model');
const Room = require('../../../models/room.model');
const Message = require('../../../models/message.model');
const objectIdHelper = require('../../../utils/objectId.helper');
const mongodbHelper = require('../../../utils/mongo.helper');
const awsS3Helper = require('../../../utils/awss3.helper');
const { validateMessageRoom } = require('../validation/message.validation');
async function validateRoom(roomId, user1, user2) {
    const room = await Room.findById(roomId);
    const { users } = room;
    if (!users.includes(user1))
        return false;
    if (!users.includes(user2))
        return false;
    return true;
}

const storage = multer.memoryStorage({
    destination: (req, file, cb) => {
        cb(null, "");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    },
});

module.exports = (io, socket) => {
    // socket send message
    socket.on('chat:send_message', async payload => {
        console.log('chat:send_message');
        let { username, userId, roomId, content, type } = payload;

        if (!(username && userId && roomId && content)) {
            console.log('chat:send_message => Missing parameters');
            return;
        }
        const userSender = await User.findById(socket.handshake.auth.userId);

        let message;

        await mongodbHelper.executeTransactionWithRetry({
            async executeCallback(session) {
                //create message from content
                message = new Message({
                    sender: userSender.username,
                    type: type === null ? 'TEXT' : type,
                    receiver: userId,
                    room: roomId,
                    message: content
                });
                console.log(`create message: ${JSON.stringify(message)}`);
                console.log('send message: validate value: ' + ` roomid: ${roomId}, userid: ${userId}, idfromsocket:  ${socket.handshake.auth.userId}`)
                let validate = await validateRoom(roomId, userId, socket.handshake.auth.userId);

                if (validate === null) {
                    let [createRoom, userUpdateStatus, messageSave] = await Promise.all([
                        Room.create(
                            {
                                _id: roomId,
                                users: [socket.handshake.auth.userId, userId]
                            },
                            {
                                $push: {
                                    messages: message
                                }
                            },
                            { session }
                        ),
                        User.updateMany(
                            {
                                _id: { $in: [socket.handshake.auth.userId, userId] }
                            },
                            {
                                $push: { rooms: roomId }
                            },
                            { session }
                        ),
                        message.save({ session })
                    ]);

                    if (createRoom.modifiedCount < 1) throw new Error('Add message to room failed');
                    if (messageSave.modifiedCount < 1) throw new Error('Add new message failed');
                } else if (validate === false) throw new Error('Unauthorized');

                let [updateRoom, saveMessage] = await Promise.all([
                    Room.updateOne(
                        {
                            _id: roomId,
                        },
                        {
                            $push: {
                                messages: message
                            }
                        },
                        { session }
                    ),
                    message.save({ session })
                ]);

                if (updateRoom.modifiedCount < 1) throw new Error('Add message to room failed');
                if (saveMessage.modifiedCount < 1) throw new Error('Add message failed');
            },
            successCallback() {
                io.to(roomId).emit('chat:print_message', {
                    roomId,
                    userId,
                    username: socket.handshake.auth.username,
                    message,
                });
            },
            errorCallback(error) {
                console.log(error.message);
                socket.emit('error');
            }
        });
    });

    // from Sender
    socket.on('chat:call_user', async payload => {
        console.log('chat:call_user');
        let { username, userId, roomId, signal } = payload;

        if (!(username && userId && roomId && signal)) {
            console.log('chat:call_user => Missing parameters');
            return;
        }
        const userSender = await User.findById(socket.handshake.auth.userId);
        setTimeout(() => {
            io.to(roomId).emit("chat:new_call", {
                signal,
                roomId,
                userId,
                username: socket.handshake.auth.username,
                avatar: userSender.avatar
            });
        });
    });

    //from receiver call video
    socket.on("chat:answer_call", async payload => {
        console.log('chat:answer_call');
        let { username, userId, roomId, signal } = payload;

        if (!(username && userId && roomId && signal)) {
            console.log('chat:answer_call => Missing parameters');
            return;
        }

        const userReceive = await User.findById(socket.handshake.auth.userId);
        setTimeout(() => {
            io.to(roomId).emit('chat:call_accepted', {
                signal,
                roomId,
                userId,
                username: socket.handshake.auth.username,
                avatar: userReceive.avatar
            });
            io.to(roomId).emit('chat:call_decline', {
                signal,
                roomId,
                userId,
                username: socket.handshake.auth.username,
                avatar: userReceive.avatar
            });
        });
    });

    socket.on('chat:delete-message', async payload => {
        const { messageId, roomId } = payload;
        if (!messageId) {
            console.log("chat:delete-message ===> Missing parameter");
            return;
        }

        io.to(roomId).emit('delete-message', { messageId, roomId });
    });

    socket.on('chat:reply-message', async payload => {
        const {
            roomId,
            ownerMessageId, ownerMessageUsername,
            messageId,
            replyMessageId, replyMessageUsername,
            content
        } = payload;

        if (!roomId || !ownerMessageId || !ownerMessageUsername || !messageId || !replyMessageId || !replyMessageUsername || !content)
            throw new Error('chat:reply-message ==> Missing parameter');

        let reply, notification;
        await mongodbHelper.executeTransactionWithRetry({
            async executeCallback(session) {
                reply = new Rep
                let validate = await validateRoom(roomId, userId, socket.handshake.auth.userId);

                if (validate === null) {
                    let [createRoom, userUpdateStatus, messageSave] = await Promise.all([
                        Room.create(
                            {
                                _id: roomId,
                                users: [socket.handshake.auth.userId, userId]
                            },
                            {
                                $push: {
                                    messages: message
                                }
                            },
                            { session }
                        ),
                        User.updateMany(
                            {
                                _id: { $in: [socket.handshake.auth.userId, userId] }
                            },
                            {
                                $push: { rooms: roomId }
                            },
                            { session }
                        ),
                        message.save({ session })
                    ]);

                    if (createRoom.modifiedCount < 1) throw new Error('Add message to room failed');
                    if (messageSave.modifiedCount < 1) throw new Error('Add new message failed');
                } else if (validate === false) throw new Error('Unauthorized');

                let [updateRoom, saveMessage] = await Promise.all([
                    Room.updateOne(
                        {
                            _id: roomId,
                        },
                        {
                            $push: {
                                messages: message
                            }
                        },
                        { session }
                    ),
                    message.save({ session })
                ]);

                if (updateRoom.modifiedCount < 1) throw new Error('Add message to room failed');
                if (saveMessage.modifiedCount < 1) throw new Error('Add message failed');
            },
            successCallback() {
                io.to(roomId).emit('chat:print_message', {
                    roomId,
                    userId,
                    username: socket.handshake.auth.username,
                    message,
                });
            },
            errorCallback(error) {
                console.log(error.message);
                socket.emit('error');
            }
        });
    });

    socket.on('chat:pin-message', async payload => {
        const { messageId, roomId } = payload;
        if (!messageId || !roomId)
            throw new Error('chat:pin-message ==> Missing parameter!');
        let { room, user, messagePin } = await validateMessageRoom(roomId, messageId, socket.handshake.auth.userId);
        let message;
        await mongodbHelper.executeTransactionWithRetry({
            async executeCallback(session) {
                room.pinMessage.forEach(element => {
                    if (objectIdHelper.compare(element._id, messageId))
                        throw new Error('Message is pinned');
                });
                message = new Message({
                    sender: socket.handshake.auth.userId,
                    message: `${user.username} pinned message ${messagePin.message}`,
                    type: 'NOTIFY',
                    room: roomId,
                });

                await message.save({ session });

                const updateRoom = await Room.updateOne(
                    {
                        _id: roomId
                    },
                    {
                        $push: {
                            messages: message,
                            pinMessage: messagePin
                        }
                    }
                );

                if (updateRoom.modifiedCount < 1)
                    throw new Error('chat:pin-message ==> Update data fail');

            },
            successCallback() {
                io.to(roomId).emit('chat:print_message', {
                    roomId,
                    userId: socket.handshake.auth.userId,
                    username: socket.handshake.auth.username,
                    message,
                });
                io.to(roomId).emit('chat:update-pin-message', {
                    messagePin, room
                })
            },
            errorCallback(error) {
                console.log(error.message);
                socket.emit('error');
            }
        });
    });

    socket.on('chat:delete-pin-message', async payload => {
        const { messageId, roomId } = payload;
        if (!messageId || !roomId)
            throw new Error('chat:delete-pin-message ==> Missing parameter!');
        let { room, user, messagePin } = await validateMessageRoom(roomId, messageId, socket.handshake.auth.userId);
        let message;
        await mongodbHelper.executeTransactionWithRetry({
            async executeCallback(session) {
                let isPin = false;
                room.pinMessage.forEach(element => {
                    if (objectIdHelper.compare(element._id, messagePin._id))
                        isPin = true;
                });

                if (isPin === false)
                    throw new Error('Message id not pinned');

                message = new Message({
                    sender: socket.handshake.auth.userId,
                    message: `${user.username} unpinned message ${messagePin.message}`,
                    type: 'NOTIFY',
                    room: roomId,
                });

                await message.save({ session });

                const updateRoom = await Room.updateMany(
                    {
                        _id: roomId
                    },
                    {
                        $push: {
                            messages: message,
                        },
                        $pull: {
                            pinMessage: messagePin
                        }
                    }
                );

                if (updateRoom.modifiedCount < 1)
                    throw new Error('chat:pin-message ==> Update data fail');
            },
            successCallback() {
                io.to(roomId).emit('chat:print_message', {
                    roomId,
                    userId: socket.handshake.auth.userId,
                    username: socket.handshake.auth.username,
                    message,
                });
                io.to(roomId).emit('chat:update-pin-message', {
                    messagePin, room
                })
            },
            errorCallback(error) {
                console.log(error.message);
                socket.emit('error');
            }
        });
    });

};
