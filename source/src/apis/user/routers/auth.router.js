const router = require('express').Router();
const authController = require('../controllers/auth.controller');

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/request/verify-email', authController.requestVerifyEmail);
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/request/reset-password', authController.requestResetPassword);
router.patch('/reset-password', authController.resetPassword);
router.post('/refresh-token', authController.refreshToken);

module.exports = router;
