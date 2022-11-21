const Message = require('../../../models/message.model');
const Room = require('../../../models/room.model');
const User = require('../../../models/user.model');
const objectIdHelper = require('../../../utils/objectId.helper');

module.exports = {

    validateFileMessage: async (
        file,
        type,
    ) => {
        if (type !== 'IMAGE' && type !== 'VIDEO' && type !== 'FILE')
            throw new Error('Type only IMAGE, VIDEO, FILE');

        const { mimetype } = file;

        if (type === 'IMAGE')
            if (
                mimetype !== 'image/png' &&
                mimetype !== 'image/jpeg' &&
                mimetype !== 'image/gif' && mimetype !== 'image/jpg'
            )
                throw new Error('Image mimetype invalid');

        if (type === 'VIDEO')
            if (mimetype !== 'video/mp3' && mimetype !== 'video/mp4')
                throw new Error('Video mimetype invalid');

        if (type === 'FILE')
            if (
                mimetype !== 'application/pdf' &&
                mimetype !== 'application/msword' &&
                mimetype !==
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document' &&
                mimetype !== 'application/vnd.ms-powerpoint' &&
                mimetype !==
                'application/vnd.openxmlformats-officedocument.presentationml.presentation' &&
                mimetype !== 'application/vnd.rar' &&
                mimetype !== 'application/zip'
            )
                throw new Error('File mimetype invalid');
    },

    validateMessageRoom: async (roomId, messageId, userId) => {
        if (!(roomId && messageId && userId))
            throw new Error('validation message -> missing parameter');

        const room = await Room.findOne({ _id: roomId });
        const { users, messages } = room;
        if (!room)
            throw new Error('validation message -> room not found');

        const user = User.findById(userId);
        if (!user)
            throw new Error('validation message -> user not found');

        const messagePin = await Message.findOne({ _id: messageId });
        if (!messagePin)
            throw new Error('validation message -> message not found');

        if (!users.includes(userId))
            throw new Error('validation message -> You not member in this room');

        // messages.forEach(element => {
        //     if (!objectIdHelper.compare(element._id, messagePin._id))
        //         throw new Error('Message is not in room');
        // });
        return { room, user, messagePin };
    }
};