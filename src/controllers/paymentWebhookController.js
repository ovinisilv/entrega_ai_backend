const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { MercadoPagoConfig, Payment } = require('mercadopago');

const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
const payment = new Payment(client);

exports.handlePaymentNotification = async (req, res) => {
    // ... (o início da função continua igual, recebendo a notificação)

    if (paymentStatus === 'approved') {
        try {
            const order = await prisma.order.findFirst({
                where: { id: orderId, status: 'PENDENTE' }
            });

            if (order) {
                // --- NOVA LÓGICA FINANCEIRA DETALHADA ---

                // 1. Simular o cálculo da distância (no futuro, isso viria de uma API de mapas)
                const simulatedDistance = Math.random() * 10; // Gera uma distância aleatória de 0 a 10 km

                // 2. Calcular a taxa de entrega com base na sua regra
                const deliveryFee = simulatedDistance < 5 ? 5.00 : 8.00;

                // 3. Atualizar o pedido com a distância e a taxa
                const updatedOrder = await prisma.order.update({
                    where: { id: orderId },
                    data: {
                        status: 'PAGO',
                        deliveryDistance: simulatedDistance,
                        deliveryFee: deliveryFee
                    }
                });

                // 4. Calcular os valores do split
                const totalPaid = updatedOrder.totalPrice;
                const platformFeePercentage = 0.04; // 4%

                // O valor base para o restaurante é o total pago menos a taxa do motoboy
                const restaurantBaseValue = totalPaid - deliveryFee;

                // A comissão do app é 4% do valor do restaurante
                const appCommission = restaurantBaseValue * platformFeePercentage;

                // O valor final do restaurante é o valor base menos a comissão
                const restaurantNetAmount = restaurantBaseValue - appCommission;

                // 5. Creditar os saldos no banco de dados
                // (O saldo do motoboy será creditado quando ele aceitar e concluir a entrega)
                await prisma.restaurant.update({
                    where: { id: updatedOrder.restaurantId },
                    data: { balance: { increment: restaurantNetAmount } }
                });

                console.log(`--- Processamento Financeiro do Pedido ${orderId} ---`);
                console.log(`Total Pago pelo Cliente: R$ ${totalPaid.toFixed(2)}`);
                console.log(`Distância Simulada: ${simulatedDistance.toFixed(2)} km`);
                console.log(`Taxa de Entrega para o Motoboy: R$ ${deliveryFee.toFixed(2)}`);
                console.log(`Valor Base do Restaurante: R$ ${restaurantBaseValue.toFixed(2)}`);
                console.log(`Comissão do App (4%): R$ ${appCommission.toFixed(2)}`);
                console.log(`Valor Líquido para o Restaurante: R$ ${restaurantNetAmount.toFixed(2)}`);
                console.log(`-------------------------------------------------`);
            }
        } catch (error) {
            console.error("Erro ao processar webhook:", error);
        }
    }
    res.status(200).send('Webhook recebido.');
};
