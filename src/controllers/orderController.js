const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const pagarme = require('pagarme');

exports.createPagarmeOrder = async (req, res) => {
    // Dados que virão do app: itens, dados do cliente e endereço
    const { items, customerData, deliveryAddress, restaurantId } = req.body;
    const userId = req.user.userId;

    try {
        // Validação básica
        if (!restaurantId || !items?.length || !deliveryAddress || !customerData) {
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

        // Conecta-se à API da Pagar.me usando a chave do .env
        const client = await pagarme.client.connect({ api_key: process.env.PAGARME_SECRET_KEY });

        // Cria uma cobrança (Order) na Pagar.me
        const pagarmeOrder = await client.orders.create({
            customer: customerData, // Dados do cliente (nome, email, cpf)
            items: items.map(item => {
                const dish = dishesFromDb.find(d => d.id === item.dishId);
                return {
                    amount: Math.round(dish.price * 100), // Pagar.me usa centavos
                    description: dish.name,
                    quantity: item.quantity,
                }
            }),
            payments: [
                {
                    payment_method: 'pix', // Vamos focar no PIX primeiro
                    pix: {
                        expires_in: 3600, // Tempo de expiração do PIX em segundos (1 hora)
                    }
                }
            ]
        });

        // Extrai os dados do PIX da resposta da Pagar.me
        const pixQrCode = pagarmeOrder.charges[0].last_transaction.qr_code_url;
        const pixKey = pagarmeOrder.charges[0].last_transaction.qr_code;

        // Retorna os dados do PIX para o app Flutter
        res.status(201).json({ 
            orderId: order.id, 
            pixQrCodeUrl: pixQrCode, 
            pixKey: pixKey 
        });

    } catch (error) {
        // Log de erro aprimorado para a Pagar.me
        console.error("Erro ao criar cobrança na Pagar.me:", error.response?.data?.errors || error);
        res.status(500).json({ error: 'Erro ao processar o pedido.' });
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