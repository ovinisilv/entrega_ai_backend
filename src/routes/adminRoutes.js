const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, isAdmin } = require('../middlewares/authMiddleware');

// Aplica a proteção (login obrigatório e perfil de Admin) em todas as rotas deste arquivo
router.use(protect, isAdmin);

// Rota para buscar as estatísticas do dashboard
router.get('/stats', adminController.getDashboardStats);

// Rota para listar os restaurantes para gerenciamento
router.get('/restaurantes', adminController.listRestaurants);

// Rota para aprovar um restaurante
router.put('/restaurantes/:id/aprovar', adminController.approveRestaurant);

// ...
// Adicione a nova rota
router.post('/notifications/send-to-all', adminController.sendNotificationToCustomers);
// ...
//ROTA DE REMOÇÃO
router.delete('/restaurantes/:id', adminController.deleteRestaurant);

// --- NOVAS ROTAS DE GESTÃO DE USUÁRIOS ---
router.get('/users', adminController.listAllUsers);
router.put('/motoboys/:id/approve', adminController.approveMotoboy);

module.exports = router;
