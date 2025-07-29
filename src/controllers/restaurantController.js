const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Lista apenas restaurantes aprovados para o público
exports.listApprovedRestaurants = async (req, res) => {
    try {
        const restaurants = await prisma.restaurant.findMany({
            where: { isApproved: true } // O filtro mágico!
        });
        res.json(restaurants);
    } catch (error) {
        res.status(500).json({ error: 'Não foi possível listar os restaurantes.' });
    }
}