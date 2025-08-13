const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getBalance = async (req, res) => {
    const userId = req.user.userId;
    const userRole = req.user.role;

    console.log(`[Carteira] Iniciando busca de saldo para UserID: ${userId}, Perfil: ${userRole}`);

    try {
        let balance = 0;
        if (userRole === 'RESTAURANTE') {
            const restaurant = await prisma.restaurant.findUnique({ where: { ownerId: userId } });
            if (restaurant) {
                balance = restaurant.balance;
                console.log(`[Carteira] Saldo do restaurante encontrado: ${balance}`);
            } else {
                console.warn(`[Carteira] Nenhum restaurante encontrado para o dono com ID: ${userId}`);
            }
        } else if (userRole === 'MOTOBOY' || userRole === 'ADMIN') {
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (user) {
                balance = user.balance;
                console.log(`[Carteira] Saldo do usuário (${userRole}) encontrado: ${balance}`);
            } else {
                 console.warn(`[Carteira] Nenhum usuário encontrado com ID: ${userId}`);
            }
        } else {
            console.log(`[Carteira] Perfil ${userRole} não possui saldo. Retornando 0.`);
        }

        res.json({ balance });

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