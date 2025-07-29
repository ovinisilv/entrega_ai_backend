const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Cria um novo prato para o restaurante logado
exports.createDish = async (req, res) => {
    const { name, description, price, imageUrl } = req.body;
    try {
        const restaurant = await prisma.restaurant.findUnique({ where: { ownerId: req.user.userId } });
        if (!restaurant) {
            return res.status(404).json({ error: 'Restaurante não encontrado.' });
        }

        const newDish = await prisma.dish.create({
            data: {
                name,
                description,
                price,
                imageUrl,
                restaurantId: restaurant.id,
            },
        });
        res.status(201).json(newDish);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar prato.' });
    }
};

// Lista todos os pratos do restaurante logado
exports.listDishes = async (req, res) => {
    try {
        const restaurant = await prisma.restaurant.findUnique({ where: { ownerId: req.user.userId } });
        if (!restaurant) {
            return res.status(404).json({ error: 'Restaurante não encontrado.' });
        }

        const dishes = await prisma.dish.findMany({
            where: { restaurantId: restaurant.id },
        });
        res.json(dishes);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao listar pratos.' });
    }
};

// Atualiza um prato específico
exports.updateDish = async (req, res) => {
    const { id } = req.params; // ID do prato
    const { name, description, price, imageUrl, isAvailable } = req.body;
    try {
        const updatedDish = await prisma.dish.update({
            where: { id: id },
            data: { name, description, price, imageUrl, isAvailable },
        });
        res.json(updatedDish);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar prato.' });
    }
};

// Deleta um prato específico
exports.deleteDish = async (req, res) => {
    const { id } = req.params; // ID do prato
    try {
        await prisma.dish.delete({
            where: { id: id },
        });
        res.status(204).send(); // 204 No Content
    } catch (error) {
        res.status(500).json({ error: 'Erro ao deletar prato.' });
    }
};