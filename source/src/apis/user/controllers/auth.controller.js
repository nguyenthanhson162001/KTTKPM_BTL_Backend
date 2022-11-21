const dotenv = require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../../../models/user.model');
const Token = require('../../../models/token.model');
const mongooseHelper = require('../../../utils/mongo.helper');
const mail = require('../../../utils/nodemail.helper');
const crypto = require('../../../utils/crypto.hepler');
const { sign } = require('crypto');

const secretKey = process.env.SECRET_KEY;
const refreshSecretKey = process.env.REFRESH_SECRET_KEY;

const requestVerifyTokenLife = process.env.REQUEST_VERIFY_TOKEN_LIFE;
const requestResetTokenLife = process.env.REQUEST_RESET_TOKEN_LIFE;
const tokenLife = process.env.ACCESS_TOKEN_LIFE;
const refreshTokenLife = process.env.REFRESH_TOKEN_LIFE;

module.exports = {
    // [POST] /auth/signup
    async signup(req, res, next) {
        await mongooseHelper.executeTransactionWithRetry({
            async executeCallback(session) {
                const { username, email, password, name } = req.body;
                if (!(username && email && password && name)) throw new Error('400');
                // Check username exists
                let user = await User.findOne({ username }).lean();
                if (user) throw new Error('Username already exists');

                // Check email is used ?
                user = await User.findOne({ email }).lean();
                if (user) throw new Error('User with given email already exist');

                // Save account to database
                user = await new User({
                    username,
                    email,
                    auth: {
                        password: crypto.hash(password),
                        remainingTime: Date.now()
                    },
                    name
                }).save({
                    session
                });

                let token = jwt.sign(
                    {
                        username,
                        email
                    },
                    secretKey,
                    {
                        expiresIn: requestVerifyTokenLife,
                        subject: 'verify-email'
                    }
                );

                console.log(`Token: ${token}`)

                // Send mail
                mail.sendVerify({
                    to: email,
                    username,
                    token
                });
            },
            successCallback() {
                return res.status(201).json({
                    message: 'Account is created',
                    errorCode: 201
                });
            },
            errorCallback(error) {
                console.log(error);
                if (error?.message == 400)
                    return res.status(400).json({
                        message: 'Missing parameters',
                        errorCode: 400
                    });
                if (error?.name === 'Error')
                    return res.status(400).json({
                        message: error.message,
                        errorCode: 400
                    });
                res.status(500).json({
                    message: error.message,
                    errorCode: 500
                });
            }
        });
    },

    // [POST] /auth/request/verify-email
    async requestVerifyEmail(req, res) {
        try {
            let { username, email, newEmail } = req.body;
            if (!(username || email))
                return res.status(400).json({
                    message: 'Missing parameters',
                    errorCode: 400
                });

            //find user
            let user = await User.findOne({
                $or: [{ username }, { email }]
            })
                .select('auth')
                .lean();

            // check exist user have email to verify
            if (!user)
                return res.status(400).json({
                    message: 'Not contain account using this username or email',
                    errorCode: 400
                });

            // verify email already
            if (user.auth.isVerified && req.originalUrl.includes('auth/request/verify-email'))
                return res.status(200).json({
                    message: 'Email is verified already before',
                    errorCode: 400
                });

            let token = jwt.sign(
                {
                    username,
                    email: req.originalUrl.includes('auth/request/verify-email') ? email : newEmail
                },
                secretKey,
                {
                    expiresIn: requestVerifyTokenLife,
                    subject: 'verify-email'
                }
            );

            // Send mail
            mail.sendVerify({
                to: req.originalUrl.includes('auth/request/verify-email') ? email : newEmail,
                username: username,
                token
            });

            res.status(201).json({
                message: 'Verification email is send',
                errorCode: 201
            });
        } catch (error) {
            console.log(error.message);
            res.status(500).json({
                message: error.message,
                errorCode: 501
            });
        }
    },

    // [GET] /auth/verify-email
    async verifyEmail(req, res) {
        try {
            const token = req.params.token;
            console.log(token)

            if (!token) return res.status(400).json({ message: 'Missing parameters', errorCode: 400 });

            console.log(`Token: ${token}`)

            // Check token is valid
            let tokenErr;

            await jwt.verify(
                token,
                secretKey,
                {
                    subject: 'verify-email'
                },
                async (err, decoded) => {
                    if (err) tokenErr = err;
                    else {
                        let user = await User.findOne({
                            username: decoded.username
                        });
                        console.log(user)
                        if (
                            !user ||
                            (user.auth.isVerified && req.originalUrl.includes('/auth/verify-email'))
                        )
                            tokenErr = {
                                name: 'AccountError',
                                message: 'Account is not found or is already verified'
                            };
                        else {
                            user.auth.isVerified = true;
                            user.auth.remainingTime = undefined;
                            user.email = decoded.email;
                            await user.save();
                        }
                    }
                }
            );

            if (tokenErr)
                return res.status(400).json({
                    message: 'Token is invalid' + tokenErr,
                    errorCode: 400
                });

            return res.status(200).json({
                message: 'Email is verified',
                errorCode: 200
            });
        } catch (error) {
            console.log(error);
            return res.status(500).json({
                message: error.message,
                errorCode: 500
            });
        }
    },

    // [POST] /auth/login
    async login(req, res) {
        try {
            // Find user with id or email
            const { username, email, password } = req.body;

            if (!((username || email) && password))
                return res.status(400).json({ message: 'Missing parameters', errorCode: 400 });

            let user = await User.findOne({
                $or: [{ username }, { email }]
            })
                .select('username name email auth')
                .lean();

            if (!user)
                return res.status(400).json({
                    message: 'Username or email is not found',
                    errorCode: 400
                });

            // Check password
            if (!crypto.match(user.auth.password, password))
                return res.status(401).json({
                    message: 'Password is wrong',
                    errorCode: 401
                });

            if (user.auth.isVerified === false) {
                let token = jwt.sign(
                    {
                        username: user.username,
                        email: user.email
                    },
                    secretKey,
                    {
                        expiresIn: requestVerifyTokenLife,
                        subject: 'verify-email'
                    }
                );
                // Send mail
                mail.sendVerify({
                    to: user.email,
                    username: user.username,
                    token
                });

                return res.status(307).json({
                    message: 'Verify email of account',
                    errorCode: 400,
                    data: {
                        email: user.auth.email
                    }
                });
            }

            let payload = {
                userId: user._id,
                isAdmin: user.auth.isAdmin
            };

            let accessToken = jwt.sign(payload, secretKey, {
                expiresIn: tokenLife
            });

            let refreshToken = jwt.sign(payload, refreshSecretKey, {
                expiresIn: refreshTokenLife
            });

            await Token.create([
                {
                    refreshToken,
                    payload
                }
            ]);

            if (user.auth.isAdmin) user.isAdmin = true;
            user.auth = undefined;

            res.status(200).json({
                message: 'Login successful',
                errorCode: 200,
                data: {
                    accessToken,
                    refreshToken,
                    user
                }
            });
        } catch (error) {
            console.log(error.message);
            res.status(500).json({
                message: error.message,
                errorCode: 500
            });
        }
    },

    // [POST] /v1/auth/refresh-token
    async refreshToken(req, res) {
        try {
            let { refreshToken } = req.body;

            if (!refreshToken) return res.status(400).json({ message: 'Missing parameters', errorCode: 400 });

            let token = await Token.findOne({
                refreshToken
            }).lean();
            if (!token)
                return res.status(200).json({
                    message: 'Refresh token does not exist',
                    errorCode: 200
                });

            let errorMessage;
            jwt.verify(refreshToken, refreshSecretKey, (err, decoded) => {
                if (err) {
                    if (err.name === 'TokenExpiredError')
                        errorMessage = 'Expired refresh token. Login again to create new one';
                    else errorMessage = 'Invalid refresh token. Login again';
                }
            });
            if (errorMessage) {
                Token.deleteOne({
                    refreshToken
                });
                return res.status(400).json({
                    message: errorMessage,
                    errorCode: 400
                });
            }

            let newAccessToken = jwt.sign(token.payload, secretKey, {
                expiresIn: tokenLife
            });

            res.status(201).json({
                message: "Refresh successful",
                errorCode: 201,
                data: {
                    accessToken: newAccessToken,
                    refreshToken
                }
            });
        } catch (error) {
            console.log(error);
            res.status(500).json({
                message: error.message,
                errorCode: 500
            });
        }
    },

    // [PATCH] /auth/reset-password
    async resetPassword(req, res) {
        try {
            let { token, newPassword } = req.body;

            if (!(token && newPassword))
                return res.status(400).json({ message: 'Missing parameters', errorCode: 400 });

            let tokenErr;
            await jwt.verify(
                token,
                secretKey,
                {
                    subject: 'reset-password'
                },
                async (err, decoded) => {
                    if (err) tokenErr = err;
                    else {
                        let user = await User.findOne({
                            username: decoded.username
                        });
                        user.auth.password = crypto.hash(newPassword);
                        let savedUser = await user.save();
                        if (savedUser !== user) tokenErr = new Error('Password is not updated');
                    }
                }
            );
            if (tokenErr) {
                if (tokenErr.name === 'Error') throw tokenErr;
                return res.status(400).json({
                    message: 'Token is invalid or expired',
                    errorCode: 400
                });
            }
            res.status(200).json({
                message: 'Password is updated',
                errorCode: 200
            });
        } catch (error) {
            console.log(error.message);
            res.status(500).json({
                message: error.message,
                errorCode: 500
            });
        }
    },

    // [POST] /auth/request/reset-password
    async requestResetPassword(req, res) {
        try {
            const { username, email } = req.body;

            if (!(username || email))
                return res.status(400).json({ message: 'Missing parameters', errorCode: 400 });

            let user = await User.findOne({
                $or: [{ username }, { email }]
            }).lean();

            if (!user)
                return res.status(400).json({
                    message: 'Not found an account with this username (or email)',
                    errorCode: 400
                });

            let token = jwt.sign(
                {
                    username: user.username,
                    email: user.email
                },
                secretKey,
                {
                    expiresIn: requestResetTokenLife,
                    subject: 'reset-password'
                }
            );

            mail.sendResetPassword({
                to: user.email,
                username: user.username,
                token
            });

            res.status(200).json({
                message: 'Reset password email is send',
                errorCode: 400,
                data: {
                    email: user.email
                }
            });
        } catch (error) {
            console.log(error.message);
            res.status(500).json({
                message: error.message,
                errorCode: 500
            });
        }
    },
}