const userRouter = require('./user.router');
const authRouter = require('./auth.router');
const roomRouter = require('./room.router');
const messageRouter = require('./message.router');
const postRouter = require('../routers/post.router');
const authenJwtMiddleware = require('../middlewares/authenJwt.middleware').api;

module.exports = app => {
    app.use('/v1/auth', authRouter);
    app.use('/v1/user', authenJwtMiddleware, userRouter);
    app.use('/v1/room', authenJwtMiddleware, roomRouter);
    app.use('/v1/message', authenJwtMiddleware, messageRouter);
    app.use('/v1/post', authenJwtMiddleware, postRouter);
};
