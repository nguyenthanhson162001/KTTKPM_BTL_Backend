const router = require('express').Router();
const messageController = require('../controllers/messenger.controller');
const updateFile = require('../middlewares/upload.middleware');


router.post('/addFile', messageController.addFile);
router.post('/delete', messageController.deleteMessagse);

module.exports = router;