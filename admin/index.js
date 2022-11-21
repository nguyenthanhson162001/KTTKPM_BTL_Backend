require("dotenv").config();
require("./src/configs/database").connect(process.env.DATABASE_CONNECTION);
const helmet = require("helmet");
var morgan = require("morgan");
const route = require("./src/routes");

const express = require("express");
const cors = require("cors");

// ExpressJS
const app = express();

app.use(helmet());

// cors:Cross-origin resource sharing -> là chia sẻ tài nguyên chéo nhau
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(helmet());
app.use(morgan("tiny"));

route(app);

app.use("*", (req, res, next) => {
  res.send("*url not found: this is server admin");
});

const port = process.env.PORT || 4000;
const host = "0.0.0.0";
app.listen(port, host, () => {
  console.log(`Admin server is running in port ${port}`);
});
