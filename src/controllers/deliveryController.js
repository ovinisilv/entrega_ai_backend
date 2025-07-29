const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Lista os pedidos que estão prontos e ainda não foram pegos por ninguém
exports.listAvailableDeliveries = async (req, res) => {
    try {
        const availableOrders = await prisma.order.findMany({
            where: {
                status: 'PRONTO_PARA_ENTREGA',
                deliveryById: null // Apenas pedidos sem motoboy associado
            },
            include: { // Inclui detalhes importantes para o motoboy decidir
                restaurant: {
                    select: { name: true, address: true }
                }
                // TODO: Adicionar o endereço do cliente ao pedido
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

// Associa o motoboy logado a um pedido (aceitar a entrega)
exports.acceptDelivery = async (req, res) => {
    const { id } = req.params; // ID do Pedido
    const motoboyId = req.user.userId; // ID do motoboy logado

    try {
        const updatedOrder = await prisma.order.update({
            where: { id: id },
            data: {
                deliveryById: motoboyId,
                status: 'EM_ROTA' // Muda o status automaticamente para "Em Rota"
            }
        });
        res.json(updatedOrder);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao aceitar entrega. Outro motoboy pode ter aceitado primeiro.' });
    }
};

// Atualiza o status de uma entrega que o motoboy já aceitou
exports.updateDeliveryStatus = async (req, res) => {
    const { id } = req.params; // ID do Pedido
    const { status } = req.body; // Novo status (ex: "ENTREGUE")
    const motoboyId = req.user.userId;

    try {
         // Garante que o motoboy só pode atualizar suas próprias entregas
        const order = await prisma.order.findFirst({
            where: { id: id, deliveryById: motoboyId }
        });

        if (!order) {
            return res.status(404).json({ error: 'Entrega não encontrada ou não pertence a você.' });
        }

        const updatedOrder = await prisma.order.update({
            where: { id: id },
            data: { status: status }
        });

        res.json(updatedOrder);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar status da entrega.' });
    }
};