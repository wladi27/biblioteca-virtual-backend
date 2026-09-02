const Usuario = require('../models/usuario');
const ReferralCode = require('../models/ReferralCode');
const Billetera = require('../models/billetera');
const Transaccion = require('../models/transaccion');
const mongoose = require('mongoose');

// Asignar el siguiente hijo disponible a un padre de forma atómica
const asignarHijoAlPadre = async (padreId, hijoId) => {
  if (!padreId) return;

  const res1 = await Usuario.updateOne(
    { _id: padreId, hijo1_id: null },
    { $set: { hijo1_id: hijoId } }
  );

  if (res1.modifiedCount === 0) {
    const res2 = await Usuario.updateOne(
      { _id: padreId, hijo2_id: null },
      { $set: { hijo2_id: hijoId } }
    );

    if (res2.modifiedCount === 0) {
      await Usuario.updateOne(
        { _id: padreId, hijo3_id: null },
        { $set: { hijo3_id: hijoId } }
      );
    }
  }
};

// Agregar un nuevo usuario con asignación secuencial optimizada de matriz (O(1))
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

    // Sanitizar campos
    nombre_completo = (nombre_completo || '').trim();
    linea_llamadas = (linea_llamadas || '').trim();
    linea_whatsapp = (linea_whatsapp || '').trim();
    cuenta_numero = (cuenta_numero || '').trim();
    banco = (banco || '').trim();
    titular_cuenta = (titular_cuenta || '').trim();
    correo_electronico = (correo_electronico || '').trim().toLowerCase();
    dni = (dni || '').trim();
    nombre_usuario = (nombre_usuario || '').trim();
    contraseña = (contraseña || '').trim();
    codigo_referido = codigo_referido ? codigo_referido.trim() : undefined;

    // Validar campos obligatorios
    if (
      !nombre_completo ||
      !correo_electronico ||
      !dni ||
      !nombre_usuario ||
      !contraseña
    ) {
      return res.status(400).json({ message: 'Todos los campos requeridos deben ser completados.' });
    }

    // Validar código de referido si se proporciona
    let referralCodeDoc = null;
    if (codigo_referido) {
      referralCodeDoc = await ReferralCode.findOne({ code: codigo_referido });
      if (!referralCodeDoc) {
        return res.status(400).json({ message: 'El código de referido no es válido.' });
      }
      if (referralCodeDoc.used) {
        return res.status(400).json({ message: 'El código de referido ya ha sido utilizado.' });
      }
      referralCodeDoc.used = true;
      await referralCodeDoc.save();
    }

    // Verificar unicidad de nombre de usuario
    const usuarioExistente = await Usuario.findOne({ nombre_usuario });
    if (usuarioExistente) {
      return res.status(400).json({ message: 'El nombre de usuario ya está en uso.' });
    }

    // Buscar directamente el siguiente padre disponible en la matriz ternaria por orden de creación (_id asc)
    const padre = await Usuario.findOne({
      $or: [
        { hijo1_id: null },
        { hijo2_id: null },
        { hijo3_id: null }
      ]
    })
    .sort({ _id: 1 })
    .select('_id nivel hijo1_id hijo2_id hijo3_id');

    const padre_id = padre ? padre._id : null;
    const nivel = padre ? ((padre.nivel || 1) + 1) : 1;

    // Crear y guardar el nuevo usuario
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
      padre_id,
      nivel
    });

    await nuevoUsuario.save();

    // Asignar al padre de forma atómica
    if (padre_id) {
      await asignarHijoAlPadre(padre_id, nuevoUsuario._id);
    }

    // Inicializar billetera activa para el nuevo usuario
    await Billetera.create({
      usuario_id: nuevoUsuario._id,
      activa: true,
      saldo: 0
    });

    // Crear relación de referido directo si se registró con código
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

    res.status(201).json(nuevoUsuario);
  } catch (error) {
    console.error('Error al agregar usuario:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Error de validación', details: error.errors });
    }
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// Obtener la pirámide completa de un usuario usando $graphLookup optimizado
const obtenerPiramideCompleta = async (req, res) => {
  try {
    const usuarioId = req.params.usuario_id;
    if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
      return res.status(400).json({ message: 'ID de usuario inválido.' });
    }

    const resultado = await Usuario.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(usuarioId) } },
      {
        $graphLookup: {
          from: 'usuarios',
          startWith: '$_id',
          connectFromField: '_id',
          connectToField: 'padre_id',
          as: 'redCompleta',
          maxDepth: 11,
          depthField: 'profundidad'
        }
      },
      {
        $project: {
          usuarios: {
            $concatArrays: [
              [{
                _id: '$_id',
                nombre_usuario: '$nombre_usuario',
                nivel: 0
              }],
              {
                $map: {
                  input: '$redCompleta',
                  as: 'u',
                  in: {
                    _id: '$$u._id',
                    nombre_usuario: '$$u.nombre_usuario',
                    nivel: { $add: ['$$u.profundidad', 1] }
                  }
                }
              }
            ]
          }
        }
      },
      { $unwind: '$usuarios' },
      { $replaceRoot: { newRoot: '$usuarios' } },
      { $sort: { nivel: 1, nombre_usuario: 1 } }
    ]);

    res.status(200).json({ usuarios: resultado });
  } catch (error) {
    console.error('Error en obtenerPiramideCompleta:', error);
    res.status(500).json({ message: error.message });
  }
};

