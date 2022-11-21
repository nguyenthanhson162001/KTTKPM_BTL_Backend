const router = require('express').Router();
const userController = require('../controllers/user.controller');

//==== user
router.get('/me/profile', userController.getMyProfile);
router.get('/:userId', userController.getUserProfile);
router.get('/search/:keyword', userController.searchUser);
router.post('/upload/avatar', userController.uploadProfilePicture);
//=== notification of user
router.get('/notifications/all', userController.getAllNotification);
router.get('/notification/check', userController.checkNotification);

//======= friends ==
router.get('/friends/getAll', userController.getAllFriends);
router.post('/friends/accept-request', userController.acceptAddFriendRequest);
router.post('/friends/decline-request', userController.declineAddFriendRequest);
router.post('/friends/undo-request', userController.undoAddFriendRequest);
router.post('/friends/unfriend', userController.unfriend);

module.exports = router;