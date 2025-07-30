const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/update-fcm-token', protect, userController.updateFcmToken);
router.post('/update-pix-key', protect, userController.updatePixKey);

module.exports = router;
