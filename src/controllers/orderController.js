const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { MercadoPagoConfig, Preference } = require('mercadopago');

const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });

exports.createOrderAndPreference = async (req, res) => {
  const { restaurantId, items, deliveryAddress } = req.body;
  const userId = req.user.userId;

  try {
    // Validação básica dos dados de entrada
    if (!restaurantId || !items?.length || !deliveryAddress) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    // Verifica se os itens têm quantidade válida
    if (items.some(item => item.quantity <= 0)) {
      return res.status(400).json({ error: 'Quantidade inválida para um ou mais itens' });
    }

    // Busca os pratos no banco de dados
    const dishesFromDb = await prisma.dish.findMany({
      where: { id: { in: items.map(i => i.dishId) }, restaurantId },
    });

    // Verifica se todos os pratos foram encontrados
    if (dishesFromDb.length !== items.length) {
      const missingDishes = items.filter(item => 
        !dishesFromDb.some(dish => dish.id === item.dishId))
        .map(item => item.dishId);
      return res.status(404).json({ 
        error: 'Alguns pratos não foram encontrados',
        missingDishes 
      });
    }

    // Calcula o total e prepara os itens para o pedido
    let totalPrice = 0;
    const orderItemsData = items.map(item => {
      const dish = dishesFromDb.find(d => d.id === item.dishId);
      totalPrice += dish.price * item.quantity;
      return {
        quantity: item.quantity,
        price: dish.price,
        dishId: dish.id,
      };
    });

    // Cria o pedido no banco de dados
    const order = await prisma.order.create({
      data: {
        totalPrice,
        deliveryAddress,
        status: 'PENDENTE',
        userId,
        restaurantId,
        items: { create: orderItemsData },
      },
      include: {
        restaurant: {
          select: {
            name: true,
            imageUrl: true
          }
        }
      }
    });

    // Prepara os itens para o Mercado Pago
    const mpItems = items.map(item => {
      const dish = dishesFromDb.find(d => d.id === item.dishId);
      return {
        id: dish.id,
        title: `${dish.name} - ${order.restaurant.name}`.substring(0, 50),
        description: dish.description?.substring(0, 100) || '',
        quantity: item.quantity,
        currency_id: 'BRL',
        unit_price: parseFloat(dish.price.toFixed(2)),
        picture_url: dish.imageUrl || order.restaurant.imageUrl || null,
      };
    });

    // Configuração da preferência no Mercado Pago
    const preference = new Preference(client);
    const preferenceData = {
      items: mpItems,
      payment_methods: {
        excluded_payment_types: [
          { id: 'ticket' }, // Remove boleto
          { id: 'atm' }     // Remove caixas eletrônicos (opcional)
        ],
        installments: 12, // Número máximo de parcelas
        default_installments: 1 // Parcelamento padrão
      },
      external_reference: order.id.toString(),
      back_urls: {
        success: `${process.env.APP_DEEP_LINK}/success`,
        failure: `${process.env.APP_DEEP_LINK}/failure`,
        pending: `${process.env.APP_DEEP_LINK}/pending`,
      },
      auto_return: "approved",
      notification_url: process.env.MP_WEBHOOK_URL || null,
      statement_descriptor: `EntregaAi ${order.restaurant.name.substring(0, 12)}`,
    };

    // Cria a preferência no Mercado Pago
    const result = await preference.create({ body: preferenceData });

    // Retorna a resposta com os dados necessários
    res.status(201).json({
      success: true,
      checkoutUrl: result.sandbox_init_point || result.init_point,
      orderId: order.id,
      orderDetails: {
        total: order.totalPrice,
        restaurant: order.restaurant.name,
        items: mpItems.map(item => ({
          name: item.title,
          quantity: item.quantity,
          price: item.unit_price
        }))
      }
    });

  } catch (error) {
    console.error('Falha ao criar pedido:', error);
    res.status(500).json({ 
      error: 'Erro no servidor',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

exports.getOrderDetails = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  try {
    const order = await prisma.order.findFirst({
      where: {
        id: id,
        OR: [
          { userId: userId },
          { deliveryById: userId }
        ]
      },
      include: {
        items: { 
          include: { 
            dish: { 
              select: { 
                name: true, 
                description: true, 
                price: true,
                imageUrl: true
              } 
            } 
          } 
        },
        user: { select: { name: true, phone: true } },
        restaurant: { 
          select: { 
            name: true, 
            address: true,
            imageUrl: true,
            deliveryFee: true
          } 
        },
        deliveryBy: { select: { name: true, phone: true } },
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    // Formata a resposta
    const response = {
      id: order.id,
      status: order.status,
      createdAt: order.createdAt,
      totalPrice: order.totalPrice,
      deliveryAddress: order.deliveryAddress,
      user: order.user,
      restaurant: order.restaurant,
      deliveryBy: order.deliveryBy,
      items: order.items.map(item => ({
        id: item.id,
        quantity: item.quantity,
        price: item.price,
        dish: item.dish
      }))
    };

    res.json(response);
  } catch (error) {
    console.error('Erro ao buscar pedido:', error);
    res.status(500).json({ 
      error: 'Falha ao buscar pedido',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Atualizar status do pedido (útil para webhooks do Mercado Pago)
exports.updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const allowedStatuses = ['PENDENTE', 'PREPARANDO', 'PRONTO', 'EM_TRANSITO', 'ENTREGUE', 'CANCELADO'];

  try {
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status },
      include: {
        user: { select: { id: true } },
        deliveryBy: { select: { id: true } }
      }
    });

    // Aqui você pode adicionar notificações push ou emails
    // dependendo da mudança de status

    res.json(updatedOrder);
  } catch (error) {
    console.error('Erro ao atualizar pedido:', error);
    res.status(500).json({ error: 'Falha ao atualizar pedido' });
  }
};