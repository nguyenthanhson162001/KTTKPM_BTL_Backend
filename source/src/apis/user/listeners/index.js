const messageHandlerRegister = require('./message.listeners');
const homeHandlerRegister = require('./home.listeners');
const roomHandleRegister = require('../listeners/room.listeners');
const authenJwtMiddleware = require('../middlewares/authenJWT.middleware').socket;
const User = require('../../../models/user.model');
const Room = require('../../../models/room.model');
const objectIdHelper = require('mongoose').Types.ObjectId;
const Notification = require('../../../models/notification.model');
const Request = require('../../../models/request.model');
const mongodHelper = require('../../../utils/mongo.helper');
const { obj } = require('../../../models/shemas/auth');

const addSokectIdToUser = async (socketId, userId) => {
    const user = await User.findById(userId);
    if (socketId)
        user.socketId = socketId;

    await user.save();
}

async function getAllRoomById(user_id) {
    const _id = objectIdHelper(user_id);
    const rooms = await Room.find({
        users: { $in: [_id] },
    });
    // console.log("🚀 ~ file: index.js ~ line 26 ~ getAllRoomById ~ rooms", rooms)

    return rooms;
}

async function removeSocketIdInDB(user_id) {
    const user = await User.findById(user_id);
    user.socketId = "";
    await user.save();
}
const getUserFromSocket = async (userId) => {
    const user = await User.findById(userId);
    return user;
}

