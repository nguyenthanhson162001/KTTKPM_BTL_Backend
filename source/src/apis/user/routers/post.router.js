const router = require('express').Router();
const controller = require('../controllers/post.controller');


router.post('/new', controller.addNewPost);

module.exports = router;
