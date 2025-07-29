require('dotenv').config();
const express = require('express');
const cors = require('cors');
const userRoutes = require('./src/routes/userRoutes'); // <-- Adicione
// Importa as rotas
const authRoutes = require('./src/routes/authRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const restaurantRoutes = require('./src/routes/restaurantRoutes');
const publicRoutes = require('./src/routes/publicRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const deliveryRoutes = require('./src/routes/deliveryRoutes');
const webhookRoutes = require('./src/routes/webhookRoutes'); // <-- Rota para notificações de pagamento
const cashoutRoutes = require('./src/routes/cashoutRoutes'); // <-- Rota para saques
const admin = require('firebase-admin');
const startSchedulers = require('./src/services/notificationScheduler'); // <-- 1. IMPORTE O AGENDADOR


const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Bem-vindo à API do Entrega Aí!');
});

// Usa as rotas importadas com seus prefixos
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/restaurant', restaurantRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/cashout', cashoutRoutes);
app.use('/api/users', userRoutes); // <-- Adicione

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  startSchedulers();
});