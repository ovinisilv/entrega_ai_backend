const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.updateFcmToken = async (req, res) => {
    const { fcmToken } = req.body;
    const userId = req.user.userId;
    try {
        await prisma.user.update({
            where: { id: userId },
            data: { fcmToken: fcmToken },
        });
        res.status(200).json({ message: 'FCM token atualizado.' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar FCM token.' });
    }
};

exports.updatePixKey = async (req, res) => {
    const { pixKey, pixKeyType } = req.body;
    const userId = req.user.userId;

    console.log(`[PIX] Recebida solicitação para atualizar chave PIX do usuário: ${userId}`);
    console.log(`[PIX] Dados recebidos: Chave=${pixKey}, Tipo=${pixKeyType}`);

    if (!pixKey || !pixKeyType) {
        console.error("[PIX] Erro: Chave PIX ou tipo da chave não foram fornecidos.");
        return res.status(400).json({ error: 'Chave PIX e tipo da chave são obrigatórios.' });
    }

    if (!['CPF_CNPJ', 'EMAIL', 'CELULAR', 'ALEATORIA'].includes(pixKeyType)) {
        console.error(`[PIX] Erro: Tipo de chave inválido: ${pixKeyType}`);
        return res.status(400).json({ error: 'Tipo de chave PIX inválido.' });
    }

    try {
        await prisma.user.update({
            where: { id: userId },
            data: { 
                pixKey: pixKey,
                pixKeyType: pixKeyType,
            },
        });
        console.log(`[PIX] Chave PIX para usuário ${userId} atualizada com sucesso no banco de dados.`);
        res.status(200).json({ message: 'Chave PIX atualizada com sucesso.' });
    } catch (error) {
        console.error(`[PIX] ERRO CRÍTICO ao salvar no banco de dados:`, error);
        res.status(500).json({ error: 'Erro interno ao atualizar a chave PIX.' });
    }
};