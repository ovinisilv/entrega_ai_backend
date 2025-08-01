const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { MercadoPagoConfig, Preference } = require('mercadopago');

// Configura o cliente do Mercado Pago com seu Access Token
const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });

/**
 * Cria um novo pedido no banco de dados e uma preferência de pagamento no Mercado Pago.
 */
exports.createOrderAndPreference = async (req, res) => {
  const { restaurantId, items, deliveryAddress } = req.body;
  const userId = req.user.userId; // ID do cliente logado (vem do token)

  try {
    // Validação inicial
    if (!restaurantId || !items || items.length === 0 || !deliveryAddress) {
      return res.status(400).json({ error: 'Dados do pedido inválidos.' });
    }

    // 1. Buscar os preços e detalhes dos pratos no banco de dados (por segurança)
    const dishIds = items.map(item => item.dishId);
    const dishesFromDb = await prisma.dish.findMany({
      where: { id: { in: dishIds } },
    });

    // 2. Calcular o preço total e validar os itens no backend
    let totalPrice = 0;
    const orderItemsData = items.map(item => {
      const dish = dishesFromDb.find(d => d.id === item.dishId);
      if (!dish) {
        // Lança um erro que será capturado pelo bloco catch
        throw new Error(`Prato com ID ${item.dishId} não encontrado.`);
      }
      totalPrice += dish.price * item.quantity;
      return {
        quantity: item.quantity,
        price: dish.price,
        dishId: dish.id,
      };
    });

    // 3. Criar o Pedido no banco de dados com status PENDENTE
    const order = await prisma.order.create({
      data: {
        totalPrice,
        deliveryAddress,
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
    
    // 5. Enviar a URL de checkout (init_point) de volta para o app
    res.status(201).json({ checkoutUrl: result.init_point, orderId: order.id });

  } catch (error) {
    console.error('Erro detalhado ao criar pedido e preferência:', error);
    // Retorna uma mensagem de erro mais específica se o prato não for encontrado
    if (error.message.includes("Prato com ID")) {
        return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Erro ao processar o pedido.' });
  }
};

/**
 * Busca os detalhes de um pedido específico.
 */
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
            return res.status(404).json({ error: 'Pedido não encontrado ou acesso negado.' });
        }
        res.json(order);
    } catch (error) {
        console.error('Erro ao buscar detalhes do pedido:', error);
        res.status(500).json({ error: 'Erro ao buscar detalhes do pedido.' });
    }
};
