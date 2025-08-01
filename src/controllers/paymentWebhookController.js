const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { MercadoPagoConfig, Payment } = require('mercadopago');
const admin = require('firebase-admin');

const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
const payment = new Payment(client);

exports.handlePaymentNotification = async (req, res) => {
    // A notificação pode vir no 'topic' ou no 'type', dependendo da configuração
    if (req.body.topic === 'payment' || req.body.type === 'payment') {
        const paymentId = req.body.data.id;
        console.log(`Webhook: Recebida notificação para o pagamento ID: ${paymentId}`);

        try {
            // Busca os detalhes do pagamento na API do Mercado Pago
            const paymentDetails = await payment.get({ id: paymentId });
            const orderId = paymentDetails.external_reference;
            const paymentStatus = paymentDetails.status;

            // Processa apenas se o pagamento foi aprovado
            if (paymentStatus === 'approved') {
                const order = await prisma.order.findFirst({
                    where: { id: orderId, status: 'PENDENTE' },
                    include: { restaurant: { include: { owner: true } } }
                });

                if (order) {
                    console.log(`Webhook: Pagamento para o pedido ${orderId} foi aprovado.`);

                    // --- LÓGICA FINANCEIRA ---
                    const simulatedDistance = Math.random() * 10;
                    const deliveryFee = simulatedDistance < 5 ? 5.00 : 8.00;

                    await prisma.order.update({
                        where: { id: orderId },
                        data: {
                            status: 'PAGO',
                            deliveryDistance: simulatedDistance,
                            deliveryFee: deliveryFee
                        }
                    });

                    const platformFeePercentage = 0.04; // 4%
                    const restaurantBaseValue = order.totalPrice - deliveryFee;
                    const appCommission = restaurantBaseValue * platformFeePercentage;
                    const restaurantNetAmount = restaurantBaseValue - appCommission;

                    await prisma.restaurant.update({
                        where: { id: order.restaurantId },
                        data: { balance: { increment: restaurantNetAmount } }
                    });
                    
                    console.log(`Webhook: Saldo do restaurante ${order.restaurant.name} atualizado.`);

                    // --- LÓGICA DE NOTIFICAÇÃO PARA O RESTAURANTE ---
                    const owner = order.restaurant.owner;
                    if (owner && owner.fcmToken) {
                        const message = {
                            notification: {
                                title: '🎉 Novo Pedido Recebido!',
                                body: `Você recebeu um novo pedido (#${order.id.substring(0, 8)}). Abra o app para prepará-lo!`
                            },
                            token: owner.fcmToken
                        };
                        try {
                            await admin.messaging().send(message);
                            console.log(`Webhook: Notificação de novo pedido enviada para o restaurante ${order.restaurant.name}.`);
                        } catch (error) {
                            console.error("Webhook: Erro ao enviar notificação de novo pedido:", error);
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Webhook: Erro fatal ao processar notificação:", error);
        }
    }
    // Responde ao Mercado Pago que a notificação foi recebida com sucesso para evitar retentativas.
    res.status(200).send('Webhook recebido.');
};
