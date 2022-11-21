const dotenv = require('dotenv').config();
const db = require('../../configs/database');
db.connect(process.env.DATABASE_CONNECTION);

const express = require('express');
const cors = require('cors');

// ExpressJS
const app = express();
const route = require('./routers');

// cors:Cross-origin resource sharing -> là chia sẻ tài nguyên chéo nhau
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

route(app);

const port = process.env.PORT || 7071;
const host = '0.0.0.0';
app.listen(port, host, () => {
    console.log(`Admin server is running in port ${port}`);
});
