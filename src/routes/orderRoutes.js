const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { protect } = require('../middlewares/authMiddleware');

// O cliente precisa estar logado para criar um pedido
router.post('/', protect, orderController.createOrderAndPreference);
router.get('/my-history', protect, orderController.getMyOrderHistory); // <-- ROTA NOVA
router.get('/:id', protect, orderController.getOrderDetails); // <-- ADICIONE ESTA LINHA
// ...

module.exports = router;