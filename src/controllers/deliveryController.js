const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// A função listAvailableDeliveries continua igual
exports.listAvailableDeliveries = async (req, res) => {
    try {
        const availableOrders = await prisma.order.findMany({
            where: {
                status: 'PRONTO_PARA_ENTREGA',
                deliveryById: null
            },
            include: {
                restaurant: {
                    select: { name: true, address: true }
                }
            },
            orderBy: {
                createdAt: 'asc'
            }
        });
        res.json(availableOrders);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar entregas disponíveis.' });
    }
};

// A função acceptDelivery continua igual
exports.acceptDelivery = async (req, res) => {
    const { id } = req.params;
    const motoboyId = req.user.userId;

    try {
        const updatedOrder = await prisma.order.update({
            where: { id: id },
            data: {
                deliveryById: motoboyId,
                status: 'EM_ROTA'
            }
        });
        res.json(updatedOrder);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao aceitar entrega.' });
    }
};
    
/**
 * Atualiza o status de uma entrega e credita o saldo do motoboy se for entregue.
 */
exports.updateDeliveryStatus = async (req, res) => {
    const { id } = req.params; // ID do Pedido
    const { status } = req.body; // Novo status (ex: "ENTREGUE")
    const motoboyId = req.user.userId;

    try {
        const order = await prisma.order.findFirst({
            where: { id: id, deliveryById: motoboyId }
        });

        if (!order) {
            return res.status(404).json({ error: 'Entrega não encontrada ou não pertence a você.' });
        }

        // --- LÓGICA FINANCEIRA DO MOTOBOY ---
        // Se o novo status for "ENTREGUE" e o pedido tiver uma taxa de entrega
        if (status === 'ENTREGUE' && order.deliveryFee) {
            // Usamos uma transação para garantir que as duas operações aconteçam juntas
            const [updatedOrder] = await prisma.$transaction([
                // 1. Atualiza o status do pedido
                prisma.order.update({
                    where: { id: id },
                    data: { status: status }
                }),
                // 2. Adiciona o valor da taxa de entrega ao saldo do motoboy
                prisma.user.update({
                    where: { id: motoboyId },
                    data: { balance: { increment: order.deliveryFee } }
                })
            ]);
            
            console.log(`Entrega ${order.id} finalizada. Motoboy ${motoboyId} creditado com R$ ${order.deliveryFee.toFixed(2)}.`);
            res.json(updatedOrder);

        } else {
            // Se for qualquer outro status, apenas atualiza o pedido
            const updatedOrder = await prisma.order.update({
                where: { id: id },
                data: { status: status }
            });
            res.json(updatedOrder);
        }

    } catch (error) {
        console.error("Erro ao atualizar status da entrega:", error);
        res.status(500).json({ error: 'Erro ao atualizar status da entrega.' });
    }
};
