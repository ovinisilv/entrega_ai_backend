const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.updateFcmToken = async (req, res) => {
    const { fcmToken } = req.body;
    const userId = req.user.userId; // Vem do middleware de proteção

    try {
        await prisma.user.update({
            where: { id: userId },
            data: { fcmToken: fcmToken },
        });
        res.status(200).json({ message: 'FCM token atualizado com sucesso.' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar FCM token.' });
    }
};

exports.updatePixKey = async (req, res) => {
    // Agora recebemos o tipo e o valor da chave
    const { pixKey, pixKeyType } = req.body;
    const userId = req.user.userId;

    if (!pixKey || !pixKeyType) {
        return res.status(400).json({ error: 'Chave PIX e tipo da chave são obrigatórios.' });
    }

    // Validação simples do tipo da chave
    if (!['CPF_CNPJ', 'EMAIL', 'CELULAR', 'ALEATORIA'].includes(pixKeyType)) {
        return res.status(400).json({ error: 'Tipo de chave PIX inválido.' });
    }

    try {
        await prisma.user.update({
            where: { id: userId },
            data: { 
                pixKey: pixKey,
                pixKeyType: pixKeyType, // Salva o tipo
            },
        });
        res.status(200).json({ message: 'Chave PIX atualizada com sucesso.' });
    } catch (error) {
        console.error(`Erro ao atualizar a chave PIX para o usuário ${userId}:`, error);
        res.status(500).json({ error: 'Erro ao atualizar a chave PIX.' });
    }
};
