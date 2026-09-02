const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Usuario = require('../models/usuario');
const { JWT_SECRET } = require('../config/jwtConfig');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();

// Registro de Administrador protegido
router.post('/register', async (req, res) => {
  const username = req.body.username || req.body.nombre_usuario;
  const password = req.body.password || req.body.contraseña || req.body.contrasena;
  const { adminSecret } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Usuario y contraseña son requeridos.' });
  }

  // Proteger registro de admin si existe la variable ADMIN_REGISTER_SECRET
  if (process.env.ADMIN_REGISTER_SECRET && adminSecret !== process.env.ADMIN_REGISTER_SECRET) {
    return res.status(403).json({ message: 'Clave de creación de administrador inválida.' });
  }

  try {
    const existing = await User.findOne({ username: username.trim() });
    if (existing) {
      return res.status(400).json({ message: 'El usuario administrador ya existe.' });
    }

    const hashedPassword = await bcrypt.hash(password.trim(), 10);
    const user = new User({ username: username.trim(), password: hashedPassword });
    await user.save();

    res.status(201).json({ message: 'Usuario administrador registrado exitosamente.' });
  } catch (error) {
    res.status(500).json({ message: 'Error al registrar administrador', error: error.message });
  }
});

// Login de Administrador (Endpoint: /api/auth/login)
router.post('/login', async (req, res) => {
  const username = (req.body.username || req.body.nombre_usuario || req.body.email || req.body.correo_electronico || '').trim();
  const password = (req.body.password || req.body.contraseña || req.body.contrasena || '').trim();

  if (!username || !password) {
    return res.status(400).json({ message: 'Usuario y contraseña de administrador son requeridos.' });
  }

  try {
    // 1. Buscar en el modelo User (Colección exclusiva de Administradores)
    let admin = await User.findOne({ username });
    let isMatch = false;

    if (admin) {
      isMatch = await bcrypt.compare(password, admin.password);
    } else {
      // 2. Buscar en el modelo Usuario con rol admin o superadmin
      const usuarioAdmin = await Usuario.findOne({
        $or: [
          { nombre_usuario: username },
          { correo_electronico: username }
        ]
      });

      if (usuarioAdmin && (usuarioAdmin.rol === 'admin' || usuarioAdmin.rol === 'superadmin')) {
        isMatch = await usuarioAdmin.matchPassword(password);
        if (isMatch) {
          admin = { _id: usuarioAdmin._id, username: usuarioAdmin.nombre_usuario };
        }
      }
    }

    if (!admin || !isMatch) {
      return res.status(401).json({ message: 'Credenciales de administrador incorrectas.' });
    }

    const token = jwt.sign({ id: admin._id, rol: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ 
      token, 
      usuario: {
        _id: admin._id,
        id: admin._id,
        nombre_usuario: admin.username,
        nombre_completo: admin.username,
        rol: 'admin'
      },
      admin: { 
        id: admin._id, 
        username: admin.username, 
        rol: 'admin' 
      } 
    });
  } catch (error) {
    console.error('Error en /api/auth/login:', error);
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
});

// Obtener perfil actual de admin
router.get('/me', authMiddleware, async (req, res) => {
  try {
    res.json({ user: req.user });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener datos' });
  }
});

module.exports = router;
