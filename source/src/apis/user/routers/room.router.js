const router = require('express').Router();
const controller = require('../controllers/room.controller');

router.get('/check', controller.checkRoom);
router.get('/:roomId', controller.loadMessage);
router.get('/', controller.getRooms);
router.get('/getAllPinMessage/:roomId', controller.getAllPinMessage);

router.get("/groups/getAll", controller.getGroupRooms);

router.post("/groups/add", controller.addGroups);

// router.delete('/groups/leave/:userId', controller.leaveGroup);
module.exports = router;