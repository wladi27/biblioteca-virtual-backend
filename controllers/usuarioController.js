const Usuario = require('../models/usuario');
const ReferralCode = require('../models/ReferralCode');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const Transaccion = require('../models/transaccion');

// Función optimizada para obtener usuarios por nivel específico - CORREGIDA
const obtenerPiramidePorNivel = async (req, res) => {
  try {
    const { usuarioId, nivel } = req.params;
    const nivelNum = parseInt(nivel);

    if (!usuarioId || nivelNum < 0 || nivelNum > 11) {
      return res.status(400).json({ message: 'Parámetros inválidos. Niveles: 0-11' });
    }

    // Obtener usuarios del nivel específico
    const usuariosNivel = await obtenerUsuariosPorNivel(usuarioId, nivelNum);
    
    // Calcular cantidad esperada: 3^nivel
    const cantidadEsperada = nivelNum === 0 ? 1 : Math.pow(3, nivelNum);
    
    res.status(200).json({
      usuarios: usuariosNivel,
      nivel: nivelNum,
      total: usuariosNivel.length,
      esperado: cantidadEsperada
    });
  } catch (error) {
    console.error('Error obteniendo nivel:', error);
    res.status(500).json({ message: error.message });
  }
};

// Función CORREGIDA para obtener usuarios de un nivel específico
const obtenerUsuariosPorNivel = async (usuarioId, nivelObjetivo) => {
  if (nivelObjetivo === 0) {
    // Nivel 0: solo el usuario raíz
    const usuario = await Usuario.findById(usuarioId)
      .select('_id nombre_usuario nivel')
      .lean();
    return usuario ? [usuario] : [];
  }

  try {
    // Para niveles > 0, obtener todos los usuarios en ese nivel
    let usuariosNivel = [];
    let nivelActual = 0;
    let usuariosActuales = [usuarioId];

    while (nivelActual < nivelObjetivo && usuariosActuales.length > 0) {
      // Obtener todos los hijos de los usuarios actuales
      const hijos = await Usuario.find({
        padre_id: { $in: usuariosActuales }
      })
      .select('_id nombre_usuario nivel padre_id hijo1_id hijo2_id hijo3_id')
      .lean();

      nivelActual++;
      usuariosActuales = hijos.map(hijo => hijo._id);

      if (nivelActual === nivelObjetivo) {
        usuariosNivel = hijos;
      }
    }

    return usuariosNivel.map(usuario => ({
      _id: usuario._id,
      nombre_usuario: usuario.nombre_usuario,
      nivel: usuario.nivel
    }));

  } catch (error) {
    console.error('Error en obtenerUsuariosPorNivel:', error);
    // Fallback a método recursivo
    return await obtenerUsuariosPorNivelRecursivo(usuarioId, nivelObjetivo);
  }
};

// Método recursivo como fallback - CORREGIDO
const obtenerUsuariosPorNivelRecursivo = async (usuarioId, nivelObjetivo, nivelActual = 0, usuariosActuales = []) => {
  if (nivelActual === 0) {
    const usuario = await Usuario.findById(usuarioId)
      .select('_id nombre_usuario nivel hijo1_id hijo2_id hijo3_id')
      .lean();
    if (!usuario) return [];
    usuariosActuales = [usuario];
  }

  if (nivelActual === nivelObjetivo) {
    return usuariosActuales.map(u => ({
      _id: u._id,
      nombre_usuario: u.nombre_usuario,
      nivel: u.nivel
    }));
  }

  // Obtener todos los hijos directos de los usuarios actuales
  const todosLosHijos = await Promise.all(
    usuariosActuales.map(async (usuario) => {
      const hijosIds = [usuario.hijo1_id, usuario.hijo2_id, usuario.hijo3_id].filter(Boolean);
      if (hijosIds.length === 0) return [];
      
      const hijos = await Usuario.find({ _id: { $in: hijosIds } })
        .select('_id nombre_usuario nivel hijo1_id hijo2_id hijo3_id')
        .lean();
      
      return hijos;
    })
  );

  const hijosPlanos = todosLosHijos.flat();

  if (hijosPlanos.length === 0) return [];

  return await obtenerUsuariosPorNivelRecursivo(usuarioId, nivelObjetivo, nivelActual + 1, hijosPlanos);
};

