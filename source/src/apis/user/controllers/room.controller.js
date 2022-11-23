const User = require('../../../models/user.model');
const Room = require('../../../models/room.model');
const ObjectId = require('mongoose').Types.ObjectId;
const objectIdHelper = require('../../../utils/objectId.helper');
const mongodbHelper = require('../../../utils/mongo.helper');
const Message = require('../../../models/message.model');
const { validateAddMember } = require('../validation/room.validation');
let numberOfLoadMessage = 20;
const GROUP_LEAVE_MESSAGE = 'has left group';
const MEMBER_ADD_MESSAGE = 'joined group';

const loadMessage = async (req, res) => {
    try {
        let roomId = req.params.roomId;
        let numberOfMessage = req.query.nMessage;
        let userId = req.query.userId;
        if (!roomId || numberOfMessage === undefined)
            return res.status(400).json({ message: 'Missing parameters' });

        if (!(await Room.aggregate().match({ _id: ObjectId(roomId) }))) {
            let room = await Room.create({
                _id: roomId,
                users: [req.auth.userId, userId]
            });
            if (!room) throw new Error('Create room failed');
        }

        let [countMessage, data] = await Promise.all([
            Room.aggregate([
                {
                    '$match': {
                        '_id': new ObjectId(roomId)
                    }
                }, {
                    '$project': {
                        '_id': 0,
                        'users': 1,
                        'count': {
                            '$size': '$messages'
                        }
                    }
                }
            ]),

            Room.aggregate([
                {
                    $match: {
                        _id: ObjectId(roomId)
                    }
                },
                {
                    $project: {
                        messages: 1
                    }
                },
                {
                    $project: {
                        _id: 0,
                        'messages.showWith': 0
                    }
                }
            ])
        ]);

        if (countMessage.length === 0)
            return res.status(200).json({
                status: 'success',
                data: []
            });

        countMessage = countMessage[0];
        data = data[0];

        if (!objectIdHelper.include(countMessage.users, req.auth.userId))
            throw new Error('Unauthorized');

        return res.status(200).json({
            status: 'success',
            data: data,
            roomId: req.originalUrl.includes('room/check') ? roomId : undefined
        });
    } catch (err) {
        console.log(err);
        return res.status(500).json({
            status: 'error',
            message: err.message
        });
    }
}

