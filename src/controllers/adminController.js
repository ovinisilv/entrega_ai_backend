const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const admin = require('firebase-admin');

try {
  if (admin.apps.length === 0) {
    // Tenta ler a chave da variável de ambiente primeiro (para produção no Render)
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin inicializado via variável de ambiente.");
  }
} catch (error) {
  // Se falhar, tenta carregar o arquivo local (para desenvolvimento no seu PC)
  try {
    if (admin.apps.length === 0) {
      const serviceAccountFile = require('../../serviceAccountKey.json');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountFile)
      });
      console.log("Firebase Admin inicializado via arquivo local.");
    }
  } catch (fileError) {
     console.error("ERRO CRÍTICO: Nenhuma credencial do Firebase encontrada (nem variável de ambiente, nem arquivo). As notificações não funcionarão.", fileError);
  }
}


/**
 * Busca as estatísticas gerais da plataforma para o dashboard do admin.
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await prisma.user.count();
    const totalRestaurants = await prisma.restaurant.count();
    const pendingRestaurants = await prisma.restaurant.count({
      where: { isApproved: false }
    });
    const totalOrders = await prisma.order.count();

    res.json({
      totalUsers,
      totalRestaurants,
      pendingRestaurants,
      totalOrders
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar estatísticas.' });
  }
};


/**
 * Lista todos os restaurantes cadastrados na plataforma.
 */
exports.listRestaurants = async (req, res) => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      include: { owner: { select: { name: true, email: true } } }
    });
    res.json(restaurants);
  } catch (error) {
    res.status(500).json({ error: 'Não foi possível listar os restaurantes.' });
  }
};


/**
 * Aprova um restaurante pendente.
 */
exports.approveRestaurant = async (req, res) => {
  const { id } = req.params;
  try {
    const updatedRestaurant = await prisma.restaurant.update({
      where: { id: id },
      data: { isApproved: true }
    });
    res.json({ message: 'Restaurante aprovado com sucesso!', restaurant: updatedRestaurant });
  } catch (error) {
    res.status(500).json({ error: 'Não foi possível aprovar o restaurante.' });
  }
};


/**
 * Deleta um restaurante. O banco de dados se encarrega de deletar os dados associados.
 */
exports.deleteRestaurant = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.restaurant.delete({
      where: { id: id },
    });
    res.status(200).json({ message: 'Restaurante removido com sucesso.' });
  } catch (error) {
    console.error("ERRO DETALHADO AO DELETAR:", error);
    res.status(500).json({ error: 'Não foi possível remover o restaurante.' });
  }
};


/**
 * Envia uma notificação para todos os clientes.
 */
exports.sendNotificationToCustomers = async (req, res) => {
  const { title, body } = req.body;

  if (!title || !body) {
    return res.status(400).json({ error: 'Título e corpo da notificação são obrigatórios.' });
  }

  try {
    const customers = await prisma.user.findMany({
      where: {
        role: 'CLIENTE',
        fcmToken: { not: null }
      }
    });

    const tokens = customers.map(c => c.fcmToken).filter(Boolean);

    if (tokens.length === 0) {
      return res.status(404).json({ message: 'Nenhum token de notificação válido encontrado.' });
    }

    const response = await admin.messaging().sendEachForMulticast({
      tokens: tokens,
      notification: { title, body },
    });

    console.log(`${response.successCount} notificações enviadas com sucesso.`);
    console.log(`${response.failureCount} falharam.`);

    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.warn(`Erro no token ${tokens[idx]}:`, resp.error?.message);
        }
      });
    }

    res.status(200).json({ 
      message: `${response.successCount} notificações enviadas.`,
      failures: response.failureCount,
    });

  } catch (error) {
    console.error('Erro ao enviar notificação:', error.message);
    res.status(500).json({ error: 'Erro ao enviar notificações.', details: error.message });
  }
};
