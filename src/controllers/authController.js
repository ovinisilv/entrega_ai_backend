const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

// Lista de emails que terão acesso de Super Admin, diretamente no código.
const SUPER_ADMIN_EMAILS = [
    'hiderleysaraivasp@gmail.com',
    'sbarros.vinicius@gmail.com'
];

exports.register = async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    // Converte o email para minúsculas antes de salvar para garantir consistência
    const lowerCaseEmail = email.toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email: lowerCaseEmail } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email já está em uso.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email: lowerCaseEmail, // Salva o email em minúsculas
        password: hashedPassword,
        role,
      },
    });

    if (role === 'RESTAURANTE') {
      await prisma.restaurant.create({
        data: {
          name: `${name}'s Restaurant`,
          address: 'Endereço pendente',
          ownerId: user.id,
          isApproved: false,
        }
      });
    }
    
    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao registrar usuário.', details: error.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    // Normaliza o email de entrada para minúsculas
    const lowerCaseEmail = email.toLowerCase();
    
    const user = await prisma.user.findUnique({ where: { email: lowerCaseEmail } });
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    
    // Converte a lista de admin para minúsculas para uma comparação segura
    const lowerCaseAdminEmails = SUPER_ADMIN_EMAILS.map(e => e.toLowerCase());

    // Verifica se o e-mail do usuário está na lista de admins
    if (lowerCaseAdminEmails.includes(user.email)) {
        user.role = 'ADMIN'; // Garante que o perfil seja ADMIN
    }

    let responsePayload = { ...user };
    
    if (user.role === 'RESTAURANTE') {
        const restaurant = await prisma.restaurant.findUnique({ where: { ownerId: user.id } });
        responsePayload.isApproved = restaurant?.isApproved || false;
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    const { password: _, ...userForResponse } = responsePayload;
    res.json({ token, user: userForResponse });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao fazer login.', details: error.message });
  }
};

exports.googleSignIn = async (req, res) => {
    const { email, name, role } = req.body; // O 'role' virá do app

    if (!email || !name || !role) {
        return res.status(400).json({ error: 'Dados do Google insuficientes.' });
    }

    try {
        let user = await prisma.user.findUnique({ where: { email } });

        // Se o usuário não existe, cria um novo
        if (!user) {
            // Para o Google Sign-In, não precisamos de senha no nosso banco
            const randomPassword = Math.random().toString(36).slice(-8);
            const hashedPassword = await bcrypt.hash(randomPassword, 10);

            user = await prisma.user.create({
                data: {
                    name,
                    email,
                    password: hashedPassword, // Salva uma senha aleatória
                    role: role.toUpperCase(),
                }
            });
        }

        // --- Lógica de Login (similar à função de login normal) ---
        if (SUPER_ADMIN_EMAILS.includes(user.email)) {
            user.role = 'ADMIN';
        }

        const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, {
          expiresIn: '7d',
        });

        const { password: _, ...userForResponse } = user;
        res.json({ token, user: userForResponse });

    } catch (error) {
        res.status(500).json({ error: 'Erro no login com Google.' });
    }
};