module.exports = {
    //[GET] v1/rooms/getAllPinMessage/:roomId
    async getAllPinMessage(req, res) {
        const { roomId } = req.params;
        console.log("🚀 ~ file: room.controller.js ~ line 95 ~ getAllPinMessage ~ roomId", roomId)
        let room, pinMessage = [];
        if (!roomId)
            throw new Error('Get pin message ==> Missing parameter');

        await mongodbHelper.executeTransactionWithRetry({
            async executeCallback(session) {
                room = await Room.findOne({ _id: roomId, active: true });
                if (!room)
                    throw new Error('Get pin message => can not found room!');

                let [data] = await Promise.all([
                    Room.aggregate([
                        {
                            $match: {
                                _id: ObjectId(roomId)
                            }
                        },
                        {
                            $project: {
                                pinMessage: 1
                            }
                        },
                        {
                            $project: {
                                _id: 0,
                                users: 0,
                                roomMaster: 0,
                                messages: 0,
                                avatar: 0,
                                createdAt: 0,
                                updatedAt: 0,
                                name: 0,
                                active: 0,
                                group: 0
                            }
                        }
                    ])
                ]);

                pinMessage = data[0];
                console.log("🚀 ~ file: messenger.controller.js ~ line 96 ~ executeCallback ~ pinMessage", pinMessage);
            },
            successCallback() {
                return res.status(200).json({
                    message: 'sucess', Code: 200,
                    data: {
                        pinMessage
                    }
                });
            },
            errorCallback(error) {
                console.log("🚀 ~ file: messenger.controller.js ~ line 210 ~ errorCallback ~ error", error)
                return res.status(400).json({
                    message: error.message,
                    Code: 400
                });
            }
        });
    },
    // [GET] /v1/room
    async getRooms(req, res) {
        console.log('');
        try {
            let user = await User.findById(req.auth.userId)
                .select('username name image')
                .lean();

            if (!user) throw new Error('Not found user');

            const agg = [
                {
                    '$lookup': {
                        'from': 'users',
                        'localField': 'users',
                        'foreignField': '_id',
                        'as': 'users'
                    }
                }, {
                    '$match': {
                        'users._id': {
                            '$eq': ObjectId(req.auth.userId)
                        }
                    }
                }, {
                    '$project': {
                        '_id': 1,
                        'updatedAt': 1,
                        'users': {
                            '_id': 1,
                            'username': 1,
                            'name': 1,
                            'avatar': 1
                        },
                        'roomMaster': 1,
                        'name': 1,
                        'messages': {
                            receiver: 1,
                            type: 1,
                            reaction: 1,
                            readMessage: 1,
                            isDeleted: 1,
                            _id: 1,
                            sender: 1,
                            room: 1,
                            message: 1
                        },
                        'group': 1,
                        'avatar': 1,
                        'active': 1
                    }
                }
            ];

            let room = await Room.aggregate(agg);
            if (room.length === 0)
                return res.status(200).json({
                    status: 'success',
                    data: user
                });

            return res.status(200).json({
                status: 'success',
                data: {
                    user,
                    room
                }
            });
        } catch (error) {
            console.log(error);
            if (error.name === 'Error')
                return res.status(400).json({
                    status: 'error',
                    message: error.message
                });
            return res.status(500).json({
                status: 'error',
                message: 'Error at server'
            });
        }
    },

    // [GET] /v1/room/groups
    async getGroupRooms(req, res) {
        console.log('');
        try {
            let user = await User.findById(req.auth.userId)
                .select('username name image')
                .lean();

            if (!user) throw new Error('Not found user');

            const agg = [
                {
                    '$lookup': {
                        'from': 'users',
                        'localField': 'users',
                        'foreignField': '_id',
                        'as': 'users'
                    }
                }, {
                    '$match': {
                        'users._id': {
                            '$eq': ObjectId(req.auth.userId)
                        },
                        group: true
                    }
                }, {
                    '$project': {
                        '_id': 1,
                        'updatedAt': 1,
                        'users': {
                            '_id': 1,
                            'username': 1,
                            'name': 1,
                            'avatar': 1
                        },
                        'roomMaster': 1,
                        'name': 1,
                        'messages': {
                            receiver: 1,
                            type: 1,
                            reaction: 1,
                            readMessage: 1,
                            isDeleted: 1,
                            _id: 1,
                            sender: 1,
                            room: 1,
                            message: 1
                        },
                        'group': 1,
                        'avatar': 1,
                        'active': 1
                    }
                }
            ];

            let room = await Room.aggregate(agg);
            if (room.length === 0)
                return res.status(200).json({
                    status: 'success',
                    data: user
                });

            return res.status(200).json({
                status: 'success',
                data: {
                    user,
                    room
                }
            });
        } catch (error) {
            console.log(error);
            if (error.name === 'Error')
                return res.status(400).json({
                    status: 'error',
                    message: error.message
                });
            return res.status(500).json({
                status: 'error',
                message: 'Error at server'
            });
        }
    },

    // [POST] /v1/room//groups/add
    async addGroups(req, res) {
        const { name, userIds = [] } = req.body;
        const userSeftId = req.auth.userId;
        let masterGroup, room, userIdsTemp;
        await mongodbHelper.executeTransactionWithRetry({
            async executeCallback(session) {
                masterGroup = await User.findOne({ _id: userSeftId });
                console.log("🚀 ~ file: room.controller.js ~ line 217 ~ executeCallback ~ userSeftId", userSeftId)

                if (!masterGroup)
                    throw new Error('User not found!');

                // kiem tra list user them vao co ton tai hay khoong
                if (userIds.length <= 0) throw new Error('List users is invalid!');

                userIdsTemp = [userSeftId, ...userIds];

                await User.checkById(userIdsTemp);

                // add new room
                room = new Room({
                    name,
                    roomMaster: userSeftId,
                    users: [userSeftId, ...userIds],
                    group: true
                });

                // create new message
                const message = new Message({
                    sender: userSeftId,
                    room: room._id,
                    receiver: userIdsTemp,
                    message: 'room is create',
                });

                let [saveRoom, saveMessage] = await Promise.all([
                    room.save({ session }),
                    message.save({ session })
                ]);

                console.log(
                    `room create ${saveRoom === room ? 'successful' : 'failed'
                    }!`
                );
                console.log(
                    `message create ${saveMessage === message ? 'successful' : 'failed'}!`
                );

                for (let i = 0; i < userIdsTemp.length; i++) {
                    let [updateUserRoom] = await Promise.all([
                        User.updateOne(
                            {
                                _id: userIdsTemp[i]
                            },
                            {
                                $push: {
                                    rooms: room._id
                                }
                            }, { session }
                        )
                    ]);
                    if (updateUserRoom.modifiedCount < 1)
                        throw new Error('Update data fail');
                    console.log("🚀 ~ file: room.controller.js ~ line 267 ~ executeCallback ~ updateUserRoom", updateUserRoom)
                }
            },
            successCallback() {
                return res.status(200).json({
                    Code: 200,
                    data: {
                        room,
                        userIdsTemp
                    },
                    message: 'success'
                });
            },
            errorCallback(error) {
                console.log(error);
                return res.status(400).json({
                    Code: 400,
                    message: error.message
                });
            }
        });
    },

    // [GET] /v1/room/:roomId
    loadMessage,

    // [GET] /v1/room/check
    async checkRoom(req, res) {
        try {
            let { userId } = req.query;

            if (!userId) return res.status(400).json({ message: 'Missing parameters' });

            let user = await User.findById(req.auth.userId)
                .select('rooms')
                .populate('rooms')
                .lean();

            let roomId = null;
            user.rooms.some(room => {
                if (objectIdHelper.include(room.chatMate, userId)) {
                    roomId = room._id;
                    return true;
                }
                return false;
            });

            if (roomId === null) {
                roomId = new ObjectId();
                res.status(200).json({
                    status: 'success',
                    data: null,
                    roomId
                });
            } else {
                req.params.roomId = roomId;
                req.query.nMessage = 0;
                return await loadMessage(req, res);
            }
        } catch (error) {
            console.log(error);
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    },


};