module.exports = async io => {
    io.use(authenJwtMiddleware)
    await io.on('connection', socket => {
        console.log(`Socket ID ${socket.id} connect!`);
        socket.join(socket.handshake.auth.userId);
        addSokectIdToUser(socket.id, socket.handshake.auth.userId);
        let rooms = getAllRoomById(socket.handshake.auth.userId);
        let userInfo = getUserFromSocket(socket.handshake.auth.userId);

        socket.on('disconnect', () => {
            removeSocketIdInDB(socket.handshake.auth.userId);
            console.log(`Socket ID ${socket.id} disconnect!`);
        });

        rooms.then(function (result) {
            for (let i = 0; i < result.length; i++) {
                const idRoom = result[i]._id.toString();
                socket.join(idRoom);
            }
            console.log(socket.adapter.rooms);
        });

        socket.on('user:add_friend_request', addFriendRequest);
        socket.on('user:accept_add_friend', acceptAddFriend);
        socket.on('chat:send_image', handleImage);

        // add friend request
        async function addFriendRequest(payload) {
            console.log("addfriend ");

            const { receivedUserId, receivedUsername } = payload;
            if (!receivedUserId) {
                console.log('user:add_friend_request => Missing parameters');
                return;
            }

            let notification;
            await mongodHelper.executeTransactionWithRetry({
                async executeCallback(session) {
                    if (
                        await Request.findOne({
                            type: 'ADD_FRIEND',
                            from: socket.handshake.auth.userId,
                            to: receivedUserId
                        })
                    )
                        throw new Error('Add friend request have sent before');

                    let userFriend = await User.findOne({ _id: socket.handshake.auth.userId })
                        .select('friends')
                        .lean();


                    let userAdd = await User.findOne({ _id: receivedUserId });
                    const userRequest = await User.findOne({ _id: socket.handshake.auth.userId });
                    if (!userAdd)
                        throw new Error('User does not exixt!!');

                    if (userFriend.friends.includes(receivedUserId))
                        throw new Error('You were friend!!');


                    notification = new Notification({
                        user: receivedUserId,
                        requestedUserId: socket.handshake.auth.userId,
                        requestAccount: userRequest.username,
                        requestUserName: userRequest.name,
                        type: 'ADD_FRIEND_REQUEST',
                        relatedUsers: {
                            from: userRequest.username,
                            to: userAdd.username
                        },
                        tag: [socket.handshake.auth.userId]
                    });

                    let request = new Request({
                        from: socket.handshake.auth.userId,
                        fromUsername: userRequest.username,
                        to: receivedUserId,
                        toUsername: userAdd.username
                    });

                    let [savedNotification, savedRequest, receivedUser] = await Promise.all([
                        notification.save({ session }),
                        request.save({ session }),
                        User.updateOne(
                            {
                                _id: receivedUserId
                            },
                            {
                                $push: {
                                    notifications: notification._id
                                }
                            },
                            { session }
                        )
                    ]);

                    console.log('Accept add friend result');
                    console.log(
                        `Notification create ${savedNotification === notification ? 'successful' : 'failed'
                        }!`
                    );
                    console.log(
                        `Request create ${savedRequest === request ? 'successful' : 'failed'}!`
                    );
                    console.log(
                        `Notification in received user ${receivedUser.modifiedCount === 1 ? 'saved' : 'unsaved'
                        }`
                    );
                    console.log('OK');
                    if (
                        savedNotification !== notification ||
                        savedRequest !== request ||
                        receivedUser.modifiedCount < 1
                    )
                        throw new Error('Store data failed');
                },
                successCallback() {
                    // if (!io.sockets.adapter.rooms.has(receivedUserId))
                    const user = User.findById(receivedUserId);
                    io.to(receivedUserId).to(user.socketId).emit('user:print_notification', {
                        notification
                    });
                },
                errorCallback(error) {
                    console.log(error);
                    socket.emit('error', error.message);
                }
            });
        }

        // accept addfriend reuest
        async function acceptAddFriend(payload) {
            let { userId, username, room } = payload;
            if (!userId || !username | !room) {
                console.log('user:accept_add_friend => Missing parameters');
                return;
            }
            console.log("🚀 ~ file: index.js ~ line 181 ~ acceptAddFriend ~ io.sockets.adapter.rooms.has(userId)", io.sockets.adapter.rooms.has(userId))
            if (io.sockets.adapter.rooms.has(userId))
                socket.to(userId).emit('home:friend_connect', { userId, username, room });
        }

        // send file Mesagse
        async function handleImage(payLoad) {
            let { userId, roomId, message } = payLoad;
            if (!message || !roomId) {
                console.log('chat:send_image');
                return;
            }
            if (io.sockets.adapter.rooms.has(roomId))
                socket.to(roomId).emit('chat:print_message', {
                    roomId,
                    userId,
                    username: socket.handshake.auth.username,
                    message: message
                });
        }

        // get list friend 
        let listFriendsOnline = getListFriendsOnline(socket.handshake.auth.userId);

        if (listFriendsOnline.length > 0) {
            console.log(userInfo);
            socket.emit('home:list_friend_online', listFriendsOnline);
            io.to(listFriendsOnline.map(friend => friend._id)).emit('home:friend_connect', userInfo);
        }
        async function getListFriendsOnline(_id) {
            let user = await User.aggregate([
                {
                    '$match': {
                        '_id': objectIdHelper(_id)
                    }
                }, {
                    '$lookup': {
                        'from': 'users',
                        'localField': 'friends',
                        'foreignField': '_id',
                        'as': 'friends'
                    }
                }, {
                    '$project': {
                        '_id': 0,
                        'friends': {
                            '$map': {
                                'input': '$friends',
                                'in': {
                                    '_id': {
                                        '$toString': '$$this._id'
                                    },
                                    'username': '$$this.username',
                                    'name': '$$this.name'
                                }
                            }
                        }
                    }
                }
            ]);
            console.log("dong 237" + JSON.stringify(user))
            return user[0].friends.filter(friend => io.sockets.adapter.rooms.has(friend.username));
        }

        socket.on("join-room-after-acceptFriend", (data) => {
            socket.join(data.room._id);
        });

        socket.on('leave-chat', (roomId) => {
            socket.leave(roomId);
        });

        socket.on('typing', (conversationId, me) => {
            socket.broadcast
                .to(conversationId)
                .emit('typing', conversationId, me);
        });

        socket.on('not-typing', (conversationId, me) => {
            socket.broadcast
                .to(conversationId)
                .emit('not-typing', conversationId, me);
        });

        messageHandlerRegister(io, socket);
        roomHandleRegister(io, socket);
    });
};


