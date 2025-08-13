const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Constantes de configuração
const MIN_WITHDRAWAL_AMOUNT = 10; // Valor mínimo de saque
const MAX_WITHDRAWAL_AMOUNT = 5000; // Valor máximo de saque por transação
const DAILY_WITHDRAWAL_LIMIT = 10000; // Limite diário por usuário

exports.requestCashout = async (req, res) => {
    const { amount } = req.body;
    const userId = req.user.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
        // 1. Busca o usuário e informações relevantes
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                cashouts: {
                    where: {
                        createdAt: { gte: today },
                        status: 'COMPLETED'
                    }
                }
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        // 2. Validações avançadas
        if (!user.pixKey) {
            return res.status(400).json({ 
                error: 'Nenhuma chave PIX cadastrada. Por favor, adicione uma chave PIX no seu perfil antes de sacar.' 
            });
        }

        if (amount > user.balance) {
            return res.status(400).json({ 
                error: 'Saldo insuficiente para realizar o saque.' 
            });
        }

        if (amount < MIN_WITHDRAWAL_AMOUNT) {
            return res.status(400).json({ 
                error: `O valor mínimo para saque é R$ ${MIN_WITHDRAWAL_AMOUNT.toFixed(2)}.` 
            });
        }

        if (amount > MAX_WITHDRAWAL_AMOUNT) {
            return res.status(400).json({ 
                error: `O valor máximo por saque é R$ ${MAX_WITHDRAWAL_AMOUNT.toFixed(2)}.` 
            });
        }

        // Calcula total sacado hoje
        const totalWithdrawnToday = user.cashouts.reduce(
            (sum, cashout) => sum + cashout.amount, 0
        );

        if (totalWithdrawnToday + amount > DAILY_WITHDRAWAL_LIMIT) {
            return res.status(400).json({ 
                error: `Limite diário de saques excedido. Você já sacou R$ ${totalWithdrawnToday.toFixed(2)} hoje.` 
            });
        }

        // 3. Cria registro do saque antes de processar
        const cashoutRecord = await prisma.cashout.create({
            data: {
                amount,
                userId,
                status: 'PENDING',
                pixKey: user.pixKey
            }
        });

        // 4. Lógica de Payout (Saque)
        try {
            console.log(`[SIMULAÇÃO] Inciando transferência PIX de R$ ${amount} para a chave ${user.pixKey}`);
            
            // Em produção, substituir por:
            // const payoutResult = await mercadopago.payouts.create({
            //     amount,
            //     pixKey: user.pixKey,
            //     external_reference: cashoutRecord.id
            // });

            // Simula atraso de processamento
            await new Promise(resolve => setTimeout(resolve, 2000));

            // 5. Atualiza saldo e status do saque
            await prisma.$transaction([
                prisma.user.update({
                    where: { id: userId },
                    data: { balance: { decrement: amount } }
                }),
                prisma.cashout.update({
                    where: { id: cashoutRecord.id },
                    data: { 
                        status: 'COMPLETED',
                        // processedAt: new Date(),
                        // externalId: payoutResult.id
                    }
                })
            ]);

            return res.json({ 
                message: `Saque de R$ ${amount.toFixed(2)} processado com sucesso!`,
                newBalance: user.balance - amount
            });

        } catch (payoutError) {
            // Em caso de falha no payout, atualiza o status
            await prisma.cashout.update({
                where: { id: cashoutRecord.id },
                data: { 
                    status: 'FAILED',
                    errorMessage: payoutError.message
                }
            });

            console.error("Erro no processamento do PIX:", payoutError);
            return res.status(500).json({ 
                error: 'Falha ao processar o PIX. Por favor, tente novamente mais tarde.' 
            });
        }

    } catch (error) {
        console.error("Erro ao processar saque:", error);
        return res.status(500).json({ 
            error: 'Erro interno ao processar o saque.' 
        });
    }
};