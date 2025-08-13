const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getBalance = async (req, res) => {
    const userId = req.user.userId;
    const userRole = req.user.role;
    console.log(`Buscando saldo e PIX para o usuário ${userId} com perfil ${userRole}`);

    try {
        let balance = 0;
        let pixKey = null;

        // Busca o usuário para pegar a chave PIX
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user) {
            pixKey = user.pixKey;
        }

        // Busca o saldo com base no perfil
        if (userRole === 'RESTAURANTE') {
            const restaurant = await prisma.restaurant.findUnique({ where: { ownerId: userId } });
            balance = restaurant?.balance || 0;
        } else if (userRole === 'MOTOBOY' || userRole === 'ADMIN') {
            balance = user?.balance || 0;
        }

        console.log(`Saldo encontrado: ${balance}, Chave PIX: ${pixKey}`);
        // Retorna o saldo e a chave PIX juntos
        res.json({ balance, pixKey });

    } catch (error) {
        console.error("[Carteira] ERRO CRÍTICO ao buscar saldo:", error);
        res.status(500).json({ error: 'Erro interno ao buscar saldo.' });
    }
};


exports.requestCashout = async (req, res) => {
    const { amount } = req.body;
    const userId = req.user.userId;
    const userRole = req.user.role;
    console.log(`[Saque] ${userId} (${userRole}) solicitou saque de ${amount}`);

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        let balanceToCheck = 0;
        if (userRole === 'RESTAURANTE') {
            const restaurant = await prisma.restaurant.findUnique({ where: { ownerId: userId } });
            balanceToCheck = restaurant?.balance || 0;
        } else {
            balanceToCheck = user.balance;
        }

        if (!user.pixKey) {
            return res.status(400).json({ error: 'Nenhuma chave PIX cadastrada.' });
        }
        if (amount > balanceToCheck) {
            return res.status(400).json({ error: 'Saldo insuficiente.' });
        }
        if (amount <= 0) {
            return res.status(400).json({ error: 'O valor do saque deve ser positivo.' });
        }

        // --- SIMULAÇÃO DA LÓGICA DE SAQUE ---
        console.log(`[Saque] Simulando transferência PIX de R$ ${amount} para a chave ${user.pixKey}`);

        // Debita o valor do saldo correto
        if (userRole === 'RESTAURANTE') {
             await prisma.restaurant.update({
                where: { ownerId: userId },
                data: { balance: { decrement: amount } }
            });
        } else {
             await prisma.user.update({
                where: { id: userId },
                data: { balance: { decrement: amount } }
            });
        }

        res.json({ message: `Sua solicitação de saque de R$ ${amount.toFixed(2)} foi processada!` });

    } catch (error) {
        console.error("[Saque] Erro ao processar saque:", error);
        res.status(500).json({ error: 'Erro ao processar o saque.' });
    }
};