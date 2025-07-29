const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Rota para o cliente listar todos os restaurantes aprovados
router.get('/restaurants', async (req, res) => {
    try {
        const restaurants = await prisma.restaurant.findMany({
            where: { isApproved: true }
        });
        res.json(restaurants);
    } catch (error) {
        res.status(500).json({ error: 'Não foi possível listar os restaurantes.' });
    }
});

// Rota para buscar restaurantes por nome
router.get('/restaurants/search', async (req, res) => {
    // O termo da busca virá como um parâmetro na URL, ex: /search?q=pizza
    const { q } = req.query;

    if (!q) {
        return res.status(400).json({ error: 'Termo de busca (q) é obrigatório.' });
    }

    try {
        const restaurants = await prisma.restaurant.findMany({
            where: {
                isApproved: true,
                name: {
                    contains: q,
                    mode: 'insensitive' // Ignora maiúsculas/minúsculas
                }
            }
        });
        res.json(restaurants);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar restaurantes.' });
    }
});

// Rota para o cliente ver o cardápio de um restaurante específico
router.get('/restaurants/:id/dishes', async (req, res) => {
    const { id } = req.params;
    try {
        const dishes = await prisma.dish.findMany({
            where: { restaurantId: id, isAvailable: true }
        });
        res.json(dishes);
    } catch (error) {
        res.status(500).json({ error: 'Não foi possível carregar o cardápio.' });
    }
});

module.exports = router;