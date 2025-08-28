const jwt = require('jsonwebtoken');
const Usuario = require('../models/usuario');
const { JWT_SECRET } = require('../config/jwtConfig');

const authMiddleware = async (req, res, next) => {
  const token = req.header('Authorization').replace('Bearer ', '');

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const usuario = await Usuario.findById(decoded.id);

    if (!usuario || usuario.token !== token) { // Compara el token con el almacenado
      throw new Error();
    }

    req.user = usuario;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Autenticación fallida' });
  }
};

module.exports = authMiddleware;