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