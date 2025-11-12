const Usuario = require('../models/usuario');
const ReferralCode = require('../models/ReferralCode');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const Transaccion = require('../models/transaccion');

// Función para construir la pirámide de usuarios
const construirPiramide = async (id, nivelActual = 1, nivelMaximo = 12) => {
  if (nivelActual > nivelMaximo) return null;

  // Obtener el usuario actual con más campos relevantes
  const usuario = await Usuario.findById(id)
    .select('nombre_usuario hijo1_id hijo2_id hijo3_id nivel') // Agregamos nivel
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

  // Retornar la estructura del usuario actual con sus hijos y nivel
  return {
    _id: usuario._id,
    nombre_usuario: usuario.nombre_usuario,
    nivel: usuario.nivel || 0, // Asegurar que siempre haya un nivel
    hijos: hijos.filter((child) => child !== null), // Filtramos hijos nulos
  };
};

const obtenerPiramideParaRed = async (req, res) => {
  try {
    const usuarioId = req.params.usuario_id;
    const nivelMaximo = req.query.nivel ? parseInt(req.query.nivel) : 12;

    // Construir la pirámide completa
    const piramideCompleta = await construirPiramide(usuarioId, 1, nivelMaximo);
    
    // Procesar la pirámide para organizarla por niveles
    const nivelesOrganizados = {};
    
    const procesarNivel = (nodo, nivelActual) => {
      if (!nivelesOrganizados[nivelActual]) {
        nivelesOrganizados[nivelActual] = [];
      }
      
      nivelesOrganizados[nivelActual].push({
        _id: nodo._id,
        nombre_usuario: nodo.nombre_usuario,
        nivel: nodo.nivel
      });
      
      // Procesar hijos recursivamente
      if (nodo.hijos && nivelActual < nivelMaximo) {
        nodo.hijos.forEach(hijo => {
          procesarNivel(hijo, nivelActual + 1);
        });
      }
    };
    
    if (piramideCompleta) {
      procesarNivel(piramideCompleta, 1);
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
  
  for (let nivel = 1; nivel <= 12; nivel++) {
    const cantidadEsperada = Math.pow(3, nivel - 1); // Nivel 1: 3^0=1, Nivel 2: 3^1=3, etc.
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

// Nuevo endpoint para obtener la pirámide completa en formato plano
const obtenerPiramideCompleta = async (req, res) => {
  try {
    const usuarioId = req.params.usuario_id;
    
    // Construir la pirámide jerárquica
    const piramide = await construirPiramide(usuarioId);
    
    if (!piramide) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    // Función recursiva para aplanar la pirámide
    const aplanarPiramide = (nodo, usuarios = []) => {
      usuarios.push({
        _id: nodo._id,
        nombre_usuario: nodo.nombre_usuario,
        nivel: nodo.nivel
      });
      
      if (nodo.hijos && nodo.hijos.length > 0) {
        nodo.hijos.forEach(hijo => {
          aplanarPiramide(hijo, usuarios);
        });
      }
      
      return usuarios;
    };
    
    // Obtener todos los usuarios en formato plano
    const usuariosPiramide = aplanarPiramide(piramide);
    
    // Ordenar por nivel y luego por nombre de usuario
    usuariosPiramide.sort((a, b) => {
      if (a.nivel !== b.nivel) {
        return a.nivel - b.nivel;
      }
      return a.nombre_usuario.localeCompare(b.nombre_usuario);
    });
    
    res.status(200).json({
      usuarios: usuariosPiramide
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

// Editar información del usuario (excepto hijos, padre y contraseña)
const editarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    // Campos permitidos para editar
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

    // Construir objeto de actualización solo con los campos permitidos
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
const obtenerUsuariosPaginados = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      sortBy = 'fecha_creacion',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Construir filtro de búsqueda
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

    // Construir ordenamiento
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Obtener usuarios con paginación
    const usuarios = await Usuario.find(filtro)
      .select('nombre_completo nombre_usuario correo_electronico dni linea_llamadas linea_whatsapp nivel fecha_creacion')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Obtener total de documentos para la paginación
    const total = await Usuario.countDocuments(filtro);

    // Calcular información de paginación
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

const agregarUsuariosEnLote = async (req, res) => {
  try {
    const { usuarios } = req.body;
    
    if (!usuarios || !Array.isArray(usuarios)) {
      return res.status(400).json({ message: 'Formato de datos inválido' });
    }

    if (usuarios.length > 20) {
      return res.status(400).json({ message: 'Máximo 20 usuarios por lote' });
    }

    // Obtener el último usuario para determinar el nivel inicial
    const ultimoUsuario = await Usuario.findOne().sort({ _id: -1 });
    let nivelActual = ultimoUsuario ? ultimoUsuario.nivel + 1 : 1;

    const usuariosCreados = [];

    // ESTRATEGIA MEJORADA: Obtener TODOS los padres disponibles ordenados
    const padresDisponibles = await Usuario.find({
      $or: [
        { hijo1_id: null },
        { hijo2_id: null },
        { hijo3_id: null }
      ]
    }).sort({ nivel: 1, _id: 1 }); // Primero por nivel más bajo, luego por antigüedad

    console.log(`Padres disponibles: ${padresDisponibles.length}`);

    // Si no hay padres disponibles pero hay usuarios, usar el último usuario
    if (padresDisponibles.length === 0 && ultimoUsuario) {
      padresDisponibles.push(ultimoUsuario);
    }

    for (let i = 0; i < usuarios.length; i++) {
      const usuarioData = usuarios[i];
      
      // Validaciones
      if (!usuarioData.nombre_usuario || !usuarioData.contraseña) {
        return res.status(400).json({ 
          message: `Usuario ${i + 1}: nombre de usuario y contraseña son requeridos` 
        });
      }

      // Verificar duplicados
      const existe = await Usuario.findOne({ 
        nombre_usuario: usuarioData.nombre_usuario 
      });
      if (existe) {
        return res.status(400).json({ 
          message: `El nombre de usuario "${usuarioData.nombre_usuario}" ya existe` 
        });
      }

      // BUSCAR PADRE DISPONIBLE - LÓGICA CORREGIDA
      let padreActual = null;
      
      // Buscar en la lista de padres disponibles
      for (let j = 0; j < padresDisponibles.length; j++) {
        const padre = padresDisponibles[j];
        
        // Verificar si este padre realmente tiene espacio (actualizado)
        const padreActualizado = await Usuario.findById(padre._id);
        if (!padreActualizado.hijo1_id || !padreActualizado.hijo2_id || !padreActualizado.hijo3_id) {
          padreActual = padreActualizado;
          break;
        } else {
          // Este padre ya está lleno, remover de la lista
          padresDisponibles.splice(j, 1);
          j--; // Ajustar índice después de remover
        }
      }

      // Si no se encontró padre en la lista, buscar uno nuevo
      if (!padreActual) {
        padreActual = await Usuario.findOne({
          $or: [
            { hijo1_id: null },
            { hijo2_id: null },
            { hijo3_id: null }
          ]
        }).sort({ nivel: 1, _id: 1 });
        
        if (padreActual) {
          padresDisponibles.push(padreActual);
        }
      }

      // Si aún no hay padre, usar el último usuario como fallback
      if (!padreActual && ultimoUsuario) {
        padreActual = ultimoUsuario;
      }

      console.log(`Usuario ${i+1}: Padre asignado = ${padreActual ? padreActual.nombre_usuario : 'Ninguno'}`);

      // Crear usuario
      const nuevoUsuario = new Usuario({
        ...usuarioData,
        nivel: nivelActual++,
        padre_id: padreActual ? padreActual._id : null
      });

      const usuarioGuardado = await nuevoUsuario.save();
      usuariosCreados.push(usuarioGuardado);

      // Asignar como hijo del padre
      if (padreActual) {
        await asignarHijoYActualizarLista(padreActual._id, usuarioGuardado._id, padresDisponibles);
      }
    }

    res.status(201).json({
      message: `${usuariosCreados.length} usuarios creados exitosamente`,
      usuarios: usuariosCreados.map(u => ({
        _id: u._id,
        nombre_usuario: u.nombre_usuario,
        nivel: u.nivel,
        padre_id: u.padre_id
      }))
    });

  } catch (error) {
    console.error('Error en registro masivo:', error);
    res.status(500).json({ 
      message: 'Error en el servidor', 
      error: error.message 
    });
  }
};

// Función mejorada para asignar hijos y actualizar la lista de padres
const asignarHijoYActualizarLista = async (padre_id, hijo_id, padresDisponibles) => {
  try {
    const padre = await Usuario.findById(padre_id);
    if (!padre) return;

    let campoAsignado = null;
    
    // Asignar al primer campo disponible
    if (!padre.hijo1_id) {
      padre.hijo1_id = hijo_id;
      campoAsignado = 'hijo1_id';
    } else if (!padre.hijo2_id) {
      padre.hijo2_id = hijo_id;
      campoAsignado = 'hijo2_id';
    } else if (!padre.hijo3_id) {
      padre.hijo3_id = hijo_id;
      campoAsignado = 'hijo3_id';
    }

    if (campoAsignado) {
      await padre.save();
      console.log(`✅ Usuario ${hijo_id} asignado como ${campoAsignado} de ${padre.nombre_usuario}`);

      // Verificar si el padre ya está lleno después de esta asignación
      const padreActualizado = await Usuario.findById(padre_id);
      if (padreActualizado.hijo1_id && padreActualizado.hijo2_id && padreActualizado.hijo3_id) {
        // Remover de la lista de padres disponibles
        const index = padresDisponibles.findIndex(p => p._id.equals(padre_id));
        if (index !== -1) {
          padresDisponibles.splice(index, 1);
          console.log(`➖ Padre ${padre.nombre_usuario} removido de disponibles (ya tiene 3 hijos)`);
        }
      }
    } else {
      console.warn(`⚠️ El padre ${padre.nombre_usuario} ya tiene 3 hijos asignados`);
    }
  } catch (error) {
    console.error('Error asignando hijo:', error);
  }
};

module.exports = {
  agregarUsuario,
  agregarUsuariosEnLote,
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
};