const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const admin = require('firebase-admin');

// Inicialização do Firebase Admin (mantido igual)
try {
  if (admin.apps.length === 0) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin inicializado via variável de ambiente.");
  }
} catch (error) {
  try {
    if (admin.apps.length === 0) {
      const serviceAccountFile = require('../../serviceAccountKey.json');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountFile)
      });
      console.log("Firebase Admin inicializado via arquivo local.");
    }
  } catch (fileError) {
     console.error("ERRO CRÍTICO: Nenhuma credencial do Firebase encontrada.", fileError);
  }
}

exports.listAllUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao listar usuários.' });
    }
};

exports.approveMotoboy = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.user.update({
            where: { id: id, role: 'MOTOBOY' },
            data: { isApproved: true }
        });
        res.status(200).json({ message: 'Motoboy aprovado com sucesso.' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao aprovar motoboy.' });
    }
};

/**
 * Busca as estatísticas completas da plataforma para o dashboard do admin
 * Agora incluindo as novas métricas financeiras e pedidos por restaurante
 */
exports.getDashboardStats = async (req, res) => {
  try {
    // Estatísticas básicas
    const [
      totalUsers, 
      totalRestaurants, 
      pendingRestaurants, 
      totalOrders,
      completedOrders,
      financialStats,
      motoboyStats
    ] = await Promise.all([
      prisma.user.count(),
      prisma.restaurant.count({ where: { isApproved: true } }),
      prisma.restaurant.count({ where: { isApproved: false } }),
      prisma.order.count(),
      prisma.order.count({ where: { status: 'ENTREGUE' } }),
      prisma.order.aggregate({
        _sum: {
          totalPrice: true,
          deliveryFee: true
        },
        where: {
          status: 'ENTREGUE'
        }
      }),
      prisma.user.aggregate({
        _count: {
          id: true
        },
        where: {
          role: 'MOTOBOY',
          isApproved: true
        }
      })
    ]);

    // Calcula a média de pedidos por restaurante (evitando divisão por zero)
    const ordersPerRestaurant = totalRestaurants > 0 
      ? Math.round(completedOrders / totalRestaurants) 
      : 0;

    // Calcula o valor médio por pedido entregue
    const averageOrderValue = completedOrders > 0
      ? (financialStats._sum.totalPrice / completedOrders).toFixed(2)
      : 0;

    res.json({
      // Estatísticas básicas
      totalUsers,
      totalRestaurants,
      pendingRestaurants,
      totalOrders,
      completedOrders,
      
      // Novas métricas financeiras
      ordersPerRestaurant,
      totalRestaurantValue: financialStats._sum.totalPrice || 0,
      totalDeliveryValue: financialStats._sum.deliveryFee || 0,
      averageOrderValue: parseFloat(averageOrderValue),
      
      // Estatísticas de motoboys
      activeMotoboys: motoboyStats._count.id || 0,
      
      // Taxa de conversão (pedidos completos vs totais)
      completionRate: totalOrders > 0 
        ? ((completedOrders / totalOrders) * 100).toFixed(2) + '%'
        : '0%'
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar estatísticas.',
      details: error.message 
    });
  }
};

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