const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, isAdmin } = require('../middlewares/authMiddleware');

// Aplica a proteção (login obrigatório e perfil de Admin) em todas as rotas
router.use(protect, isAdmin);

// Rotas de estatísticas
router.get('/stats', adminController.getDashboardStats);

// Rotas de gerenciamento de restaurantes
router.get('/restaurantes', adminController.listRestaurants);
router.put('/restaurantes/:id/aprovar', adminController.approveRestaurant);
router.delete('/restaurantes/:id', adminController.deleteRestaurant);

// Rotas de gerenciamento de usuários
router.get('/users', adminController.listAllUsers);
router.put('/motoboys/:id/approve', adminController.approveMotoboy);

// Rotas de notificação
router.post('/notifications/send-to-all', adminController.sendNotificationToCustomers);

module.exports = router;