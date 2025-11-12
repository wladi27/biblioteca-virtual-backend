const Usuario = require('../models/usuario');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwtConfig');
const { clients } = require('../websocket');

// Función para registrar un nuevo usuario
exports.registrarUsuario = async (req, res) => {
  try {
    const { nombre_completo, linea_llamadas, linea_whatsapp, cuenta_numero, banco, titular_cuenta, correo_electronico, dni, nombre_usuario, contraseña, pais } = req.body;

    const usuarioExistente = await Usuario.findOne({ correo_electronico });
    if (usuarioExistente) {
      return res.status(400).json({ message: 'El usuario ya existe' });
    }

    const nuevoUsuario = new Usuario({
      nombre_completo,
      linea_llamadas,
      linea_whatsapp,
      cuenta_numero,
      banco,
      titular_cuenta,
      correo_electronico,
      dni,
      nombre_usuario,
      contraseña,
      pais
    });

    await nuevoUsuario.save();

    const token = jwt.sign({ id: nuevoUsuario._id }, JWT_SECRET, { expiresIn: '1h' });
    res.status(201).json({ token, usuario: nuevoUsuario });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Función para autenticar un usuario
exports.autenticarUsuario = async (req, res) => {
  const { nombre_usuario, contraseña } = req.body;

  try {
    const usuario = await Usuario.findOne({ nombre_usuario });
    if (!usuario) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const esValido = await usuario.matchPassword(contraseña);
    if (!esValido) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // Notificar al cliente antiguo si existe
    if (clients.has(usuario._id.toString())) {
      const oldWs = clients.get(usuario._id.toString());
      try {
        oldWs.send(JSON.stringify({ type: 'FORCE_LOGOUT', message: 'Has iniciado sesión en otro dispositivo.' }));
      } catch (e) {}
      try { oldWs.terminate(); } catch (e) {}
      clients.delete(usuario._id.toString());
    }

    const token = jwt.sign({ id: usuario._id }, JWT_SECRET, { expiresIn: '1h' });

    // Guardar el token en la base de datos
    usuario.token = token;
    await usuario.save();

    res.status(200).json({ token, usuario });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Función para actualizar la contraseña de un usuario
exports.actualizarContraseña = async (req, res) => {
  const { id } = req.params;
  const { nuevaContraseña } = req.body;

  try {
    const usuario = await Usuario.findById(id);
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Actualizar la contraseña
    usuario.contraseña = nuevaContraseña; // La contraseña se encriptará en el middleware
    await usuario.save();

    res.status(200).json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Función para obtener un usuario por ID
exports.obtenerUsuarioPorId = async (req, res) => {
  const { id } = req.params;

  try {
    const usuario = await Usuario.findById(id);
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.status(200).json(usuario);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Función para actualizar un usuario
exports.actualizarUsuario = async (req, res) => {
  const { id } = req.params;
  const { nombre_completo, linea_llamadas, linea_whatsapp, cuenta_numero, banco, titular_cuenta, correo_electronico, dni, nombre_usuario } = req.body;

  try {
    const usuario = await Usuario.findById(id);
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    usuario.nombre_completo = nombre_completo || usuario.nombre_completo;
    usuario.linea_llamadas = linea_llamadas || usuario.linea_llamadas;
    usuario.linea_whatsapp = linea_whatsapp || usuario.linea_whatsapp;
    usuario.cuenta_numero = cuenta_numero || usuario.cuenta_numero;
    usuario.banco = banco || usuario.banco;
    usuario.titular_cuenta = titular_cuenta || usuario.titular_cuenta;
    usuario.correo_electronico = correo_electronico || usuario.correo_electronico;
    usuario.dni = dni || usuario.dni;
    usuario.nombre_usuario = nombre_usuario || usuario.nombre_usuario;

    await usuario.save();
    res.status(200).json({ message: 'Usuario actualizado exitosamente', usuario });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Función para eliminar un usuario
exports.eliminarUsuario = async (req, res) => {
  const { id } = req.params;

  try {
    const usuario = await Usuario.findByIdAndDelete(id);
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.status(200).json({ message: 'Usuario eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Función para cerrar sesión
exports.logout = async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.user.id);
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    usuario.token = null;
    await usuario.save();

    res.status(200).json({ message: 'Sesión cerrada exitosamente' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};