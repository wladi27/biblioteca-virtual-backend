const Usuario = require('../models/usuario');
const ReferralCode = require('../models/ReferralCode');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const Transaccion = require('../models/transaccion');

// Función para construir la pirámide de usuarios
const construirPiramide = async (id, nivelActual = 1, nivelMaximo = 12) => {
  if (nivelActual > nivelMaximo) return null;

  // Obtener el usuario actual y sus hijos
  const usuario = await Usuario.findById(id)
    .select('nombre_usuario hijo1_id hijo2_id hijo3_id') // Cambiar a nombre_usuario
    .lean();
  if (!usuario) return null;

  // Obtener los IDs de los hijos (filtramos los valores nulos)
  const hijosIds = [usuario.hijo1_id, usuario.hijo2_id, usuario.hijo3_id].filter(Boolean);

  // Recursivamente construir la pirámide para cada hijo
  const hijos = await Promise.all(
    hijosIds.map(async (hijoId) => {
      return await construirPiramide(hijoId, nivelActual + 1, nivelMaximo);
    })
  );

  // Retornar la estructura del usuario actual con sus hijos
  return {
    _id: usuario._id,
    nombre_usuario: usuario.nombre_usuario, // Cambiar a nombre_usuario
    hijos: hijos.filter((child) => child !== null), // Filtramos hijos nulos
  };
};

