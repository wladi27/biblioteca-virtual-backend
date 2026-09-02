const jwt = require('jsonwebtoken');
const Usuario = require('../models/usuario');
const User = require('../models/User');
const { JWT_SECRET } = require('../config/jwtConfig');

const extractToken = (req) => {
  const authHeader = req.header('Authorization') || req.headers['authorization'];
  if (!authHeader) return null;
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return authHeader.trim();
};

const authMiddleware = async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ message: 'Acceso denegado. Token no proporcionado.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Buscar en Usuario
    let usuario = await Usuario.findById(decoded.id);
    let rol = usuario ? (usuario.rol || 'user') : null;

    // Si no está en Usuario, buscar en User (modelo legado de Admin)
    if (!usuario) {
      const adminUser = await User.findById(decoded.id);
      if (adminUser) {
        usuario = {
          _id: adminUser._id,
          nombre_usuario: adminUser.username,
          rol: 'admin'
        };
        rol = 'admin';
      }
    }

    if (!usuario) {
      return res.status(401).json({ message: 'Usuario no encontrado o sesión inválida.' });
    }

    req.user = {
      id: usuario._id ? usuario._id.toString() : usuario.id,
      _id: usuario._id,
      nombre_usuario: usuario.nombre_usuario || usuario.username,
      rol: rol || 'user'
    };

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido o expirado.' });
  }
};

const requireAdmin = async (req, res, next) => {
  if (!req.user || req.user.rol !== 'admin') {
    return res.status(403).json({ message: 'Acceso denegado. Se requieren permisos de administrador.' });
  }
  next();
};

module.exports = authMiddleware;
module.exports.authMiddleware = authMiddleware;
module.exports.requireAdmin = requireAdmin;