const userRouter = require('./user_router');
const authenMiddleware = require('../middlewares/authenJWT.middleware');

module.exports = app => {
    app.use('/v1/users', authenMiddleware, userRouter);
};