// Obtener pirámide estructurada por niveles para la vista de Red (Hasta 11 niveles sin saturación)
const obtenerPiramideParaRed = async (req, res) => {
  try {
    const usuarioId = req.params.usuario_id;
    const nivelMaximo = req.query.nivel ? parseInt(req.query.nivel, 10) : 11;

    if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
      return res.status(400).json({ message: 'ID de usuario inválido.' });
    }

    const [usuarioRaiz] = await Usuario.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(usuarioId) } },
      {
        $graphLookup: {
          from: 'usuarios',
          startWith: '$_id',
          connectFromField: '_id',
          connectToField: 'padre_id',
          as: 'redCompleta',
          maxDepth: nivelMaximo,
          depthField: 'profundidad'
        }
      }
    ]);

    if (!usuarioRaiz) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Organizar en memoria los niveles en tiempo constante O(N)
    const nivelesOrganizados = {
      0: [{ _id: usuarioRaiz._id, nombre_usuario: usuarioRaiz.nombre_usuario, nivel: 0 }]
    };

    if (usuarioRaiz.redCompleta && Array.isArray(usuarioRaiz.redCompleta)) {
      usuarioRaiz.redCompleta.forEach((u) => {
        const nivelRed = (u.profundidad || 0) + 1;
        if (!nivelesOrganizados[nivelRed]) {
          nivelesOrganizados[nivelRed] = [];
        }
        nivelesOrganizados[nivelRed].push({
          _id: u._id,
          nombre_usuario: u.nombre_usuario,
          nivel: nivelRed
        });
      });
    }

    // Calcular niveles completados (3^nivel)
    let nivelesCompletados = 0;
    for (let i = 1; i <= nivelMaximo; i++) {
      const esperados = Math.pow(3, i);
      if (nivelesOrganizados[i] && nivelesOrganizados[i].length >= esperados) {
        nivelesCompletados++;
      } else {
        break;
      }
    }

    res.status(200).json({
      piramide: {
        _id: usuarioRaiz._id,
        nombre_usuario: usuarioRaiz.nombre_usuario,
        nivel: 0,
        totalDescendientes: (usuarioRaiz.redCompleta || []).length
      },
      niveles: nivelesOrganizados,
      nivelesCompletados
    });
  } catch (error) {
    console.error('Error en obtenerPiramideParaRed:', error);
    res.status(500).json({ message: error.message });
  }
};

// Obtener pirámide para un nivel específico
const obtenerPiramidePorNivel = async (req, res) => {
  try {
    const { usuarioId, nivel } = req.params;
    const nivelNum = parseInt(nivel, 10);

    if (!mongoose.Types.ObjectId.isValid(usuarioId) || isNaN(nivelNum) || nivelNum < 0 || nivelNum > 11) {
      return res.status(400).json({ message: 'Parámetros inválidos. Niveles: 0-11' });
    }

    if (nivelNum === 0) {
      const usuario = await Usuario.findById(usuarioId).select('_id nombre_usuario nivel').lean();
      return res.status(200).json({
        usuarios: usuario ? [usuario] : [],
        nivel: 0,
        total: usuario ? 1 : 0,
        esperado: 1
      });
    }

    const [datos] = await Usuario.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(usuarioId) } },
      {
        $graphLookup: {
          from: 'usuarios',
          startWith: '$_id',
          connectFromField: '_id',
          connectToField: 'padre_id',
          as: 'redCompleta',
          maxDepth: nivelNum,
          depthField: 'profundidad'
        }
      }
    ]);

    const usuariosNivel = (datos && datos.redCompleta ? datos.redCompleta : [])
      .filter((u) => u.profundidad === (nivelNum - 1))
      .map((u) => ({
        _id: u._id,
        nombre_usuario: u.nombre_usuario,
        nivel: nivelNum
      }));

    const cantidadEsperada = Math.pow(3, nivelNum);

    res.status(200).json({
      usuarios: usuariosNivel,
      nivel: nivelNum,
      total: usuariosNivel.length,
      esperado: cantidadEsperada
    });
  } catch (error) {
    console.error('Error en obtenerPiramidePorNivel:', error);
    res.status(500).json({ message: error.message });
  }
};

