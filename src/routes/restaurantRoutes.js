const express = require('express');
const router = express.Router();
const multer = require('multer');
const storage = require('../config/cloudinary'); // Importa a configuração do Cloudinary
const upload = multer({ storage }); // Configura o multer para o upload

// Importa os middlewares e controladores
const { protect } = require('../middlewares/authMiddleware');
const profileController = require('../controllers/restaurantProfileController');
const dishController = require('../controllers/dishController');
const orderController = require('../controllers/restaurantOrderController');
const reportsController = require('../controllers/reportsController'); // <-- IMPORTE O NOVO CONTROLADOR


// --- Rota de Upload de Imagem ---
// Esta rota precisa vir antes das outras rotas '/dishes' para evitar conflitos.
// 'dish_image' é o nome do campo que o Flutter vai enviar.
router.post('/dishes/upload', protect, upload.single('dish_image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }
    // Retorna a URL segura da imagem salva no Cloudinary
    res.status(200).json({ imageUrl: req.file.path });
});

// --- Rotas de Perfil ---
router.get('/profile', protect, profileController.getProfile);
router.put('/profile', protect, profileController.updateProfile);

// --- Rotas de Pratos (CRUD) ---
router.post('/dishes', protect, dishController.createDish);
router.get('/dishes', protect, dishController.listDishes);
router.put('/dishes/:id', protect, dishController.updateDish);
router.delete('/dishes/:id', protect, dishController.deleteDish);

// --- Rotas de Pedidos ---
router.get('/orders/active', protect, orderController.listActiveOrders);
router.put('/orders/:id/status', protect, orderController.updateOrderStatus);
router.get('/orders/history', protect, orderController.getOrderHistory); // <-- ROTA NOVA

// --- ROTA DE RELATÓRIOS ---
router.get('/reports/summary', protect, reportsController.getRestaurantSummary);


module.exports = router;
