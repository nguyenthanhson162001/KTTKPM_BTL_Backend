const ObjectId = require('mongoose').Types.ObjectId;
const User = require('../../../models/user.model');
const Room = require('../../../models/room.model');
const Message = require('../../../models/message.model');
const objectIdHelper = require('../../../utils/objectId.helper');
const mongodbHelper = require('../../../utils/mongo.helper');
const { validateAddMember, validateDeleteMember, validateLeaveGroup } = require('../validation/room.validation');
const { async } = require('parse/lib/browser/Storage');
const MEMBER_ADD_MESSAGE = 'joined group';

module.exports = async (io, socket) => {
    socket.on('room:join_group', createRoom);
    socket.on('room:join_group_by_link', joinGroupWithLink);
    socket.on('room:add_member', addMemberToRoom);
    socket.on('room:leave_group', leaveRoom);
    socket.on('room:delete_member', deleteMemberOfRoom);
    socket.on('room:add_master_group', addMasterRoom);
    socket.on('room:delete_master_group', deleteMasterRoom);

    async function createRoom(payload) {
        console.log('room:join_group');
        let { room, userIdsTemp } = payload;

        if (!room || !userIdsTemp) {
            console.log('room:join_group=> Missing parameter');
            return;
        }

        if (!io.sockets.adapter.rooms.has(room._id))
            socket.join(room._id);

        for (let i = 0; i < userIdsTemp.length; i++) {
            io.to(userIdsTemp[i]).to(room._id).emit("create-group", room);
            console.log("🚀 ~ file: room.listeners.js ~ line 21 ~ create-group")
        }
    }

    async function addMemberToRoom(payload) {
        console.log('room:add_member');
        const { roomId, userId, newUSerId } = payload;
        let message, room;
        await mongodbHelper.executeTransactionWithRetry({
            async executeCallback(session) {

                if (!roomId || !userId || !newUSerId)
                    throw new Error('room:add_member==> missing parameter');

                await validateAddMember(roomId, userId, newUSerId);

                // tin nhắn thêm vào group
                message = new Message({
                    sender: userId,
                    receiver: newUSerId,
                    message: MEMBER_ADD_MESSAGE,
                    type: 'NOTIFY',
                    room: roomId,
                });

                await message.save({ session });

                let updateMemberRoom = await Room.updateOne(
                    {
                        _id: roomId
                    },
                    {
                        $push: {
                            users: newUSerId,
                            messages: message
                        }
                    }
                );

                if (updateMemberRoom.modifiedCount < 1)
                    throw new Error('Update room data fail!');

                room = await Room.findById(roomId)
                    .select('-createdAt')
                    .populate([
                        {
                            path: 'users',
                            select: '_id username name image'
                        },
                    ]).populate([
                        {
                            path: 'roomMaster',
                            select: '_id username name image'
                        }
                    ]).populate(
                        {
                            path: 'message',
                            match: {
                                $eq: [
                                    { $last: "$message" }
                                ]
                            }
                        }
                    ).lean();

                newUSerId.forEach(async (userIdEle) => {
                    const updateNewUser = await User.updateOne(
                        { _id: userIdEle },
                        {
                            $push: {
                                rooms: roomId
                            }
                        }
                    );
                    if (updateNewUser.modifiedCount < 1) throw new Error('Update user data fails');
                });
            },
            successCallback() {
                io.to(roomId).emit('chat:print_message', {
                    roomId,
                    userId,
                    username: socket.handshake.auth.username,
                    message,
                });

                newUSerId.forEach((userIdEle) =>
                    io.to(userIdEle).emit('create-group', room)
                );

                io.to(roomId).emit('update-member', room);
            },
            errorCallback(error) {
                console.log(error);
                socket.emit('error', error.message);
            }
        });

    }

    async function leaveRoom(payload) {
        const { roomId, userId } = payload;
        let message, room;
        await mongodbHelper.executeTransactionWithRetry({
            async executeCallback(session) {
                if (!roomId || !userId)
                    throw new Error('room:leave-room ==> missing parameter');

                await validateLeaveGroup(roomId, userId);

                let [updateRoom, updateUser] = await Promise.all([
                    Room.updateOne(
                        {
                            _id: roomId
                        },
                        {
                            $pull: {
                                users: userId
                            }
                        }
                    ),
                    User.updateOne(
                        {
                            _id: userId
                        },
                        {
                            $pull: {
                                rooms: roomId
                            }
                        }
                    )
                ]);

                if (updateRoom.modifiedCount < 1 || updateUser.modifiedCount < 1)
                    throw new Error('Update data room fail');

                console.log("🚀 ~ file: room.listeners.js ~ line 145 ~ executeCallback ~ updateRoom.modifiedCount" + updateRoom.modifiedCount < 1 ? 'fail' : 'success');
                console.log("🚀 ~ file: room.listeners.js ~ line 145 ~ executeCallback ~ updateUser.modifiedCount" + updateUser.modifiedCount < 1 ? 'fail' : 'success');
                const { username } = await User.findById(userId);
                message = new Message({
                    sender: userId,
                    message: `${username} has leave group`,
                    type: 'NOTIFY',
                    room: roomId
                });
                await message.save({ session });

                await Room.updateOne(
                    {
                        _id: roomId
                    },
                    {
                        $push: {
                            messages: message
                        }
                    }
                ).then();

                room = await Room.findById(roomId)
                    .select('-createdAt')
                    .populate([
                        {
                            path: 'users',
                            select: '_id username name image'
                        },
                    ]).populate([
                        {
                            path: 'roomMaster',
                            select: '_id username name image'
                        }
                    ]).populate(
                        {
                            path: 'message',
                            match: {
                                $eq: [
                                    { $last: "$message" }
                                ]
                            }
                        }
                    ).lean();
            },
            successCallback() {
                io.to(roomId).emit('chat:print_message', {
                    roomId,
                    userId,
                    username: socket.handshake.auth.username,
                    message,
                });
                io.to(roomId).emit('update-member', room);
            },
            errorCallback(error) {
                console.log(error);
                socket.emit('error', error.message);
            }
        });
    }

    async function deleteMemberOfRoom(payload) {
        const { roomId, managerId, userId, usernameManager } = payload;
        let message, room;

        await mongodbHelper.executeTransactionWithRetry({
            async executeCallback(session) {
                if (!roomId || !userId || !managerId)
                    throw new Error('room:delete_member==> missing parameter');

                room = await validateDeleteMember(roomId, managerId, userId);

                const [updateRoom, updateUser] = await Promise.all([
                    Room.updateOne(
                        { _id: roomId },
                        {
                            $pull: {
                                users: userId
                            }
                        }
                    ),
                    User.updateOne(
                        {
                            _id: userId
                        },
                        {
                            $pull: {
                                rooms: roomId
                            }
                        }
                    )
                ]);
                if (updateRoom.modifiedCount < 1 || updateUser.modifiedCount < 1)
                    throw new Error('Update data fail!');
                console.log("🚀 ~ file: room.listeners.js ~ line 213 ~ executeCallback ~ updateUser" + updateUser.modifiedCount < 1 ? 'fail' : 'success');
                console.log("🚀 ~ file: room.listeners.js ~ line 213 ~ executeCallback ~ updateRoom" + updateRoom.modifiedCount < 1 ? 'fail' : 'success');

                const { username } = await User.findById(userId);
                message = new Message({
                    sender: managerId,
                    message: `${usernameManager} has kick ${username} out of group`,
                    type: 'NOTIFY',
                    room: roomId
                });
                await message.save({ session });

                await Room.updateOne(
                    {
                        _id: roomId
                    },
                    {
                        $push: {
                            messages: message
                        }
                    }
                ).then();

                room = await Room.findById(roomId)
                    .select('-createdAt')
                    .populate([
                        {
                            path: 'users',
                            select: '_id username name image'
                        },
                    ]).populate([
                        {
                            path: 'roomMaster',
                            select: '_id username name image'
                        }
                    ]).populate(
                        {
                            path: 'message',
                            match: {
                                $eq: [
                                    { $last: "$message" }
                                ]
                            }
                        }
                    ).lean();

            },
            successCallback() {
                io.to(roomId).emit('chat:print_message', {
                    roomId,
                    userId,
                    username: socket.handshake.auth.username,
                    message
                });
                io.to(roomId).emit('update-member', room);
                io.to(userId).emit('delete-group', room);
            },
            errorCallback(error) {
                console.log(error);
                socket.emit('error', error.message);
            }
        });

    }

    async function joinGroupWithLink(payload) {
        const { roomId, userId } = payload;
        let message, room;

        await mongodbHelper.executeTransactionWithRetry({
            async executeCallback(session) {
                if (!roomId || !userId || !managerId)
                    throw new Error('room:join group by link==> missing parameter');

                room = await Room.findById(roomId);
                if (!room)
                    throw new Error('Room not found!');

                const { users } = room;
                if (users.includes(userId))
                    throw new Error('You have exist in room!');

                const [updateRoom, updateUser] = await Promise.all([
                    Room.updateOne(
                        {
                            _id: room._id
                        },
                        {
                            $push: {
                                users: userId
                            }
                        }
                    ),
                    User.updateOne(
                        {
                            _id: userId
                        },
                        {
                            $push: {
                                rooms: room._id
                            }
                        }
                    )
                ]);

                if (updateRoom.modifiedCount < 1 || updateUser.modifiedCount < 1)
                    throw new Error('Update data fail!');
                console.log("🚀 ~ file: room.listeners.js ~ line 213 ~ executeCallback ~ updateUser" + updateUser.modifiedCount < 1 ? 'fail' : 'success');
                console.log("🚀 ~ file: room.listeners.js ~ line 213 ~ executeCallback ~ updateRoom" + updateRoom.modifiedCount < 1 ? 'fail' : 'success');

                const { username } = await User.findById(userId);
                message = new Message({
                    sender: userId,
                    message: `${username} has join group by link`,
                    type: 'NOTIFY',
                    room: roomId
                });
                await message.save({ session });

                await Room.updateOne(
                    {
                        _id: roomId
                    },
                    {
                        $push: {
                            messages: message
                        }
                    }
                ).then();

                room = await Room.findById(roomId)
                    .select('-createdAt')
                    .populate([
                        {
                            path: 'users',
                            select: '_id username name image'
                        },
                    ]).populate([
                        {
                            path: 'roomMaster',
                            select: '_id username name image'
                        }
                    ]).populate(
                        {
                            path: 'message',
                            match: {
                                $eq: [
                                    { $last: "$message" }
                                ]
                            }
                        }
                    ).lean();

            },
            successCallback() {
                io.to(roomId).emit('chat:print_message', {
                    roomId,
                    userId,
                    username: socket.handshake.auth.username,
                    message
                });
                io.to(roomId).emit('update-member', room);
                io.to(userId).emit("create-group", room);
            },
            errorCallback(error) {
                console.log(error);
                socket.emit('error', error.message);
            }
        });

    }

    async function addMasterRoom(payload) {
        const { roomId, userId, newMasterId } = payload;
        let message, room;

        await mongodbHelper.executeTransactionWithRetry({
            async executeCallback(session) {
                if (!roomId || !userId || !newMasterId)
                    throw new Error('room:add_new_master_room==> missing parameter');

                room = await Room.findById(roomId);
                if (!room)
                    throw new Error('Room not found!');

                const { users, roomMaster } = room;
                if (!roomMaster.includes(userId))
                    throw new Error('You is not mater of group');

                if (!users.includes(newMasterId))
                    throw new Error('User is not member of group');

                if (roomMaster.includes(newMasterId))
                    throw new Error('User was master of group');

                const [updateRoom] = await Promise.all([
                    Room.updateOne(
                        {
                            _id: room._id
                        },
                        {
                            $push: {
                                roomMaster: newMasterId
                            }
                        }
                    )
                ]);

                if (updateRoom.modifiedCount < 1)
                    throw new Error('Update data fail!');
                console.log("🚀 ~ file: room.listeners.js ~ line 213 ~ executeCallback ~ updateRoom" + updateRoom.modifiedCount < 1 ? 'fail' : 'success');

                const { username } = await User.findById(newMasterId);
                message = new Message({
                    sender: newMasterId,
                    message: `${username} has become master of group`,
                    type: 'NOTIFY',
                    room: roomId
                });

                await Room.updateOne(
                    {
                        _id: roomId
                    },
                    {
                        $push: {
                            messages: message
                        }
                    }
                ).then();

            },
            successCallback() {
                io.to(roomId).emit('chat:print_message', {
                    roomId,
                    userId,
                    username: socket.handshake.auth.username,
                    message
                });
                io.to(newMasterId).emit('add-master', room);
            },
            errorCallback(error) {
                console.log(error);
                socket.emit('error', error.message);
            }
        });
    }

    async function deleteMasterRoom(payload) {
        const { roomId, userId, delMasterId } = payload;
        let message, room;

        await mongodbHelper.executeTransactionWithRetry({
            async executeCallback(session) {
                if (!roomId || !userId || !delMasterId)
                    throw new Error('room:add_new_master_room==> missing parameter');

                room = await Room.findById(roomId);
                if (!room)
                    throw new Error('Room not found!');

                const { users, roomMaster } = room;
                if (!roomMaster.includes(userId))
                    throw new Error('You is not mater of group');

                if (!users.includes(delMasterId))
                    throw new Error('User is not member of group');

                if (!roomMaster.includes(delMasterId))
                    throw new Error('User is not master of group');

                const [updateRoom] = await Promise.all([
                    Room.updateOne(
                        {
                            _id: room._id
                        },
                        {
                            $pull: {
                                roomMaster: delMasterId
                            }
                        }
                    )
                ]);

                if (updateRoom.modifiedCount < 1)
                    throw new Error('Update data fail!');
                console.log("🚀 ~ file: room.listeners.js ~ line 213 ~ executeCallback ~ updateRoom" + updateRoom.modifiedCount < 1 ? 'fail' : 'success');

                const { username } = await User.findById(delMasterId);
                message = new Message({
                    sender: delMasterId,
                    message: `${username} is no longer master of group`,
                    type: 'NOTIFY',
                    room: roomId
                });

                room = await Room.updateOne(
                    {
                        _id: roomId
                    },
                    {
                        $push: {
                            messages: message
                        }
                    }
                ).then();

            },
            successCallback() {
                io.to(roomId).emit('chat:print_message', {
                    roomId,
                    userId,
                    username: socket.handshake.auth.username,
                    message
                });
                io.to(delMasterId).emit('delete-master', room);

            },
            errorCallback(error) {
                console.log(error);
                socket.emit('error', error.message);
            }
        });
    }

};