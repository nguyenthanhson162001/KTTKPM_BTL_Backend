const authenMiddleware = require("..//midllewares/authenJWT.middleware");
const userController = require("..//controllers/user.controller");
module.exports = (app) => {
  app.use(
    "/statis/users",
    authenMiddleware.api,
    userController.getStatisticalUser
  );
  app.post(
    "/users/set-admin/:email",
    authenMiddleware.api,
    userController.setAdmin
  );
  app.post(
    "/users/diable-admin/:email",
    authenMiddleware.api,
    userController.disableAdmin
  );
};
