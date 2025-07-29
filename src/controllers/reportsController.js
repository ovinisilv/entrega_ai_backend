const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getRestaurantSummary = async (req, res) => {
    try {
        const restaurant = await prisma.restaurant.findUnique({
            where: { ownerId: req.user.userId },
        });

        if (!restaurant) {
            return res.status(404).json({ error: 'Restaurante não encontrado.' });
        }

        // 1. Calcula o total de vendas e número de pedidos
        const orderAggregates = await prisma.order.aggregate({
            _sum: { totalPrice: true },
            _count: { id: true },
            where: { 
                restaurantId: restaurant.id,
                status: 'ENTREGUE' // Considera apenas pedidos entregues
            },
        });

        // 2. Encontra os pratos mais vendidos
        const topDishes = await prisma.orderItem.groupBy({
            by: ['dishId'],
            _sum: { quantity: true },
            where: {
                order: {
                    restaurantId: restaurant.id,
                    status: 'ENTREGUE'
                }
            },
            orderBy: {
                _sum: { quantity: 'desc' }
            },
            take: 5 // Pega o top 5
        });

        // 3. Busca os nomes dos pratos mais vendidos
        const dishIds = topDishes.map(d => d.dishId);
        const dishes = await prisma.dish.findMany({
            where: { id: { in: dishIds } },
            select: { id: true, name: true }
        });

        const topDishesWithNames = topDishes.map(d => ({
            dishName: dishes.find(dish => dish.id === d.dishId)?.name || 'Prato desconhecido',
            quantitySold: d._sum.quantity
        }));

        res.json({
            totalRevenue: orderAggregates._sum.totalPrice || 0,
            totalOrders: orderAggregates._count.id || 0,
            currentBalance: restaurant.balance,
            topSellingDishes: topDishesWithNames
        });

    } catch (error) {
        console.error("Erro ao gerar relatório:", error);
        res.status(500).json({ error: 'Erro ao gerar relatório.' });
    }
};