// Obtener la pirámide de un usuario específico
const obtenerPiramideUsuario = async (req, res) => {
  try {
    const usuarioId = req.params.usuario_id;
    const { nivel } = req.query;

    // Construir la pirámide hasta el nivel especificado (o nivel 12 por defecto)
    const piramide = await construirPiramide(usuarioId, 1, nivel ? parseInt(nivel) : 12);
    res.status(200).json(piramide);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Obtener la pirámide global (desde el primer usuario)
const obtenerPiramideGlobal = async (req, res) => {
  try {
    // Obtener el primer usuario de la colección
    const primerUsuario = await Usuario.findOne().sort({ _id: 1 }).lean();
    if (!primerUsuario) return res.status(404).json({ message: 'No hay usuarios disponibles' });

    // Construir la pirámide a partir del primer usuario
    const piramide = await construirPiramide(primerUsuario._id);
    res.status(200).json(piramide);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Agregar un nuevo usuario
const agregarUsuario = async (req, res) => {
  try {
    let {
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
      codigo_referido,
    } = req.body;

    // Eliminar espacios en blanco al inicio y al final
    nombre_completo = nombre_completo.trim();
    linea_llamadas = linea_llamadas.trim();
    linea_whatsapp = linea_whatsapp.trim();
    cuenta_numero = cuenta_numero.trim();
    banco = banco.trim();
    titular_cuenta = titular_cuenta.trim();
    correo_electronico = correo_electronico.trim();
    dni = dni.trim();
    nombre_usuario = nombre_usuario.trim();
    contraseña = contraseña.trim();
    codigo_referido = codigo_referido ? codigo_referido.trim() : undefined;

    // Validar campos obligatorios
    const requiredFields = [
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
    ];
    if (requiredFields.some((field) => !field)) {
      return res.status(400).json({ message: 'Todos los campos son obligatorios' });
    }

    // Validar el código de referido si se proporcionó
    if (codigo_referido) {
      // Verificar si el código existe en la base de datos
      const referralCode = await ReferralCode.findOne({ code: codigo_referido });
      
      if (!referralCode) {
        return res.status(400).json({ message: 'El código de referido no es válido' });
      }
      
      // Verificar si el código ya ha sido usado
      if (referralCode.used) {
        return res.status(400).json({ message: 'El código de referido ya ha sido utilizado' });
      }
      
      // Marcar el código como usado en la colección ReferralCode
      referralCode.used = true;
      await referralCode.save();
    }

    // Verificar si el nombre de usuario ya existe
    const usuarioExistenteNombre = await Usuario.findOne({ nombre_usuario });
    if (usuarioExistenteNombre) {
      return res.status(400).json({ message: 'El nombre de usuario ya está en uso' });
    }

    // Crear el nuevo usuario
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
      codigo_referido,
    });

    // Lógica para determinar el padre y nivel
    const usuarios = await Usuario.find();
    let padre_id = null;
    let nivel = 1;

    if (usuarios.length > 0) {
      const ultimoUsuario = usuarios[usuarios.length - 1];
      nivel = ultimoUsuario.nivel + 1;

      // Buscar un padre disponible
      const padre = await Usuario.findOne({
        $or: [
          { hijo1_id: null },
          { hijo2_id: null },
          { hijo3_id: null },
        ],
      }).sort({ _id: 1 });

      if (padre) {
        padre_id = padre._id;
      }
    }

    nuevoUsuario.padre_id = padre_id;
    nuevoUsuario.nivel = nivel;

    // Guardar el nuevo usuario
    await nuevoUsuario.save();

    // Asignar al nuevo usuario como hijo del padre
    if (padre_id) {
      await asignarHijo(padre_id, nuevoUsuario._id);
    }

    res.status(201).json(nuevoUsuario);
  } catch (error) {
    console.error('Error al agregar usuario:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Error de validación', details: error.errors });
    }
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// Función para asignar un hijo a un padre
const asignarHijo = async (padre_id, hijo_id) => {
  try {
    const padre = await Usuario.findById(padre_id);
    if (padre) {
      if (!padre.hijo1_id) {
        padre.hijo1_id = hijo_id;
      } else if (!padre.hijo2_id) {
        padre.hijo2_id = hijo_id;
      } else if (!padre.hijo3_id) {
        padre.hijo3_id = hijo_id;
      } else {
        console.warn('El padre ya tiene 3 hijos asignados');
      }
      await padre.save();
    } else {
      console.error('Padre no encontrado:', padre_id);
    }
  } catch (error) {
    console.error('Error al asignar hijo:', error);
  }
};

// Obtener todos los usuarios
const obtenerUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.find();
    res.status(200).json(usuarios);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Obtener un usuario por ID
const obtenerUsuarioPorId = async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.params.usuario_id).populate('hijo1_id hijo2_id hijo3_id');
    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });

    // Obtener información del padre
    let padre = null;
    if (usuario.padre_id) {
      padre = await Usuario.findById(usuario.padre_id).select('_id nombre_completo');
    }

    res.status(200).json({
      ...usuario.toObject(),
      padre: padre ? { id: padre._id, nombre: padre.nombre_completo } : null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Eliminar un usuario por ID
const eliminarUsuario = async (req, res) => {
  try {
    const usuario = await Usuario.findByIdAndDelete(req.params.usuario_id);
    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.status(200).json({ message: 'Usuario eliminado' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Función para contar el número total de usuarios en la pirámide
const contarUsuariosEnPiramide = async (id) => {
  const piramide = await construirPiramide(id);
  if (!piramide) return 0;

  // Contar los usuarios recursivamente
  const contarHijos = (nodo) => {
    let contador = 1; // Contamos al usuario actual
    if (nodo.hijos) {
      nodo.hijos.forEach((hijo) => {
        contador += contarHijos(hijo);
      });
    }
    return contador;
  };

  return contarHijos(piramide);
};

// Endpoint para obtener el saldo del usuario
const obtenerSaldoUsuario = async (req, res) => {
  try {
    const usuarioId = req.params.usuario_id;

    // Validar que el ID no esté vacío
    if (!usuarioId) {
      return res.status(400).json({ mensaje: 'ID de usuario es requerido' });
    }

    // Obtener todas las transacciones del usuario
    const transacciones = await Transaccion.find({ usuario_id: usuarioId });

    // Calcular el saldo
    let saldo = 0;
    transacciones.forEach(transaccion => {
      switch (transaccion.tipo) {
        case 'recarga':
        case 'recibido':
          saldo += transaccion.monto; // Sumar montos de recargas y recibidos
          break;
        case 'envio':
        case 'retiro':
          saldo -= transaccion.monto; // Restar montos de envíos y retiros
          break;
      }
    });

    // Si necesitas multiplicar el saldo por el número total de usuarios
    const totalUsuarios = await contarUsuariosEnPiramide(usuarioId);
    const preSaldo = totalUsuarios - 1;
    const saldoFinal = saldo + (preSaldo * 130); // Ajustar el saldo final

    res.status(200).json({ saldo: saldoFinal });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


module.exports = {
  agregarUsuario,
  obtenerUsuarios,
  obtenerUsuarioPorId,
  eliminarUsuario,
  obtenerPiramideUsuario,
  obtenerPiramideGlobal,
  obtenerSaldoUsuario,  
};