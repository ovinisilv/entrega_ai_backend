const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const admin = require('firebase-admin');

const prisma = new PrismaClient();

// Função que busca os tokens e envia a notificação
const sendPushNotification = async (title, body) => {
    try {
        const customers = await prisma.user.findMany({
            where: {
                role: 'CLIENTE',
                fcmToken: { not: null }
            },
            select: { fcmToken: true }
        });

        if (customers.length === 0) {
            console.log('Agendador: Nenhum cliente com token para notificar.');
            return;
        }

        // Filtra para garantir que não há tokens nulos ou vazios
        const tokens = customers.map(c => c.fcmToken).filter(t => t);

        if (tokens.length === 0) {
            console.log('Agendador: Nenhum token válido encontrado.');
            return;
        }

        const message = {
            notification: { title, body },
            tokens: tokens,
        };

        const response = await admin.messaging().sendMulticast(message);
        console.log(`Agendador: ${response.successCount} notificações de "${title}" enviadas com sucesso.`);

    } catch (error) {
        console.error(`Agendador: Erro ao enviar notificação de "${title}":`, error);
    }
};

// Função principal que inicia os agendamentos
const startSchedulers = () => {
    console.log('Agendador de notificações iniciado.');

    // Agenda a notificação de ALMOÇO
    // Sintaxe do Cron: 'Minuto Hora * * DiaDaSemana'
    // '30 11 * * *' = Todo dia, às 11:30 da manhã
    cron.schedule('30 11 * * *', () => {
        console.log('Executando agendamento de almoço...');
        sendPushNotification(
            'Hora do Almoço! 🍔',
            'A fome bateu? Seu almoço está a um clique de distância!'
        );
    }, {
        scheduled: true,
        timezone: "America/Sao_Paulo"
    });

    // Agenda a notificação de JANTAR
    // '0 19 * * *' = Todo dia, às 19:00 (7 da noite)
    cron.schedule('0 19 * * *', () => {
        console.log('Executando agendamento de jantar...');
        sendPushNotification(
            'Que tal um Jantar especial? 🍕',
            'Planejando o jantar? Deixe a gente te ajudar a decidir!'
        );
    }, {
        scheduled: true,
        timezone: "America/Sao_Paulo"
    });
};

module.exports = startSchedulers;