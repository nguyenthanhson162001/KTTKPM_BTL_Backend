const express = require("express");
require("dotenv").config();
const port = process.env.PORT | 5000;
const { createProxyMiddleware } = require("http-proxy-middleware");
const helmet = require("helmet");
var morgan = require("morgan");

// proxy middleware options
/** @type {import('http-proxy-middleware/dist/types').Options} */
const url = process.env.TARGET | "http://localhost:5000";
const serverAPI = process.env.URL_API;
const serverAdmin = process.env.URL_ADMIN;
const options = {
  target: url, // target host
  changeOrigin: true, // needed for virtual hosted sites
  ws: true, // proxy websockets
  pathRewrite: {
    "^/admin": "/", // rewrite path
  },
  router: {
    "/api": serverAPI,
    "/admin": serverAdmin,
  },
};
// create the proxy (without context)
const exampleProxy = createProxyMiddleware(options);

// mount `exampleProxy` in web server
const app = express();
app.use(morgan("tiny"));

app.use(helmet());
app.use("/", exampleProxy);

app.use("*", (req, res, next) => {
  res.send("url not found: this is server proxy");
});

app.listen(port, () => console.log(`proxy start on port ${port}   `));
