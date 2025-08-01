const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { MercadoPagoConfig, Preference } = require('mercadopago');

// Configura o cliente do Mercado Pago com seu Access Token
const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });

/**
 * Cria um novo pedido no banco de dados e uma preferência de pagamento no Mercado Pago.
 */
exports.createOrderAndPreference = async (req, res) => {
  // Adicionamos o 'deliveryAddress' que vem do app
  const { restaurantId, items, deliveryAddress } = req.body;
  const userId = req.user.userId; // ID do cliente logado (vem do token)

  try {
    // Validação
    if (!restaurantId || !items || items.length === 0 || !deliveryAddress) {
      return res.status(400).json({ error: 'Dados do pedido inválidos.' });
    }

    // 1. Buscar os preços dos pratos no banco de dados (por segurança)
    const dishIds = items.map(item => item.dishId);
    const dishesFromDb = await prisma.dish.findMany({
      where: { id: { in: dishIds } },
    });

    // 2. Calcular o preço total no backend
    let totalPrice = 0;
    const orderItemsData = items.map(item => {
      const dish = dishesFromDb.find(d => d.id === item.dishId);
      if (!dish) throw new Error(`Prato com ID ${item.dishId} não encontrado.`);
      totalPrice += dish.price * item.quantity;
      return {
        quantity: item.quantity,
        price: dish.price,
        dishId: dish.id,
      };
    });

    // 3. Criar o Pedido no nosso banco com status PENDENTE e o endereço de entrega
    const order = await prisma.order.create({
      data: {
        totalPrice,
        deliveryAddress, // Salva o endereço de entrega
        status: 'PENDENTE',
        userId,
        restaurantId,
        items: {
          create: orderItemsData,
        },
      },
    });

    // 4. Criar a "Preferência de Pagamento" no Mercado Pago
    const preference = new Preference(client);
    const result = await preference.create({
      body: {
        items: items.map(item => {
            // ... (mapeamento dos itens)
        }),
        external_reference: order.id,
        
        // --- ADICIONE ESTA SEÇÃO PARA CONTROLAR OS PAGAMENTOS ---
        payment_methods: {
          excluded_payment_types: [
            { "id": "ticket" } // "ticket" é o ID para boletos no Mercado Pago
          ]
          // Não precisamos incluir o PIX aqui, ele já aparece por padrão
          // se sua conta estiver habilitada.
        },
        // ----------------------------------------------------

        back_urls: {
            success: "entregaai://success",
            failure: "entregaai://failure",
            pending: "entregaai://pending",
        },
        auto_return: "approved",
      },
    });

    // 5. Enviar a URL de checkout de volta para o app Flutter
    res.status(201).json({ checkoutUrl: result.init_point, orderId: order.id });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao processar o pedido.' });
  }
};


/**
 * Busca os detalhes de um pedido específico.
 * Acessível pelo cliente dono do pedido ou pelo motoboy atribuído.
 */
exports.getOrderDetails = async (req, res) => {
    const { id } = req.params; // ID do pedido
    const userId = req.user.userId; // ID do usuário logado

    try {
        const order = await prisma.order.findFirst({
            where: {
                id: id,
                // Garante que ou o cliente ou o motoboy do pedido possam vê-lo
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
            return res.status(404).json({ error: 'Pedido não encontrado ou acesso negado.' });
        }
        res.json(order);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar detalhes do pedido.' });
    }
}
