const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const admin = require('firebase-admin');

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

exports.confirmDelivery = async (req, res) => {
    const { id } = req.params; // ID do Pedido
    const { code } = req.body; // Código enviado pelo motoboy
    const motoboyId = req.user.userId;

    try {
        const order = await prisma.order.findFirst({
            where: { id: id, deliveryById: motoboyId }
        });

        if (!order) {
            return res.status(404).json({ error: 'Entrega não encontrada ou não pertence a você.' });
        }

        if (order.deliveryConfirmationCode !== code) {
            return res.status(400).json({ error: 'Código de confirmação incorreto.' });
        }

        // Se o código estiver correto, executa a lógica de finalizar a entrega
        const [updatedOrder] = await prisma.$transaction([
            prisma.order.update({
                where: { id: id },
                data: { status: 'ENTREGUE' }
            }),
            prisma.user.update({
                where: { id: motoboyId },
                data: { balance: { increment: order.deliveryFee } }
            })
        ]);

        // TODO: Notificar o cliente e o restaurante que a entrega foi concluída

        res.json({ message: 'Entrega confirmada com sucesso!', order: updatedOrder });

    } catch (error) {
        console.error("Erro ao confirmar entrega:", error);
        res.status(500).json({ error: 'Erro ao confirmar a entrega.' });
    }
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
                restaurant: { include: { owner: true } }
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
            
            // Notifica o cliente
            if (order.user && order.user.fcmToken) {
                const clientMessage = {
                    notification: {
                        title: 'Seu pedido foi entregue! 🛵',
                        body: `O seu pedido do restaurante ${order.restaurant.name} chegou. Bom apetite!`
                    },
                    token: order.user.fcmToken
                };
                try {
                    await admin.messaging().send(clientMessage);
                } catch (e) { console.error("Erro ao notificar cliente sobre entrega:", e); }
            }

            // Notifica o restaurante
            const owner = order.restaurant.owner;
            if (owner && owner.fcmToken) {
                const restaurantMessage = {
                    notification: {
                        title: 'Pedido Entregue!',
                        body: `A entrega do pedido #${order.id.substring(0, 8)} foi concluída com sucesso.`
                    },
                    token: owner.fcmToken
                };
                try {
                    await admin.messaging().send(restaurantMessage);
                } catch (e) { console.error("Erro ao notificar restaurante sobre entrega:", e); }
            }

            res.json(updatedOrder);

        } else { // Para outros status como 'EM_ROTA' (se o motoboy atualizar manualmente)
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
