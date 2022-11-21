const dotenv = require("dotenv").config();
// const db = require("../../configs/database");
// db.connect(process.env.DATABASE_CONNECTION);

const express = require("express");
const cors = require("cors");

// ExpressJS
const app = express();
// const route = require("./routers");
// cors:Cross-origin resource sharing -> là chia sẻ tài nguyên chéo nhau
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// route(app);

app.use("*", (req, res, next) => {
  res.send("url not found: this is server admin");
});

const port = process.env.PORT || 4000;
const host = "0.0.0.0";
app.listen(port, host, () => {
  console.log(`Admin server is running in port ${port}`);
});
