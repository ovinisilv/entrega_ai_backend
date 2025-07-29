const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/paymentWebhookController');

router.post('/mercadopago', webhookController.handlePaymentNotification);

module.exports = router;