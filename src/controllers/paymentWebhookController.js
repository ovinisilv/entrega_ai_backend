const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { MercadoPagoConfig, Payment } = require('mercadopago');

const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
const payment = new Payment(client);

exports.handlePaymentNotification = async (req, res) => {
    // O Mercado Pago envia notificações sobre diferentes tópicos.
    // Nós estamos interessados no tópico 'payment'.
    if (req.body.topic === 'payment' || req.body.type === 'payment') {
        const paymentId = req.body.data.id;
        console.log(`Recebida notificação para o pagamento ID: ${paymentId}`);

        try {
            // 1. Busca os detalhes completos do pagamento na API do Mercado Pago
            const paymentDetails = await payment.get({ id: paymentId });

            const orderId = paymentDetails.external_reference;
            const paymentStatus = paymentDetails.status;

            console.log(`Status do pagamento: ${paymentStatus}, ID do Pedido: ${orderId}`);

            // 2. Verifica se o pagamento foi aprovado e se o pedido ainda está pendente
            if (paymentStatus === 'approved') {
                const order = await prisma.order.findFirst({
                    where: { id: orderId, status: 'PENDENTE' }
                });

                if (order) {
                    // --- LÓGICA FINANCEIRA PRINCIPAL ---

                    // 3. Atualiza o status do nosso pedido para PAGO
                    await prisma.order.update({
                        where: { id: orderId },
                        data: { status: 'PAGO' }
                    });

                    // 4. Calcula as comissões e saldos
                    const APP_COMMISSION_PERCENTAGE = 0.12; // Ex: 12% de comissão
                    const DELIVERY_FEE = 7.00; // Ex: Taxa de entrega fixa para o motoboy

                    // O valor que o restaurante recebe é o total menos a taxa de entrega
                    const restaurantGrossValue = order.totalPrice - DELIVERY_FEE;
                    const appCommission = restaurantGrossValue * APP_COMMISSION_PERCENTAGE;
                    const restaurantNetValue = restaurantGrossValue - appCommission;

                    // 5. Credita os saldos no banco de dados
                    // Usamos 'increment' para adicionar ao saldo existente de forma segura
                    await prisma.restaurant.update({
                        where: { id: order.restaurantId },
                        data: { balance: { increment: restaurantNetValue } }
                    });

                    // O saldo do motoboy será creditado quando ele aceitar a entrega
                    // (ou podemos creditar aqui, dependendo da regra de negócio)
                    console.log(`Pedido ${orderId} processado. Restaurante creditado com R$ ${restaurantNetValue.toFixed(2)}.`);
                }
            }
        } catch (error) {
            console.error("Erro ao processar webhook do Mercado Pago:", error);
            return res.status(500).send('Erro interno');
        }
    }
    // Responde ao Mercado Pago que a notificação foi recebida com sucesso
    res.status(200).send();
};