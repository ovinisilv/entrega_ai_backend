const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { MercadoPagoConfig, Preference } = require('mercadopago');

const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });

exports.createOrderAndPreference = async (req, res) => {
  const { restaurantId, items, deliveryAddress } = req.body;
  const userId = req.user.userId;

  try {
    // Validação básica
    if (!restaurantId || !items?.length || !deliveryAddress) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    // Busca os pratos no banco
    const dishesFromDb = await prisma.dish.findMany({
      where: { id: { in: items.map(i => i.dishId) } },
    });

    // Calcula o total e prepara os itens
    let totalPrice = 0;
    const orderItemsData = items.map(item => {
      const dish = dishesFromDb.find(d => d.id === item.dishId);
      if (!dish) throw new Error(`Prato ${item.dishId} não encontrado`);
      
      totalPrice += dish.price * item.quantity;
      return {
        quantity: item.quantity,
        price: dish.price,
        dishId: dish.id,
      };
    });

    // Cria o pedido no banco
    const order = await prisma.order.create({
      data: {
        totalPrice,
        deliveryAddress,
        status: 'PENDENTE',
        userId,
        restaurantId,
        items: { create: orderItemsData },
      },
    });

    // Prepara os itens para o Mercado Pago (AQUI ESTAVA O ERRO - FALTANDO ESTA PARTE)
    const mpItems = items.map(item => {
      const dish = dishesFromDb.find(d => d.id === item.dishId);
      return {
        id: dish.id,
        title: dish.name.substring(0, 50),
        quantity: item.quantity,
        currency_id: 'BRL',
        unit_price: dish.price,
      };
    });


    // Configuração do Mercado Pago
     const preference = new Preference(client);
    const preferenceData = {
      items: mpItems,
      payment_methods: {
        excluded_payment_types: [
          { id: 'ticket' }, // Remove boleto
          { id: 'atm' }     // Remove caixas eletrônicos (opcional)
        ],
        installments: 1, // Número máximo de parcelas
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


    // Retorna só o necessário
    res.status(200).json({
      success: true,
      checkoutUrl: result.init_point,
      orderId: order.id,
    });

  } catch (error) {
    console.error('Falha ao criar pedido:', error);
    res.status(500).json({ 
      error: 'Erro no servidor',
      message: error.message 
    });
  }
};

// Get order details (mantido igual)
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
        items: { include: { dish: true } },
        user: { select: { name: true } },
        restaurant: { select: { name: true, address: true } },
        deliveryBy: { select: { name: true } },
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }
    res.json(order);
  } catch (error) {
    console.error('Erro:', error);
    res.status(500).json({ error: 'Falha ao buscar pedido' });
  }
};