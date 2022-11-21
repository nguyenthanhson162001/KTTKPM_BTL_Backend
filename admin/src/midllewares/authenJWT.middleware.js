const dotenv = require("dotenv").config();
const jwt = require("jsonwebtoken");
const User = require("..//models/user.model");

module.exports = {

  async socket(socket, next) {
    try {
      const [token, userId, username] = [
        socket.handshake.auth["access-token"] ||
          socket.handshake.auth.accessToken ||
          socket.handshake.headers["access-token"] ||
          socket.handshake.headers["authorization"] ||
          socket.handshake.headers.authorization,
        socket.handshake.auth.userId || socket.handshake.headers["user-id"],
        socket.handshake.auth.username || socket.handshake.headers.username,
      ];

      if (!token) throw new Error("Token is not provided");

      let payload = await jwt.verify(token, process.env.SECRET_KEY);

      socket.handshake.auth = {
        accessToken: token,
        userId: payload.userId,
      };
      console.log("payloaf: " + JSON.stringify(payload));
      let checkUser = await User.exists({
        _id: payload.userId,
        deleted: false,
      });

      if (!checkUser) throw new Error("User is disabled or deleted");
      next();
    } catch (error) {
      console.log(error);
      next(new Error("Unauthorized"));
    }
  },
  
  async api(req, res, next) {
    try {
      let token =
        req.body.accessToken ||
        req.query.accessToken ||
        req.headers["access-token"] ||
        req.headers["authorization"] ||
        req.headers.authorization;
      // console.log("🚀 ~ file: authenJWT.middleware.js ~ line 10 ~ api ~  req.headers", req.headers) // alt + crl +l

      if (!token) throw new Error("Token is not provided");

      let payload = await jwt.verify(token, process.env.SECRET_KEY);
      if (!payload.isAdmin)
        throw new Error("Account does not allowed to access");
      else req.auth = payload;
      if (!(await User.exists({ _id: payload.userId, deleted: false }))) {
        throw new Error("User is disable or deleted");
      }

      next();
    } catch (err) {
      console.log(err);
      console.log(err.name + ": " + err.message);
      return res.status(401).json({
        status: "error",
        message: err.message || "Unauthorized",
      });
    }
  },
};
