const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Lista os pedidos ativos (Pagos ou Em Preparo) para o restaurante logado
exports.listActiveOrders = async (req, res) => {
    try {
        const restaurant = await prisma.restaurant.findUnique({
            where: { ownerId: req.user.userId },
        });

        if (!restaurant) {
            return res.status(404).json({ error: 'Restaurante não encontrado.' });
        }

        const orders = await prisma.order.findMany({
            where: {
                restaurantId: restaurant.id,
                status: {
                    in: ['PAGO', 'EM_PREPARO']
                }
            },
            include: { // Inclui os detalhes dos itens e do cliente
                items: {
                    include: {
                        dish: true
                    }
                },
                user: {
                    select: {
                        name: true
                    }
                }
            },
            orderBy: {
                createdAt: 'asc'
            }
        });

        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar pedidos.' });
    }
};

// Atualiza o status de um pedido
exports.updateOrderStatus = async (req, res) => {
    const { id } = req.params; // ID do Pedido
    const { status } = req.body; // Novo status (ex: "EM_PREPARO", "PRONTO_PARA_ENTREGA")

    try {
        // TODO: Adicionar validação para garantir que o restaurante só pode
        // atualizar os seus próprios pedidos e que a transição de status é válida.

        const updatedOrder = await prisma.order.update({
            where: { id: id },
            data: { status: status },
        });

        res.json(updatedOrder);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar status do pedido.' });
    }
};