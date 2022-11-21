const Room = require('../../../models/room.model');
const User = require('../../../models/user.model');
const ObjectId = require('mongoose').Types.ObjectId;

const roomValidation = {
    validateAddMember: async (roomId, userId, newUserIds) => {
        if (newUserIds.length <= 0) throw new Error('User must > 0');

        const room = await Room.findOne({
            _id: ObjectId(roomId),
            group: true
        });

        if (!room)
            throw new Error('Room not found');

        const { roomMaster, users } = room;
        console.log("🚀 ~ file: room.validation.js ~ line 40 ~ validateAddMember: ~ roomMaster", roomMaster)

        if (!roomMaster.includes(userId))
            throw new Error('You is not manager of group, can not add user');

        const a = await User.checkByIds(newUserIds);

        if (users.includes(newUserIds))
            throw new Error('User exists in group');

        return room;

    },

    validateLeaveGroup: async (roomId, userId) => {
        console.log("🚀 ~ file: room.validation.js ~ line 30 ~ validateLeaveGroup: ~ userId", userId)
        // check  có trong nhóm không
        const room = await Room.findById(roomId);
        if (!roomId)
            throw new Error('Room not found!');

        const { users } = room
        console.log("🚀 ~ file: room.validation.js ~ line 38 ~ validateLeaveGroup: ~ users", users)
        if (!users.includes(userId))
            throw new Error('User is does not exist in room');

        // if (!room.users.includes(userId))
        //     throw new Error('User is does not exist in room');

        return room;
    },
    validateDeleteMember: async (roomId, userId, deleteUserId) => {
        if (userId === deleteUserId) throw new Error('Not delete your');

        const room = await Room.findOne({
            _id: ObjectId(roomId),
            group: true
        });

        if (!room)
            throw new Error('Room not found');

        // chỉ leader mới được xóa
        const { type, roomMaster, users } = room;
        if (!roomMaster.includes(userId))
            throw new Error('You is not manager!');

        if (!users.includes(deleteUserId)) throw new Error('User not exists in group');
        return room;
    },
};

module.exports = roomValidation;