const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { protect } = require('../middlewares/authMiddleware');

// Rota para o cliente criar um novo pedido e preferência de pagamento
// A função no controller deve ser 'createOrderAndPreference' ou 'createPagarmeOrder'
router.post('/', protect, orderController.createOrderAndPreference);

// Rota para o cliente buscar seu histórico de pedidos
router.get('/my-history', protect, orderController.getMyOrderHistory);

// Rota para o cliente ou motoboy buscar os detalhes de um pedido específico
router.get('/:id', protect, orderController.getOrderDetails);

module.exports = router;