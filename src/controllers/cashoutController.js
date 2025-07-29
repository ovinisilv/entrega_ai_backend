const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Busca o saldo do usuário logado (seja restaurante ou motoboy)
exports.getBalance = async (req, res) => {
    const userId = req.user.userId;
    const userRole = req.user.role;

    try {
        let balance = 0;
        if (userRole === 'RESTAURANTE') {
            const restaurant = await prisma.restaurant.findUnique({ where: { ownerId: userId } });
            balance = restaurant?.balance || 0;
        } else if (userRole === 'MOTOBOY') {
            const motoboy = await prisma.user.findUnique({ where: { id: userId } });
            balance = motoboy?.balance || 0;
        }
        res.json({ balance });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar saldo.' });
    }
};

// Solicita um saque
exports.requestCashout = async (req, res) => {
    const { amount, pixKey } = req.body; // Valor e a chave PIX do parceiro
    const userId = req.user.userId;
    const userRole = req.user.role;

    try {
        // --- SIMULAÇÃO DA LÓGICA DE SAQUE ---
        // 1. Verificar se o saldo é suficiente (lógica real)
        // 2. Debitar o saldo do nosso banco de dados (lógica real)
        // 3. Chamar a API de Payouts do Mercado Pago para transferir o dinheiro (lógica real)

        console.log(`[SIMULAÇÃO] Saque solicitado por ${userId} (${userRole})`);
        console.log(`Valor: R$ ${amount}, Chave PIX: ${pixKey}`);
        console.log(`[SIMULAÇÃO] Chamando API de Payouts do Mercado Pago...`);
        console.log(`[SIMULAÇÃO] Transferência concluída.`);

        // Em uma implementação real, você debitaria o saldo aqui:
        // await prisma.restaurant.update({ where: { ownerId: userId }, data: { balance: { decrement: amount } } });

        res.json({ message: 'Sua solicitação de saque foi processada com sucesso!' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao processar o saque.' });
    }
};