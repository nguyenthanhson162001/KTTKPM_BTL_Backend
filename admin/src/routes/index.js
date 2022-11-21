// const authenMiddleware = require("../middlewares/authenJWT.middleware");
const userController = require("..//controllers/user.controller");
module.exports = (app) => {
  app.use("/statis/users", userController.getStatisticalUser);
};
