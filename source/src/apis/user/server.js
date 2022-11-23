const dotenv = require("dotenv").config();
const db = require("../../configs/database");
const socketio = require("../../configs/socket");
const express = require("express");
const cors = require("cors");
// ExpressJS
const app = express();
const useragent = require("express-useragent");
const route = require("./routers");

const swaggerJSDOc = require("swagger-jsdoc");
const swaggerUI = require("swagger-ui-express");

db.connect(process.env.DATABASE_CONNECTION);

app.use(cors());
app.use(express.static(__dirname + "../../../resources"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "50mb" }));
app.use(helmet());
route(app);

const server = require("http").Server(app);

// Socket.io
const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  },
});

const socketHandler = require("./listeners");
socketHandler(io);

const port = process.env.PORT || 7070;
const host = "0.0.0.0";
const optionps = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "App social network",
      version: "1.0.0",
    },
    servers: [
      {
        url: "http://localhost:3000/v1",
      },
    ],
  },
  apis: ["server.js"],
};

const swaggerSpec = swaggerJSDOc(optionps);
console.log(swaggerJSDOc);
/**
 * @swagger
 * /api-doc:
 *      get:
 *         decription: Get all api
 *         reponses:
 *           200:
 *              decription: success
 */
app.use("/api-docs", swaggerUI.serve, swaggerUI.setup(swaggerSpec));

// test add file
app.use("*", (req, res, next) => {
  res.send("url not found: this is server main");
});
server.listen(port, host, () => {
  console.log(`User server is running in port ${port}`);
});
