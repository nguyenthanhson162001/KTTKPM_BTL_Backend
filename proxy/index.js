const express = require("express");
require("dotenv").config();
require("express-async-errors");
const port = process.env.PORT | 5001;
const { createProxyMiddleware } = require("http-proxy-middleware");
const helmet = require("helmet");
var morgan = require("morgan");

// proxy middleware options
/** @type {import('http-proxy-middleware/dist/types').Options} */
const url = process.env.TARGET;
const serverAPI = process.env.URL_API;
const serverAdmin = process.env.URL_ADMIN;
// const wsProxy = createProxyMiddleware({
//   target: "http://ws.ifelse.io",
//   changeOrigin: true, // for vhosted sites, changes host header to match to target's host
//   ws: true, // enable websocket proxy
//   logger: console,
//   router: {
//     "/api": serverAPI,
//   },
// });
const options = {
  target: url, // target host
  changeOrigin: true, // needed for virtual hosted sites
  ws: true,
  logger: console,
  pathRewrite: {
    "^/admin": "/", // rewrite path
    "^/": "/", // rewrite path
  },
  router: {
    "/": serverAPI,
    "/admin": serverAdmin,
  },
  onProxyReqWs: (proxyReq, req, socket) => {
    socket.on("error", function (error) {
      console.warn("Websockets error.", error);
    });
  },
};
// create the proxy (without context)
const proxy = createProxyMiddleware(options);

// mount `exampleProxy` in web server
const app = express();
app.use(morgan("tiny"));

app.use(helmet());
app.use(proxy);
// app.use(wsProxy);

app.use("*", (req, res, next) => {
  res.send("url not found: this is server proxy");
});

const server = app.listen(port, () =>
  console.log(`proxy start on port ${port}   `)
);
server.on("upgrade", proxy.upgrade); // optional: upgrade externally