// Obtener la pirámide de un usuario específico
const obtenerPiramideUsuario = async (req, res) => {
  return obtenerPiramideParaRed(req, res);
};

// Obtener la pirámide global (desde el usuario raíz)
const obtenerPiramideGlobal = async (req, res) => {
  try {
    const primerUsuario = await Usuario.findOne().sort({ _id: 1 }).select('_id').lean();
    if (!primerUsuario) {
      return res.status(404).json({ message: 'No hay usuarios disponibles' });
    }
    req.params.usuario_id = primerUsuario._id.toString();
    return obtenerPiramideParaRed(req, res);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Obtener todos los usuarios
const obtenerUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.find()
      .select('-contraseña -token')
      .sort({ nivel: 1, _id: 1 })
      .lean();
    res.status(200).json(usuarios);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Obtener un usuario por ID
const obtenerUsuarioPorId = async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.params.usuario_id)
      .select('-contraseña -token')
      .populate('hijo1_id', 'nombre_usuario')
      .populate('hijo2_id', 'nombre_usuario')
      .populate('hijo3_id', 'nombre_usuario')
      .populate('padre_id', 'nombre_completo nombre_usuario')
      .lean();

    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.status(200).json(usuario);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Eliminar un usuario por ID y desenlazarlo del padre
const eliminarUsuario = async (req, res) => {
  try {
    const usuarioId = req.params.usuario_id;
    const usuario = await Usuario.findById(usuarioId);
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Desenlazar del padre si existe
    if (usuario.padre_id) {
      await Usuario.updateOne(
        { _id: usuario.padre_id, hijo1_id: usuarioId },
        { $set: { hijo1_id: null } }
      );
      await Usuario.updateOne(
        { _id: usuario.padre_id, hijo2_id: usuarioId },
        { $set: { hijo2_id: null } }
      );
      await Usuario.updateOne(
        { _id: usuario.padre_id, hijo3_id: usuarioId },
        { $set: { hijo3_id: null } }
      );
    }

    await Usuario.findByIdAndDelete(usuarioId);
    await Billetera.deleteOne({ usuario_id: usuarioId });

    res.status(200).json({ message: 'Usuario eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Endpoint unificado para obtener el saldo del usuario
const obtenerSaldoUsuario = async (req, res) => {
  try {
    const usuarioId = req.params.usuario_id;
    if (!usuarioId) {
      return res.status(400).json({ mensaje: 'ID de usuario es requerido' });
    }

    let billetera = await Billetera.findOne({ usuario_id: usuarioId });
    if (!billetera) {
      billetera = new Billetera({ usuario_id: usuarioId, activa: true, saldo: 0 });
      await billetera.save();
    }

    res.status(200).json({ saldo: billetera.saldo });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Editar información del usuario
const editarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const camposEditables = [
      'nombre_completo',
      'linea_llamadas',
      'linea_whatsapp',
      'cuenta_numero',
      'banco',
      'titular_cuenta',
      'correo_electronico',
      'dni',
      'nombre_usuario',
      'codigo_referido'
    ];

    const actualizacion = {};
    camposEditables.forEach((campo) => {
      if (req.body[campo] !== undefined) {
        actualizacion[campo] = req.body[campo];
      }
    });

    const usuarioActualizado = await Usuario.findByIdAndUpdate(
      id,
      { $set: actualizacion },
      { new: true, runValidators: true }
    ).select('-contraseña -token');

    if (!usuarioActualizado) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json(usuarioActualizado);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar el usuario', error: error.message });
  }
};

// Obtener usuarios con paginación y filtros
const obtenerUsuariosPaginados = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      sortBy = 'nivel',
      sortOrder = 'asc'
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    let filtro = {};
    if (search && search.trim() !== '') {
      filtro = {
        $or: [
          { nombre_completo: { $regex: search.trim(), $options: 'i' } },
          { nombre_usuario: { $regex: search.trim(), $options: 'i' } },
          { dni: { $regex: search.trim(), $options: 'i' } },
          { correo_electronico: { $regex: search.trim(), $options: 'i' } }
        ]
      };
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [usuarios, total] = await Promise.all([
      Usuario.find(filtro)
        .select('-contraseña -token')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Usuario.countDocuments(filtro)
    ]);

    res.status(200).json({
      usuarios,
      paginacion: {
        pagina: pageNum,
        totalPaginas: Math.ceil(total / limitNum),
        totalUsuarios: total,
        limite: limitNum
      }
    });
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
  obtenerPiramideParaRed,
  obtenerPiramidePorNivel,
  obtenerPiramideCompleta,
  obtenerSaldoUsuario,
  editarUsuario,
  obtenerUsuariosPaginados
};