const ObjectId = require('mongoose').Types.ObjectId;
const multer = require('multer');
const User = require('../../../models/user.model');
const Room = require('../../../models/room.model');
const Message = require('../../../models/message.model');
const resourceHelper = require('../../../utils/resources.helper');
const objectIdHelper = require('../../../utils/objectId.helper');
const mongodbHelper = require('../../../utils/mongo.helper');
const messageValidation = require('../validation/message.validation');
const awsS3Helper = require('../../../utils/awss3.helper');

async function validateRoom(roomId, user1, user2) {
    let room = await Room.aggregate([
        {
            $match: {
                _id: ObjectId(roomId)
            }
        },
        {
            $project: {
                users: 1
            }
        }
    ]);

    if (room.length === 0) return null;
    let chatMate = room[0].users;
    if (objectIdHelper.compareArray(chatMate, [user1, user2])) return true;
    if (chatMate[1] == user1 || chatMate[0] == user2) return true;
    if (chatMate[0] == user1 || chatMate[0] == user2) return true;

    return false;
}

// config path 
const path = require('path');

const storage = multer.memoryStorage({
    destination: (req, file, cb) => {
        cb(null, "");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    },
});
const upload = multer({ storage, limits: { fileSize: 20000000 } }).single(
    "file"
);

module.exports = {

    // [POST] /v1/messages/addFile
    async addFile(req, res, next) {
        try {
            upload(req, res, async (err) => {
                let { username, userId, roomId, type } = req.body;
                const file = req.file;
                if (err) {
                    return res.status(500).json("LOI NEK" + err);
                }

                if (!(username && userId && roomId && type && file)) {
                    throw new Error('Message uploate file ==> Missing parameter')
                }
                await messageValidation.validateFileMessage(
                    file, type
                );
                // upload ảnh
                const content = await awsS3Helper.uploadFile(file);
                let message;

                const userSender = await User.findById(req.auth.userId);


                await mongodbHelper.executeTransactionWithRetry({
                    async executeCallback(session) {
                        //create message from content
                        message = new Message({
                            sender: userSender.username,
                            type: type,
                            room: roomId,
                            receiver: userId,
                            message: content,
                            type
                        });
                        console.log(`create message: ${JSON.stringify(message)}`)

                        console.log('send message: validate value: ' + ` roomid: ${roomId}, userid: ${userId}, idfromsocket:  ${req.auth.useId}`)

                        let validate = await validateRoom(roomId, userId, req.auth.userId);

                        if (validate === null) {
                            let [createRoom, userUpdateStatus, messageSave] = await Promise.all([
                                Room.create(
                                    {
                                        _id: roomId,
                                        users: [req.auth.userId, userId]
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
                                        _id: { $in: [req.auth.userId, userId] }
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
                        return res.status(200).json({
                            message: 'sucess', Code: 200, data: {
                                roomId,
                                userId,
                                username: userSender.username,
                                message
                            }
                        });
                    },
                    errorCallback(error) {
                        return res.status(400).json({
                            message: error.message,
                            Code: 400
                        });
                    }
                });
            });
        } catch (error) {
            next(error);
        }
    },

    //[POST] /v1/messages/delete
    async deleteMessagse(req, res) {
        const { messageId, roomId } = req.body;
        let room;
        if (!(messageId && roomId))
            throw new Error('Delete message -> Missing parameter');

        await mongodbHelper.executeTransactionWithRetry({
            async executeCallback(session) {
                const message = await Message.findById(messageId);
                const userSender = await User.findById(req.auth.userId);
                try {
                    if (!message)
                        throw new Error('Message not found!');

                    room = await Room.findOne({ _id: roomId });
                    // .select('messages').lean();
                    const { messages } = room;

                    if (!room)
                        throw new Error('Room not found!');

                    if (objectIdHelper.include(room.messages, messageId))
                        throw new Error('Message not found in room!');

                    if (!(message.sender === userSender.username))
                        throw new Error('Not your messages!');


                    let [deleteMessage, updateRoom] = await Promise.all([
                        Message.deleteOne(
                            {
                                _id: messageId
                            }
                        ),
                        await Room.updateOne(
                            {
                                _id: roomId
                            },
                            {
                                $pull: {
                                    'messages': {
                                        _id: ObjectId(message._id)
                                    }
                                }
                            }
                        )
                    ]);

                    if (updateRoom.modifiedCount < 1 || deleteMessage.deletedCount < 1)
                        throw new Error('Update data fail');

                } catch (error) {
                    return res.status(400).json({
                        message: error.message,
                        Code: 400
                    });
                }
            },
            successCallback() {
                return res.status(200).json({
                    message: 'sucess', Code: 200,
                    data: {
                        roomId,
                        messageId
                    }
                });
            },
            errorCallback(error) {
                return res.status(400).json({
                    message: error.message,
                    Code: 400
                });
            }
        });
    }

};