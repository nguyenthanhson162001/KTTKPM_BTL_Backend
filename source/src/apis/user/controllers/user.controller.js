const fs = require('fs');
const { unlink } = require('fs/promises');
const multer = require('multer');
const { ObjectId } = require('mongodb');
const User = require('../../../models/user.model');
const Notification = require('../../../models/notification.model');
const Post = require('../../../models/post.model');
const mongooseHelper = require('../../../utils/mongo.helper');
const mail = require('../../../utils/nodemail.helper');
const crypto = require('../../../utils/crypto.hepler');
const Request = require('../../../models/request.model');
const objectIdHelper = require('../../../utils/objectId.helper');
const Rooms = require('../../../models/room.model');
const Message = require('../../../models/message.model');
const messageValidation = require('../validation/message.validation');

// config path 
const path = require('path');
const awss3Helper = require('../../../utils/awss3.helper');

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
    // [GET] /v1/user/me/profile
    getMyProfile(req, res) {
        let id = req.auth.userId;
        User.findById(id, {
            rooms: 0,
            auth: 0
        })
            .select('-notifications -deleted -updatedAt')
            .populate([
                {
                    path: 'posts',
                    select: '-user -reports -updatedAt',
                    populate: [
                        {
                            path: 'likes',
                            select: 'username'
                        },
                        {
                            path: 'comments',
                            populate: {
                                path: 'commentBy',
                                select: 'username'
                            },
                            select: '-updatedAt'
                        }
                    ]
                },
                {
                    path: 'friends',
                    select: 'username name image'
                }
            ])
            .lean()
            .then(data => {
                data.posts.forEach(post => {
                    post.imgs = resourceHelper.getListPostImages(post._id.toString());
                });
                res.status(200).json({
                    errorCode: 200,
                    data
                });
            })
            .catch(err => {
                console.log(err);
                res.status(500).json({
                    errorCode: 500,
                    message: 'Error at server'
                });
            });
    },

    // [GET] /v1/user/:userId
    getUserProfile(req, res) {
        let userId = req.params.userId;

        if (!userId) return res.status(400).json({ message: 'Missing parameters', errorCode: 400 });

        Promise.all([
            User.findById(userId)
                .select('-rooms -auth -notifications -deleted -updatedAt')
                .populate([
                    'posts',
                    {
                        path: 'friends',
                        select: 'username name image'
                    }
                ])
                .lean(),
            User.findById(req.auth.userId).select('friends').lean(),
            Request.findOne({
                type: 'ADD_FRIEND',
                from: req.auth.userId,
                to: userId
            }).lean()
        ])
            .then(([data, mine, request]) => {
                if (!data)
                    return res.status(400).json({
                        errorCode: 400,
                        message: 'Data not found'
                    });
                data.posts.forEach(post => {
                    post.imgs = resourceHelper.getListPostImages(post._id.toString());
                });
                data.isFriend = objectIdHelper.include(mine.friends, data._id);
                if (!data.isFriend) data.addFriendRequest = request ? true : false;
                res.status(200).json({
                    errorCode: 200,
                    message: 'success',
                    data
                });
            })
            .catch(err => {
                console.log(err);
                res.status(500).json({
                    errorCode: 500,
                    message: 'Error at server'
                });
            });
    },

    // [GET] /v1/user/search:keyword
    async searchUser(req, res) {
        try {
            let keyword = req.params.keyword;
            console.log("🚀 ~ file: user.controller.js ~ line 118 ~ searchUser ~ keyword", keyword)
            if (!keyword)
                return res.status(400).json({
                    errorCode: 400,
                    message: 'Invalid keyword'
                });

            let regex = new RegExp('^' + keyword, 'i');
            let result = await User.find({
                $and: [{ $or: [{ username: regex }, { email: regex }] }, { 'auth.isAdmin': false }]
            })
                .select('username name email image')
                .lean();

            console.log("🚀 ~ file: user.controller.js ~ line 128 ~ searchUser ~ result", result)
            return res.status(200).json({
                message: 'success',
                errorCode: 200,
                data: result
            });
        } catch (error) {
            console.log("🚀 ~ file: user.controller.js ~ line 136 ~ searchUser ~ error", error)

            res.status(500).json({
                status: 500,
                message: 'Error at server.'
            });
        }
    },

    // [GET] /v1/user/friends
    async getAllFriends(req, res) {
        let id = req.auth.userId;
        console.log("🚀 ~ file: user.controller.js ~ line 155 ~ getAllFriends ~ id", id);
        User.findById(id).select('friends')
            .populate([
                {
                    path: 'friends',
                    select: 'username name image'
                }
            ])
            .lean()
            .then(data => {
                res.status(200).json({
                    errorCode: 200,
                    data
                });
            })
            .catch(err => {
                console.log(err);
                res.status(500).json({
                    errorCode: 500,
                    message: 'Error at server'
                });
            });

    },

    // [GET] /v1/user/notifications/all
    async getAllNotification(req, res) {
        try {
            let user = await User.findById(req.auth.userId)
                .select('notifications')
                .populate({
                    path: 'notifications',
                    select: '-user',
                    options: {
                        sort: {
                            createdAt: -1
                        }
                    }
                });

            return res.status(200).json({
                errorCode: 200,
                message: 'success',
                data: user.notifications
            });
        } catch (error) {
            console.log(error);
            return res.status(500).json({
                errorCode: 500,
                message: 'Error at server'
            });
        }
    },

    // [GET] /v1/user/notification/check
    async checkNotification(req, res) {
        let { notificationId } = req.query;

        if (!notificationId) return res.status(400).json({ errorCode: 400, message: 'Missing parameters' });

        let user = undefined,
            post = undefined,
            comment = undefined,
            reply = undefined;
        await mongooseHelper.executeTransactionWithRetry({
            async executeCallback(session) {
                let me = await User.findById(req.auth.userId)
                    .select('notifications')
                    .populate({
                        path: 'notifications',
                        match: {
                            _id: ObjectId(notificationId)
                        },
                        select: '-user'
                    })
                    .lean();

                if (me.notifications.length === 0) throw new Error('Notification not found');

                let notification = me.notifications[0];
                let tag = notification.tag;
                let postPipeline = [
                    {
                        path: 'user',
                        select: 'username friends'
                    },
                    {
                        path: 'likes',
                        select: 'username'
                    },
                    {
                        path: 'comments',
                        populate: {
                            path: 'commentBy',
                            select: 'username'
                        },
                        select: 'commentBy content'
                    }
                ];

                switch (notification.type) {
                    case 'ADD_FRIEND_REQUEST':
                        user = await User.findById(tag[0]);
                        if (!user) throw new Error('Requested user is not found');
                        break;
                    case 'REACT_POST':
                        post = await Post.findById(tag[0])
                            .populate(postPipeline)
                            .select('-reports')
                            .lean();
                        if (!post) throw new Error('Post is not found');
                        break;
                    case 'REACT_COMMENT':
                    case 'REACT_MESSAGE':
                    case 'COMMENT':
                        post = await Post.findById(tag[0])
                            .populate(postPipeline)
                            .select('-reports')
                            .lean();
                        if (!post) throw new Error('Post is not found');
                        if (
                            objectIdHelper.include(
                                post.comments.map(comment => comment._id),
                                tag[1]
                            )
                        )
                            comment = null;
                        else comment = await Comment.findById(tag[1]).lean();
                        break;
                    case 'REPLY':
                        post = await Post.findById(tag[0])
                            .populate(postPipeline)
                            .select('-reports')
                            .lean();
                        if (!post) throw new Error('Post is not found');
                        if (
                            !objectIdHelper.include(
                                post.comments.map(comment => comment._id),
                                tag[1]
                            )
                        )
                            comment = null;
                        else {
                            comment = await Comment.findById(tag[1]);
                            if (
                                !objectIdHelper.include(
                                    comment.replies.map(reply => reply._id),
                                    tag[2]
                                )
                            )
                                reply = null;
                            else reply = comment.replies.id(tag[2]);
                        }
                        break;
                    default:
                        throw new Error('Notification error');
                }

                let updatedNotification = await Notification.updateOne(
                    {
                        _id: notification._id
                    },
                    {
                        isChecked: true
                    },
                    {
                        session
                    }
                );
                console.log(updatedNotification);
            },
            successCallback() {
                return res.status(200).json({
                    errorCode: 200,
                    message: 'success',
                    data: {
                        user,
                        post,
                        comment,
                        reply
                    }
                });
            },
            errorCallback(error) {
                console.log(error);
                if (error?.message == 400)
                    return res.status(400).json({ errorCode: 400, message: 'Missing parameters' });
                if (error.name === 'Error')
                    return res.status(200).json({
                        errorCode: 400,
                        message: error.message
                    });
                return res.status(500).json({
                    errorCode: 500,
                    message: 'Error at server'
                });
            }
        });
    },

    // [POST] /v1/user/upload/avatar
    async uploadProfilePicture(req, res) {
        try {
            upload(req, res, async (err) => {
                const file = req.file;
                if (!file)
                    throw new Error('Update avatar -> Missing parameter');

                await messageValidation.validateFileMessage(
                    file, 'IMAGE'
                );
                // upload ảnh
                const image = await awss3Helper.uploadFile(file);

                const updateUser = await User.updateOne(
                    {
                        _id: req.auth.userId
                    },
                    {
                        image: image
                    }
                );

                if (updateUser.modifiedCount < 1)
                    throw new Error('Update data fail!');
                return res.status(200).json({
                    message: 'upload avatar success',
                    errorCode: 200
                });
            });
        } catch (err) {
            console.log(err)
            return res.status(400).json({
                message: err.message,
                errorCode: 400
            });
        }
    },
    // [POST] /v1/user/friends/accept-request
    async acceptAddFriendRequest(req, res) {
        const { requestedUserId, requestedUsername } = req.body;
        let room;
        await mongooseHelper.executeTransactionWithRetry({
            async executeCallback(session) {
                if (!requestedUserId) throw new Error('400')

                let notification = await Notification.findOne({
                    user: req.auth.userId,
                    type: 'ADD_FRIEND_REQUEST',
                    requestedUserId: requestedUserId
                });

                if (!notification) throw new Error('Notification is not found!');

                const listUsers = [req.auth.userId, requestedUserId];
                const request = await Request.findOne({
                    type: 'ADD_FRIEND',
                    from: requestedUserId,
                    to: req.auth.userId
                });
                console.log("🚀 ~ file: user.controller.js ~ line 403 ~ executeCallback ~ request", request)

                let [requestedUser, receivedUser, deletedNotification, deletedRequest] = await Promise.all([
                    User.updateOne(
                        {
                            _id: requestedUserId
                        },
                        {
                            $push: {
                                friends: req.auth.userId,
                            }
                        },
                        {
                            session
                        }
                    ),
                    User.updateOne(
                        {
                            _id: req.auth.userId
                        },
                        {
                            $push: {
                                friends: requestedUserId,
                            },
                            $pull: {
                                notifications: notification._id
                            }
                        },
                        {
                            session
                        }
                    ),
                    Notification.deleteOne(
                        {
                            _id: notification._id
                        },
                        {
                            session
                        }
                    ),
                    Request.deleteOne(
                        {

                        },
                        {
                            session
                        }
                    )
                ]);

                if (requestedUser.modifiedCount < 1) throw new Error('Can not update request user');
                if (receivedUser.modifiedCount < 1) throw new Error('Can not update receivedUser user');
                if (deletedNotification.modifiedCount < 1) throw new Error('Can not update deletedNotification user');
                if (deletedRequest.modifiedCount < 1) throw new Error('Can not update deletedRequest user');

                console.log("🚀 ~ file: user.controller.js ~ line 447 ~ requestedUser update" + requestedUser.modifiedCount < 1 ? "fail" : 'success');
                console.log("🚀 ~ file: user.controller.js ~ line 447 ~ receivedUser update" + receivedUser.modifiedCount < 1 ? "fail" : 'success');
                console.log("🚀 ~ file: user.controller.js ~ line 447 ~ deletedNotification update" + deletedNotification.modifiedCount < 1 ? "fail" : 'success');
                console.log("🚀 ~ file: user.controller.js ~ line 447 ~ deletedRequest update" + deletedRequest.modifiedCount < 1 ? "fail" : 'success');

                room = await Rooms.create(
                    {
                        users: listUsers,
                        group: false,
                        name: req.auth.userId + requestedUserId,
                        avatar: "",
                    });

                const message = await new Message({
                    sender: requestedUserId,
                    message: 'Welcome!',
                    type: 'NOTIFY',
                    room: room._id
                });
                let [requestedUserRoom, receivedUserRoom, updateRoom] = await Promise.all([
                    User.updateOne(
                        {
                            _id: requestedUserId
                        },
                        {
                            $push: {
                                rooms: room._id,
                            }
                        },
                        {
                            session
                        }
                    ),
                    User.updateOne(
                        {
                            _id: req.auth.userId
                        },
                        {
                            $push: {
                                rooms: room._id,
                            },
                        },
                        {
                            session
                        }
                    ),
                    Rooms.updateOne(
                        {
                            _id: room._id
                        },
                        {
                            $push: {
                                messages: message
                            },
                        },
                    )
                ]);
                if (receivedUserRoom.modifiedCount < 1 || requestedUserRoom.modifiedCount < 1 || updateRoom.modifiedCount < 1)
                    throw new Error('Contain not updated data');
            },
            successCallback() {
                return res.status(200).json({
                    errorCode: 200,
                    message: 'success',
                    data: {
                        requestedUserId,
                        room
                    }
                });
            },
            errorCallback: error => {
                console.log(error);
                res.status(400).json({
                    errorCode: 400,
                    message: error.message
                });
            }
        });
    },

    // [POST] /v1/user/friends/decline-request
    async declineAddFriendRequest(req, res) {
        await mongooseHelper.executeTransactionWithRetry({
            async executeCallback(session) {
                const { requestedUserId, requestedUsername } = req.body;

                if (!requestedUserId) throw new Error('400');

                let notification = await Notification.findOne({
                    user: req.auth.userId,
                    type: 'ADD_FRIEND_REQUEST',
                    tag: [requestedUserId]
                }).lean();

                if (!notification) throw new Error('Notification is not found!');

                let [receivedUser, deletedNotification, deletedRequest] = await Promise.all([
                    User.updateOne(
                        {
                            _id: req.auth.userId
                        },
                        {
                            $pull: {
                                notifications: notification._id
                            }
                        },
                        {
                            session
                        }
                    ),
                    Notification.deleteOne(
                        {
                            _id: notification._id
                        },
                        {
                            session
                        }
                    ),
                    Request.deleteOne(
                        {
                            type: 'ADD_FRIEND',
                            from: requestedUserId,
                            to: req.auth.userId
                        },
                        {
                            session
                        }
                    )
                ]);

                console.log('Decline add friend result');
                console.log(`receivedUser.modifiedCount: ${receivedUser.modifiedCount}`);
                console.log(
                    `deletedNotification.deletedCount: ${deletedNotification.deletedCount}`
                );
                console.log(`deletedRequest.deletedCount: ${deletedRequest.deletedCount}`);

                if (
                    receivedUser.modifiedCount < 1 ||
                    deletedNotification.deletedCount < 1 ||
                    deletedRequest.deletedCount < 1
                )
                    throw new Error('Contain not updated data');
            },
            successCallback() {
                return res.status(200).json({
                    status: 'success'
                });
            },
            errorCallback: error => {
                console.log(error);
                if (error?.message == 400)
                    return res.status(400).json({ message: 'Missing parameters' });
                res.status(500).json({
                    status: 'error',
                    message: 'Error at server.'
                });
            }
        });
    },

    // [POST] /v1/user/friends/undo-request
    async undoAddFriendRequest(req, res) {
        await mongooseHelper.executeTransactionWithRetry({
            async executeCallback(session) {
                const { receivedUserId, receivedUsername } = req.body;

                if (!receivedUserId) throw new Error('400');

                let notification = await Notification.findOne({
                    user: receivedUserId,
                    type: 'ADD_FRIEND_REQUEST',
                    tag: [req.auth.userId]
                }).lean();

                if (!notification) throw new Error('Notification is not found!');

                let [receivedUser, deletedNotification, deletedRequest] = await Promise.all([
                    User.updateOne(
                        {
                            _id: receivedUserId
                        },
                        {
                            $pull: {
                                notifications: notification._id
                            }
                        },
                        {
                            session
                        }
                    ),
                    Notification.deleteOne(
                        {
                            _id: notification._id
                        },
                        {
                            session
                        }
                    ),
                    Request.deleteOne(
                        {
                            type: 'ADD_FRIEND',
                            from: req.auth.userId,
                            to: receivedUserId
                        },
                        {
                            session
                        }
                    )
                ]);

                console.log('Undo add friend result');
                console.log(`receivedUser.modifiedCount: ${receivedUser.modifiedCount}`);
                console.log(
                    `deletedNotification.deletedCount: ${deletedNotification.deletedCount}`
                );
                console.log(`deletedRequest.deletedCount: ${deletedRequest.deletedCount}`);
                console.log('OK');

                if (
                    receivedUser.modifiedCount < 1 ||
                    deletedNotification.deletedCount < 1 ||
                    deletedRequest.deletedCount < 1
                )
                    throw new Error('Contain not updated data');
            },
            successCallback() {
                return res.status(200).json({
                    status: 'success'
                });
            },
            errorCallback(error) {
                console.log(error);
                if (error?.message == 400)
                    return res.status(400).json({ message: 'Missing parameters' });
                res.status(500).json({
                    status: 'error',
                    message: 'Error at server.'
                });
            }
        });
    },

    // [POST] /v1/user/friends/unfriend
    async unfriend(req, res) {
        await mongooseHelper.executeTransactionWithRetry({
            async executeCallback(session) {
                const { friendId, friendUsername } = req.body;

                if (!friendId) throw new Error('400');

                let [updatedFriendStatus, updatedMyStatus] = await Promise.all([
                    User.updateOne(
                        {
                            _id: friendId
                        },
                        {
                            $pull: {
                                friends: req.auth.userId
                            }
                        },
                        {
                            session
                        }
                    ),
                    User.updateOne(
                        {
                            _id: req.auth.userId
                        },
                        {
                            $pull: {
                                friends: friendId
                            }
                        },
                        {
                            session
                        }
                    )
                ]);

                console.log('Unfriend result');
                console.log(
                    `updatedFriendStatus.modifiedCount: ${updatedFriendStatus.modifiedCount}`
                );
                console.log(`updatedMyStatus.modifiedCount: ${updatedMyStatus.modifiedCount}`);
                console.log('OK');
                if (updatedFriendStatus.modifiedCount < 1 || updatedMyStatus.modifiedCount < 1)
                    throw new Error('Data is not updated');
            },
            successCallback() {
                return res.status(200).json({
                    status: 'success'
                });
            },
            errorCallback(error) {
                console.log(error);
                if (error?.message == 400)
                    return res.status(400).json({ message: 'Missing parameters' });
                res.status(500).json({
                    status: 'error',
                    message: 'Error at server.'
                });
            }
        });
    },

    // [PATCH] /v1/user/edit/info
    async editUserProfile(req, res) {
        await mongooseHelper.executeTransactionWithRetry({
            async executeCallback(session) {
                let { username, name, bio, dob, gender } = req.body;

                if ([username, name, bio, dob, gender].some(a => a === undefined))
                    throw new Error('edit profile is undefine');

                let updatedUser = await User.updateOne(
                    {
                        _id: req.auth.userId
                    },
                    {
                        username,
                        name,
                        bio,
                        dob,
                        gender
                    },
                    {
                        session
                    }
                );
                console.log('updatedUser.modifiedCount:', updatedUser.modifiedCount);
                if (updatedUser.modifiedCount < 1) throw new Error('Update data failed');
            },
            successCallback() {
                res.status(200).json({
                    errorCode: 200,
                    message: 'User has been edited',
                });
            },
            errorCallback(error) {
                return res.status(400).json({
                    errorCode: 400,
                    message: error.message
                });
            }
        });
    },

};