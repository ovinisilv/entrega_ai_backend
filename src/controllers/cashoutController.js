const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
// A integração real com a API de Payouts do Mercado Pago seria feita aqui

exports.getBalance = async (req, res) => {
    // ... (código desta função continua igual)
};

exports.requestCashout = async (req, res) => {
    const { amount } = req.body;
    const userId = req.user.userId;

    try {
        // 1. Busca o usuário e seu saldo
        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        // 2. Validações
        if (!user.pixKey) {
            return res.status(400).json({ error: 'Nenhuma chave PIX cadastrada. Por favor, adicione uma chave PIX no seu perfil antes de sacar.' });
        }
        if (amount > user.balance) {
            return res.status(400).json({ error: 'Saldo insuficiente para realizar o saque.' });
        }
        if (amount <= 0) {
            return res.status(400).json({ error: 'O valor do saque deve ser positivo.' });
        }

        // 3. Lógica de Payout (Saque)
        // --- INÍCIO DA SIMULAÇÃO ---
        // Em um app real, aqui você chamaria a API de Payouts do Mercado Pago:
        // const payoutResult = await mercadopago.payouts.create({ amount, pixKey: user.pixKey });
        console.log(`[SIMULAÇÃO] Inciando transferência PIX de R$ ${amount} para a chave ${user.pixKey}`);
        // --- FIM DA SIMULAÇÃO ---

        // 4. Se a transferência for bem-sucedida, debita o valor do saldo no nosso banco
        await prisma.user.update({
            where: { id: userId },
            data: { balance: { decrement: amount } }
        });

        res.json({ message: `Sua solicitação de saque de R$ ${amount.toFixed(2)} foi processada com sucesso!` });

    } catch (error) {
        console.error("Erro ao processar saque:", error);
        res.status(500).json({ error: 'Erro ao processar o saque.' });
    }
};
