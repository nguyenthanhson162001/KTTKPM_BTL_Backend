const User = require('../../../models/post.model');
const Comment = require('../../../models/comment.model');
const Post = require('../../../models/post.model');
const Notification = require('../../../models/notification.model');
const Report = require('../../../models/report.model');
const mongooseHelper = require('../../../utils/mongo.helper');
const messageValidation = require('../validation/message.validation');
const awsS3Helper = require('../../../utils/awss3.helper');

const ObjectId = require('mongoose').Types.ObjectId;
const multer = require('multer');
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
    // [GET] /v1/post/new-feed
    async getNewFeed(req, res) {

    },

    // [POST] /v1/post/new
    async addNewPost(req, res) {
        try {
            upload(req, res, async (err) => {
                let { caption, type, access } = req.body;
                console.log("🚀 ~ file: post.controller.js ~ line 35 ~ addNewPost ~  caption, type", caption, type)
                const file = req.file;
                let post;
                if (!caption)
                    throw new Error('Create new post ==> missing parameter');
                if (!caption)
                    throw new Error("Add new post --> Missing parameter");

                if (file) {
                    if (!type)
                        throw new Error('Add post -> missing type');

                    await messageValidation.validateFileMessage(
                        file, type
                    );
                    const image = await awsS3Helper.uploadFile(file);

                    post = new Post({
                        user: req.auth.userId,
                        caption,
                        access: access === undefined ? 'PUBLIC' : access,
                        image: [image]
                    });
                } else {
                    post = new Post({
                        user: req.auth.userId,
                        caption,
                        access: access === undefined ? 'PUBLIC' : access,
                    });
                }

                await mongooseHelper.executeTransactionWithRetry({
                    async executeCallback(session) {
                        let [savePost, updateUser] = await Promise.all([
                            post.save({ session }),
                            User.updateOne(
                                { _id: req.auth.userId },
                                {
                                    $push: {
                                        posts: post._id
                                    }
                                }
                            )
                        ]);

                        if (savePost.modifiedCount < 1 || updateUser.modifiedCount < 1)
                            throw new Error('Update data fail');
                    },
                    successCallback() {
                        return res.status(200).json({
                            post
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
            return res.status(400).json({
                message: error.message,
                Code: 400
            });
        }
    }
};