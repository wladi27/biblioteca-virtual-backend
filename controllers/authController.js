const Usuario = require('../models/usuario');
const Billetera = require('../models/billetera');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwtConfig');
const { clients } = require('../websocket');

// Función para registrar un nuevo usuario desde el módulo de Auth
exports.registrarUsuario = async (req, res) => {
  try {
    const {
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
      codigo_referido
    } = req.body;

    const usuarioExistente = await Usuario.findOne({
      $or: [{ correo_electronico: correo_electronico?.trim().toLowerCase() }, { nombre_usuario: nombre_usuario?.trim() }]
    });

    if (usuarioExistente) {
      return res.status(400).json({ message: 'El usuario o correo electrónico ya existe.' });
    }

    // Validar código de referido si se proporciona
    let referralCodeDoc = null;
    if (codigo_referido) {
      const ReferralCode = require('../models/ReferralCode');
      referralCodeDoc = await ReferralCode.findOne({ code: codigo_referido.trim() });
      if (referralCodeDoc && !referralCodeDoc.used) {
        referralCodeDoc.used = true;
        await referralCodeDoc.save();
      }
    }

    // Buscar padre secuencial en matriz
    const padre = await Usuario.findOne({
      $or: [{ hijo1_id: null }, { hijo2_id: null }, { hijo3_id: null }]
    }).sort({ _id: 1 });

    const nuevoUsuario = new Usuario({
      nombre_completo: nombre_completo?.trim(),
      linea_llamadas: linea_llamadas?.trim(),
      linea_whatsapp: linea_whatsapp?.trim(),
      cuenta_numero: cuenta_numero?.trim(),
      banco: banco?.trim(),
      titular_cuenta: titular_cuenta?.trim(),
      correo_electronico: correo_electronico?.trim().toLowerCase(),
      dni: dni?.trim(),
      nombre_usuario: nombre_usuario?.trim(),
      contraseña: contraseña?.trim(),
      codigo_referido: codigo_referido?.trim(),
      padre_id: padre ? padre._id : null,
      nivel: padre ? (padre.nivel + 1) : 1
    });

    await nuevoUsuario.save();

    // Enlazar al padre
    if (padre) {
      if (!padre.hijo1_id) {
        padre.hijo1_id = nuevoUsuario._id;
      } else if (!padre.hijo2_id) {
        padre.hijo2_id = nuevoUsuario._id;
      } else if (!padre.hijo3_id) {
        padre.hijo3_id = nuevoUsuario._id;
      }
      await padre.save();
    }

    // Crear billetera activa
    await Billetera.create({
      usuario_id: nuevoUsuario._id,
      activa: true,
      saldo: 0
    });

    // Crear relación de patrocinio si se registró con código
    if (referralCodeDoc && referralCodeDoc.userId) {
      const ReferralRequest = require('../models/referralRequest');
      const { procesarComisionReferido } = require('../utils/comisionesReferidos');
      const nuevaSolicitud = await ReferralRequest.create({
        solicitante_id: nuevoUsuario._id,
        referido_id: referralCodeDoc.userId,
        estado: 'aceptado',
        fecha_respuesta: new Date(),
        comision_pagada: false,
        monto_comision: 1400,
        estado_comision: 'pendiente_verificacion',
        motivo_pendiente: 'Esperando aporte inicial del nuevo socio'
      });
      await procesarComisionReferido(nuevaSolicitud._id);
    }

    const token = jwt.sign(
      { id: nuevoUsuario._id, rol: nuevoUsuario.rol || 'user' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    nuevoUsuario.token = token;
    await nuevoUsuario.save();

    res.status(201).json({ token, usuario: nuevoUsuario });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Función para autenticar un usuario
exports.autenticarUsuario = async (req, res) => {
  const { nombre_usuario, contraseña } = req.body;

  try {
    const usuario = await Usuario.findOne({ nombre_usuario: nombre_usuario?.trim() });
    if (!usuario) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const esValido = await usuario.matchPassword(contraseña);
    if (!esValido) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // Notificar al cliente antiguo por WebSocket si existe
    if (clients && clients.has(usuario._id.toString())) {
      const oldWs = clients.get(usuario._id.toString());
      try {
        oldWs.send(JSON.stringify({ type: 'FORCE_LOGOUT', message: 'Has iniciado sesión en otro dispositivo.' }));
        oldWs.terminate();
      } catch (e) {
        console.error('Error cerrando WebSocket previo:', e);
      }
    }

    const token = jwt.sign(
      { id: usuario._id, rol: usuario.rol || 'user' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Actualizar el token de forma directa sin bloquear
    Usuario.updateOne({ _id: usuario._id }, { $set: { token } }).catch(err => {
      console.error('Error actualizando token de usuario:', err);
    });

    const usuarioRes = usuario.toObject();
    delete usuarioRes.contraseña;

    res.status(200).json({ token, usuario: usuarioRes });
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

    usuario.contraseña = nuevaContraseña;
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
    const usuario = await Usuario.findById(id).select('-contraseña -token');
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
  const {
    nombre_completo,
    linea_llamadas,
    linea_whatsapp,
    cuenta_numero,
    banco,
    titular_cuenta,
    correo_electronico,
    dni,
    nombre_usuario
  } = req.body;

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
    
    const resUser = usuario.toObject();
    delete resUser.contraseña;
    delete resUser.token;

    res.status(200).json({ message: 'Usuario actualizado exitosamente', usuario: resUser });
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
    await Billetera.deleteOne({ usuario_id: id });

    res.status(200).json({ message: 'Usuario eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Función para cerrar sesión
exports.logout = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    if (userId) {
      await Usuario.findByIdAndUpdate(userId, { token: null });
    }
    res.status(200).json({ message: 'Sesión cerrada exitosamente' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
