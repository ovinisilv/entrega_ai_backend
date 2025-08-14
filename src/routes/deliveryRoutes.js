const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/deliveryController');
const { protect } = require('../middlewares/authMiddleware');

// Todas as rotas de motoboy exigem login
router.use(protect);

router.get('/available', deliveryController.listAvailableDeliveries);
router.put('/:id/accept', deliveryController.acceptDelivery);
router.put('/:id/status', deliveryController.updateDeliveryStatus);
router.post('/:id/confirm', deliveryController.confirmDelivery);

module.exports = router;