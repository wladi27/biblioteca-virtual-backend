const jwt = require('jsonwebtoken');
const Usuario = require('../models/usuario');
const { JWT_SECRET } = require('../config/jwtConfig');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader) return res.status(401).json({ message: 'Autenticación fallida' });

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    const decoded = jwt.verify(token, JWT_SECRET);
    const usuario = await Usuario.findById(decoded.id);

    // Compara el token con el almacenado en la BD para prevenir multi-sesión
    if (!usuario || usuario.token !== token) {
      return res.status(401).json({ message: 'Autenticación fallida' });
    }

    req.user = usuario;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Autenticación fallida' });
  }
};

module.exports = authMiddleware;