const User = require('../../../models/user.model');
const Token = require('../../../models/token.model');
const Request = require('../../../models/request.model');
const Notification = require('../../../models/notification.model');
const mongooseHelper = require('../../../utils/mongo.helper');
const mail = require('../../../utils/nodemail.helper');
const crypto = require('../../../utils/crypto.hepler');

const ObjectId = require('mongoose').Types.ObjectId;
const generator = require('generate-password');
const fs = require('fs');


module.exports = {

    // [POST] /v1/user/addNewUser
    async addNewAccount(req, res) {
        let { username, email, name, isAdmin } = req.body;

        if (!(username && email && name && isAdmin !== undefined))
            return res.status(400).json({
                status: 'error',
                message: 'Missing or wrong parameters'
            });
        //check value of isadmin
        if (![0, 1, 'true', 'false', true, false].includes(isAdmin))
            return res.status(400).json({
                status: 'error',
                message: 'Wrong value of isAdmin'
            });

        mongooseHelper.excuteTransactionWithRetry({
            async excuteCallBack(session) {
                // tim user trong database
                // select user with lean this make queries more faster and use less memory.
                // return java pojo basic object( maybe javascrip object) not a document
                let user = await User.findOne({
                    $or: [{ username: username }, { email: email }]
                })
                    .select('username email')
                    .lean();

                //Operator Precedence Values
                // operater ?. help you to read or access to property of object with no authen
                // check username exist
                if (user?.username === username) throw new Error('This username is already in use');
                //check email exist
                if (user?.email === email) throw new Error('This email is already in use');

                // genarate random password
                let initPassword = generator.generate({
                    length: 8,
                    numbers: true,
                    symbols: true,
                    lowercase: true,
                    uppercase: true,
                    strict: true
                });

                user = await User.create(
                    [
                        {
                            username,
                            email,
                            name,
                            auth: {
                                password: crypto.hash(initPassword),
                                isAdmin,
                                isVerified: true
                            }
                        }
                    ],
                    { session }
                );

                // send mail for new user
                mail.sendWelcomeToNewAccount({
                    to: email,
                    username,
                    name,
                    password,
                    isAdmin
                });
            },
            successCallBack() {
                return res.status(200).json({ status: 'success' });
            },
            errorCallBack(err) {
                console.log(err);
                if (err.name == 'Error')
                    return res.status(400).json({
                        status: 'error',
                        message: err.message
                    });

                return res.status(500).json({
                    status: 'Error',
                    message: 'Error of server'
                });
            }
        })
    },

    // [GET] /v1/user/:id
    async getUserDetail(req, res) {
        let userId = req.params.id;

        try {
            let [userInfo, userPosts] = await Promise.all([
                User.aggregateWithDeleted()
                    .match({ _id: ObjectId(userId) })
                    .project({
                        username: 1,
                        email: 1,
                        name: 1,
                        gender: 1,
                        dob: 1,
                        bio: 1,
                        disabled: '$deleted',
                        joinedAt: '$createdAt',
                        numberOfPosts: { $size: { $ifNull: ['$posts', []] } },
                        numberOfFriends: { $size: { $ifNull: ['$friends', []] } },
                        rooms: 1
                    })
                    .lookup({
                        from: 'rooms',
                        localField: 'rooms',
                        foreignField: '_id',
                        as: 'rooms'
                    })
                    .unwind({
                        path: '$rooms',
                        preserveNullAndEmptyArrays: true
                    })
                    .addFields({
                        numberOfMessages: {
                            $cond: [{ $not: ['$rooms'] }, 0, { $size: '$rooms.messages' }]
                        }
                    })
                    .group({
                        _id: '$_id',
                        username: { $first: '$username' },
                        email: { $first: '$email' },
                        name: { $first: '$name' },
                        gender: { $first: '$gender' },
                        dob: { $first: '$dob' },
                        bio: { $first: '$bio' },
                        disabled: { $first: '$disabled' },
                        joinedAt: { $first: '$joinedAt' },
                        numberOfPosts: { $first: '$numberOfPosts' },
                        numberOfFriends: { $first: '$numberOfFriends' },
                        numberOfMessages: { $sum: '$numberOfMessages' }
                    }),
            ]);

            userInfo = userInfo.length > 0 ? userInfo[0] : userInfo;
            userPosts.forEach((value, index) => {
                userPosts[index].imgs = resourceHelper.getListPostImages(value._id);
            });

            res.status(200).json({
                status: 'success',
                data: {
                    ...userInfo,
                    posts: userPosts
                }
            });
        } catch (error) {
            console.log(error);
            res.status(500).json({
                status: 'error',
                message: 'Error at server'
            });
        }
    },


}