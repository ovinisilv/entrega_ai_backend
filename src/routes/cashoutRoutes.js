const express = require('express');
const router = express.Router();
const cashoutController = require('../controllers/cashoutController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect); // Todas as rotas aqui exigem login

router.get('/balance', cashoutController.getBalance);
router.post('/request', cashoutController.requestCashout);

module.exports = router;