const router = require('express').Router();
const userController = require('../controllers/user.controller');

router.post('/v1/user/addNewUser', userController.addNewAccount);
router.get('/v1/user/:id', userController.getUserDetail);

module.exports = router;