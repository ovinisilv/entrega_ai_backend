const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { MercadoPagoConfig, Payment } = require('mercadopago');
const admin = require('firebase-admin'); // Importa o Firebase Admin

const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
const payment = new Payment(client);

exports.handlePaymentNotification = async (req, res) => {
    if (req.body.topic === 'payment' || req.body.type === 'payment') {
        const paymentId = req.body.data.id;
        try {
            const paymentDetails = await payment.get({ id: paymentId });
            const orderId = paymentDetails.external_reference;
            const paymentStatus = paymentDetails.status;

            if (paymentStatus === 'approved') {
                const order = await prisma.order.findFirst({
                    where: { id: orderId, status: 'PENDENTE' },
                    // Inclui os dados do restaurante e do dono para a notificação
                    include: { restaurant: { include: { owner: true } } }
                });

                if (order) {
                    // ... (A lógica de cálculo de saldo continua a mesma)

                    await prisma.order.update({
                        where: { id: orderId },
                        data: { status: 'PAGO' }
                    });
                    
                    // --- LÓGICA DE NOTIFICAÇÃO PARA O RESTAURANTE ---
                    const owner = order.restaurant.owner;
                    if (owner && owner.fcmToken) {
                        const message = {
                            notification: {
                                title: '🎉 Novo Pedido Recebido!',
                                body: `Você recebeu um novo pedido (#${order.id.substring(0, 8)}). Prepare-se para a produção!`
                            },
                            token: owner.fcmToken
                        };
                        try {
                            await admin.messaging().send(message);
                            console.log(`Notificação de novo pedido enviada para o restaurante ${order.restaurant.name}.`);
                        } catch (error) {
                            console.error("Erro ao enviar notificação de novo pedido:", error);
                        }
                    }
                    // -------------------------------------------------
                }
            }
        } catch (error) {
            console.error("Erro ao processar webhook:", error);
        }
    }
    res.status(200).send('Webhook recebido.');
};
