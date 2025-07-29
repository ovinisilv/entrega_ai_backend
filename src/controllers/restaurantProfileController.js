const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Busca os detalhes do restaurante do usuário logado
exports.getProfile = async (req, res) => {
    try {
        // req.user.userId vem do nosso middleware de autenticação (token)
        const restaurant = await prisma.restaurant.findUnique({
            where: { ownerId: req.user.userId },
        });

        if (!restaurant) {
            return res.status(404).json({ error: 'Perfil de restaurante não encontrado para este usuário.' });
        }
        res.json(restaurant);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar perfil do restaurante.' });
    }
};

// Atualiza o perfil do restaurante
exports.updateProfile = async (req, res) => {
    const { name, address, imageUrl, isOpen } = req.body;
    try {
        const updatedRestaurant = await prisma.restaurant.update({
            where: { ownerId: req.user.userId },
            data: { name, address, imageUrl, isOpen },
        });
        res.json(updatedRestaurant);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar perfil do restaurante.' });
    }
};