// Función construirPiramide optimizada
const construirPiramide = async (id, nivelActual = 0, nivelMaximo = 11, cache = new Map()) => {
  if (nivelActual > nivelMaximo) return null;
  
  const cacheKey = `${id}-${nivelActual}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const usuario = await Usuario.findById(id)
    .select('nombre_usuario hijo1_id hijo2_id hijo3_id nivel')
    .populate('hijo1_id', 'nombre_usuario nivel')
    .populate('hijo2_id', 'nombre_usuario nivel')
    .populate('hijo3_id', 'nombre_usuario nivel')
    .lean();

  if (!usuario) {
    cache.set(cacheKey, null);
    return null;
  }

  const hijosIds = [usuario.hijo1_id, usuario.hijo2_id, usuario.hijo3_id]
    .filter(hijo => hijo && hijo._id);

  const hijos = await Promise.all(
    hijosIds.map(async (hijo) => {
      if (nivelActual + 1 <= nivelMaximo) {
        return await construirPiramide(hijo._id, nivelActual + 1, nivelMaximo, cache);
      }
      return {
        _id: hijo._id,
        nombre_usuario: hijo.nombre_usuario,
        nivel: hijo.nivel,
        hijos: []
      };
    })
  );

  const resultado = {
    _id: usuario._id,
    nombre_usuario: usuario.nombre_usuario,
    nivel: nivelActual, // Usar nivelActual en lugar del nivel de la base de datos
    hijos: hijos.filter(child => child !== null),
  };

  cache.set(cacheKey, resultado);
  return resultado;
};

const obtenerPiramideParaRed = async (req, res) => {
  try {
    const usuarioId = req.params.usuario_id;
    const nivelMaximo = req.query.nivel ? parseInt(req.query.nivel) : 11;

    const piramideCompleta = await construirPiramide(usuarioId, 0, nivelMaximo);
    
    const nivelesOrganizados = {};
    
    const procesarNivel = (nodo, nivelActual) => {
      if (!nivelesOrganizados[nivelActual]) {
        nivelesOrganizados[nivelActual] = [];
      }
      
      nivelesOrganizados[nivelActual].push({
        _id: nodo._id,
        nombre_usuario: nodo.nombre_usuario,
        nivel: nivelActual // Usar nivelActual
      });
      
      if (nodo.hijos && nivelActual < nivelMaximo) {
        nodo.hijos.forEach(hijo => {
          procesarNivel(hijo, nivelActual + 1);
        });
      }
    };
    
    if (piramideCompleta) {
      procesarNivel(piramideCompleta, 0);
    }

    res.status(200).json({
      piramide: piramideCompleta,
      niveles: nivelesOrganizados,
      nivelesCompletados: calcularNivelesCompletados(nivelesOrganizados)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Función auxiliar para calcular niveles completados
const calcularNivelesCompletados = (niveles) => {
  let nivelesCompletados = 0;
  
  for (let nivel = 0; nivel <= 11; nivel++) {
    const cantidadEsperada = nivel === 0 ? 1 : Math.pow(3, nivel);
    if (niveles[nivel] && niveles[nivel].length >= cantidadEsperada) {
      nivelesCompletados++;
    } else {
      break;
    }
  }
  
  return nivelesCompletados;
};

// Obtener la pirámide de un usuario específico
const obtenerPiramideUsuario = async (req, res) => {
  try {
    const usuarioId = req.params.usuario_id;
    const { nivel } = req.query;

    const piramide = await construirPiramide(usuarioId, 0, nivel ? parseInt(nivel) : 11);
    res.status(200).json(piramide);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Obtener la pirámide global (desde el primer usuario)
const obtenerPiramideGlobal = async (req, res) => {
  try {
    const primerUsuario = await Usuario.findOne().sort({ _id: 1 }).lean();
    if (!primerUsuario) return res.status(404).json({ message: 'No hay usuarios disponibles' });

    const piramide = await construirPiramide(primerUsuario._id, 0, 11);
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
      const referralCode = await ReferralCode.findOne({ code: codigo_referido });
      
      if (!referralCode) {
        return res.status(400).json({ message: 'El código de referido no es válido' });
      }
      
      if (referralCode.used) {
        return res.status(400).json({ message: 'El código de referido ya ha sido utilizado' });
      }
      
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

// Función optimizada para obtener la pirámide completa en formato plano
const obtenerPiramideCompleta = async (req, res) => {
  try {
    const usuarioId = req.params.usuario_id;
    
    const resultado = await Usuario.aggregate([
      {
        $match: { _id: new mongoose.Types.ObjectId(usuarioId) }
      },
      {
        $graphLookup: {
          from: 'usuarios',
          startWith: '$_id',
          connectFromField: '_id',
          connectToField: 'padre_id',
          as: 'redCompleta',
          maxDepth: 11,
          depthField: 'nivelRed'
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
                  as: 'usuario',
                  in: {
                    _id: '$$usuario._id',
                    nombre_usuario: '$$usuario.nombre_usuario',
                    nivel: { $add: ['$$usuario.nivelRed', 1] }
                  }
                }
              }
            ]
          }
        }
      },
      {
        $unwind: '$usuarios'
      },
      {
        $replaceRoot: { newRoot: '$usuarios' }
      },
      {
        $sort: { nivel: 1, nombre_usuario: 1 }
      }
    ]);

    res.status(200).json({
      usuarios: resultado
    });
    
  } catch (error) {
    console.error('Error en piramide optimizada:', error);
    const piramide = await construirPiramide(usuarioId, 0, 11);
    
    if (!piramide) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    const aplanarPiramide = (nodo, nivelActual = 0, usuarios = []) => {
      usuarios.push({
        _id: nodo._id,
        nombre_usuario: nodo.nombre_usuario,
        nivel: nivelActual
      });
      
      if (nodo.hijos && nodo.hijos.length > 0) {
        nodo.hijos.forEach(hijo => {
          aplanarPiramide(hijo, nivelActual + 1, usuarios);
        });
      }
      
      return usuarios;
    };
    
    const usuariosPiramide = aplanarPiramide(piramide, 0);
    
    usuariosPiramide.sort((a, b) => {
      if (a.nivel !== b.nivel) {
        return a.nivel - b.nivel;
      }
      return a.nombre_usuario.localeCompare(b.nombre_usuario);
    });
    
    res.status(200).json({
      usuarios: usuariosPiramide
    });
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

  const contarHijos = (nodo) => {
    let contador = 1;
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

    if (!usuarioId) {
      return res.status(400).json({ mensaje: 'ID de usuario es requerido' });
    }

    const transacciones = await Transaccion.find({ usuario_id: usuarioId });

    let saldo = 0;
    transacciones.forEach(transaccion => {
      switch (transaccion.tipo) {
        case 'recarga':
        case 'recibido':
          saldo += transaccion.monto;
          break;
        case 'envio':
        case 'retiro':
          saldo -= transaccion.monto;
          break;
      }
    });

    const totalUsuarios = await contarUsuariosEnPiramide(usuarioId);
    const preSaldo = totalUsuarios - 1;
    const saldoFinal = saldo + (preSaldo * 130);

    res.status(200).json({ saldo: saldoFinal });
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
    );

    if (!usuarioActualizado) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json(usuarioActualizado);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar el usuario', error: error.message });
  }
};

// Obtener usuarios con paginación y filtros
// En la función obtenerUsuariosPaginados, modifica la parte del sort:
const obtenerUsuariosPaginados = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      sortBy = 'nivel', // Cambiado por defecto a nivel
      sortOrder = 'asc'  // Cambiado por defecto a ascendente
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    let filtro = {};
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filtro = {
        $or: [
          { nombre_completo: searchRegex },
          { nombre_usuario: searchRegex },
          { correo_electronico: searchRegex },
          { dni: searchRegex },
          { linea_llamadas: searchRegex },
          { linea_whatsapp: searchRegex }
        ]
      };
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Si ordenamos por nivel, agregar orden secundario por nombre
    if (sortBy === 'nivel') {
      sort['nombre_completo'] = 1;
    }

    const usuarios = await Usuario.find(filtro)
      .select('nombre_completo nombre_usuario correo_electronico dni linea_llamadas linea_whatsapp nivel fecha_creacion')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await Usuario.countDocuments(filtro);

    const totalPages = Math.ceil(total / limitNum);
    const hasNext = pageNum < totalPages;
    const hasPrev = pageNum > 1;

    res.status(200).json({
      usuarios,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: total,
        itemsPerPage: limitNum,
        hasNext,
        hasPrev,
        nextPage: hasNext ? pageNum + 1 : null,
        prevPage: hasPrev ? pageNum - 1 : null
      }
    });
  } catch (error) {
    console.error('Error al obtener usuarios paginados:', error);
    res.status(500).json({ 
      message: 'Error en el servidor', 
      error: error.message 
    });
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
  obtenerPiramideParaRed,  
  obtenerPiramideCompleta,
  obtenerUsuariosPaginados, 
  editarUsuario,
  obtenerPiramidePorNivel,
  obtenerUsuariosPorNivel
};