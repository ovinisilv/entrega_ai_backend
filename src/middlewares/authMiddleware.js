const jwt = require('jsonwebtoken');

exports.protect = (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded; // Adiciona os dados do usuário (id, role) à requisição
      next();
    } catch (error) {
      res.status(401).json({ error: 'Não autorizado, token falhou' });
    }
  }

  if (!token) {
    res.status(401).json({ error: 'Não autorizado, sem token' });
  }
};

exports.isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'ADMIN') {
        next();
    } else {
        res.status(403).json({ error: 'Acesso negado. Rota apenas para administradores.' });
    }
}