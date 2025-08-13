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
    const { pixKey } = req.body;
    const userId = req.user.userId;

    console.log(`Tentando atualizar a chave PIX para o usuário: ${userId}`);
    if (!pixKey) {
        return res.status(400).json({ error: 'Chave PIX é obrigatória.' });
    }

    try {
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { pixKey: pixKey },
        });
        console.log(`Chave PIX para ${userId} atualizada com sucesso.`);
        res.status(200).json({ message: 'Chave PIX atualizada com sucesso.', user: updatedUser });
    } catch (error) {
        console.error(`Erro ao atualizar a chave PIX para o usuário ${userId}:`, error);
        res.status(500).json({ error: 'Erro ao atualizar a chave PIX.' });
    }
};
