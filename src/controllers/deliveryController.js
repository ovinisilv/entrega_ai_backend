const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const admin = require('firebase-admin'); // Importa o Firebase Admin

exports.listAvailableDeliveries = async (req, res) => {
    // ... (código desta função continua igual)
};

exports.acceptDelivery = async (req, res) => {
    const { id } = req.params;
    const motoboyId = req.user.userId;

    try {
        const updatedOrder = await prisma.order.update({
            where: { id: id },
            data: {
                deliveryById: motoboyId,
                status: 'EM_ROTA'
            },
            include: { restaurant: { include: { owner: true } } }
        });

        // --- NOTIFICAÇÃO: MOTOBOY ACEITOU ---
        const owner = updatedOrder.restaurant.owner;
        if (owner && owner.fcmToken) {
            const message = {
                notification: {
                    title: 'Motoboy a caminho!',
                    body: `Um motoboy aceitou o pedido #${updatedOrder.id.substring(0, 8)} e está a caminho para retirá-lo.`
                },
                token: owner.fcmToken
            };
            try {
                await admin.messaging().send(message);
                console.log(`Notificação de coleta enviada para o restaurante ${updatedOrder.restaurant.name}.`);
            } catch (error) {
                console.error("Erro ao enviar notificação de coleta:", error);
            }
        }
        // ------------------------------------

        res.json(updatedOrder);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao aceitar entrega.' });
    }
};
    
exports.updateDeliveryStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const motoboyId = req.user.userId;

    try {
        const order = await prisma.order.findFirst({
            where: { id: id, deliveryById: motoboyId },
            include: { 
                user: { select: { fcmToken: true } },
                restaurant: { include: { owner: true } } // Inclui o dono do restaurante
            }
        });

        if (!order) {
            return res.status(404).json({ error: 'Entrega não encontrada.' });
        }

        if (status === 'ENTREGUE' && order.deliveryFee) {
            const [updatedOrder] = await prisma.$transaction([
                prisma.order.update({
                    where: { id: id },
                    data: { status: status }
                }),
                prisma.user.update({
                    where: { id: motoboyId },
                    data: { balance: { increment: order.deliveryFee } }
                })
            ]);
            
            // Notifica o cliente (lógica que já tínhamos)
            if (order.user && order.user.fcmToken) { /* ... */ }

            // --- NOTIFICAÇÃO: PEDIDO ENTREGUE ---
            const owner = order.restaurant.owner;
            if (owner && owner.fcmToken) {
                const message = {
                    notification: {
                        title: 'Pedido Entregue!',
                        body: `A entrega do pedido #${order.id.substring(0, 8)} foi concluída com sucesso.`
                    },
                    token: owner.fcmToken
                };
                try {
                    await admin.messaging().send(message);
                    console.log(`Notificação de entrega concluída enviada para o restaurante ${order.restaurant.name}.`);
                } catch (error) {
                    console.error("Erro ao enviar notificação de entrega concluída:", error);
                }
            }
            // ------------------------------------

            res.json(updatedOrder);

        } else {
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
