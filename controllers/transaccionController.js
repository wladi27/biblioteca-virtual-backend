const Transaccion = require('../models/transaccion');
const RecargaMasiva = require('../models/recargaMasiva');
const Billetera = require('../models/billetera'); // ← AGREGAR ESTA LÍNEA
const Usuario = require('../models/usuario');     // ← AGREGAR ESTA LÍNEA

// Obtener transacciones (todas o por usuario específico) con filtros mejorados
exports.obtenerTransacciones = async (req, res) => {
  try {
    const usuarioId = req.params.id;
    const { 
      tipo, 
      estado, 
      fecha_inicio, 
      fecha_fin, 
      incluir_recargas_masivas = 'false',
      limit = 10, // Cambiar a 10 para mejor experiencia de scroll
      page = 1,
      search // ← AGREGAR ESTE PARÁMETRO
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    let filtro = {};

    // Filtro por usuario específico
    if (usuarioId) {
      filtro.usuario_id = usuarioId;
    }

    // FILTRO POR BÚSQUEDA - AGREGAR ESTO
    if (search && search.trim() !== '') {
      filtro.descripcion = { $regex: search, $options: 'i' };
    }

    // Filtro por tipo de transacción
    if (tipo) {
      if (tipo === 'recarga_masiva') {
        filtro.tipo = 'recarga_masiva';
      } else if (tipo === 'todas_recargas' && incluir_recargas_masivas === 'true') {
        // Incluir tanto recargas normales como masivas
        filtro.$or = [
          { tipo: 'recarga' },
          { tipo: 'recarga_masiva' }
        ];
      } else {
        filtro.tipo = tipo;
      }
    } else if (incluir_recargas_masivas === 'true') {
      // Si no se especifica tipo pero se quieren incluir recargas masivas
      filtro = {
        $or: [
          { tipo: { $in: ['recarga', 'envio', 'retiro', 'recibido'] } },
          { tipo: 'recarga_masiva' }
        ]
      };
      if (usuarioId) {
        filtro.$or.forEach(condition => {
          condition.usuario_id = usuarioId;
        });
      }
    }

    // Filtro por estado
    if (estado) {
      filtro.estado = estado;
    }

    // Filtro por rango de fechas
    if (fecha_inicio && fecha_fin) {
      filtro.fecha = {
        $gte: new Date(fecha_inicio),
        $lte: new Date(fecha_fin)
      };
    } else if (fecha_inicio) {
      filtro.fecha = { $gte: new Date(fecha_inicio) };
    } else if (fecha_fin) {
      filtro.fecha = { $lte: new Date(fecha_fin) };
    }

    const transacciones = await Transaccion.find(filtro)
      .populate('usuario_id', 'nombre email documento')
      .populate('recarga_masiva_id', 'monto_individual total_billeteras fecha_ejecucion')
      .sort({ fecha: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Transaccion.countDocuments(filtro);

    // Estadísticas adicionales
    const estadisticas = await Transaccion.aggregate([
      { $match: filtro },
      {
        $group: {
          _id: null,
          totalMonto: { $sum: '$monto' },
          promedioMonto: { $avg: '$monto' },
          totalTransacciones: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      transacciones,
      paginacion: {
        pagina: parseInt(page),
        totalPaginas: Math.ceil(total / parseInt(limit)),
        totalTransacciones: total,
        limite: parseInt(limit),
        hasMore: (skip + transacciones.length) < total
      },
      estadisticas: estadisticas[0] || {
        totalMonto: 0,
        promedioMonto: 0,
        totalTransacciones: 0
      },
      filtrosAplicados: {
        usuario: usuarioId ? true : false,
        tipo: tipo || 'todos',
        estado: estado || 'todos',
        rangoFechas: (fecha_inicio || fecha_fin) ? true : false
      }
    });

  } catch (error) {
    console.error('Error en obtenerTransacciones:', error);
    res.status(500).json({ 
      mensaje: 'Error en el servidor al obtener transacciones', 
      error: error.message 
    });
  }
};

// Obtener solo las transacciones de tipo "recarga" con opción de incluir recargas masivas
exports.obtenerRecargas = async (req, res) => {
  try {
    const usuarioId = req.params.id;
    const { 
      incluir_masivas = 'false',
      solo_masivas = 'false',
      limit = 20, 
      page = 1 
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let filtro = {};

    // Filtro por usuario específico
    if (usuarioId) {
      filtro.usuario_id = usuarioId;
    }

    // Configurar filtro según las opciones
    if (solo_masivas === 'true') {
      // Solo recargas masivas
      filtro.tipo = 'recarga_masiva';
    } else if (incluir_masivas === 'true') {
      // Ambas: recargas normales y masivas
      filtro.$or = [
        { tipo: 'recarga' },
        { tipo: 'recarga_masiva' }
      ];
    } else {
      // Solo recargas normales (comportamiento por defecto)
      filtro.tipo = 'recarga';
    }

    const recargas = await Transaccion.find(filtro)
      .populate('usuario_id', 'nombre email documento')
      .populate('recarga_masiva_id', 'monto_individual total_billeteras fecha_ejecucion')
      .sort({ fecha: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('monto fecha usuario_id estado descripcion tipo recarga_masiva_id es_recarga_masiva');

    const total = await Transaccion.countDocuments(filtro);

    // Estadísticas de recargas
    const estadisticas = await Transaccion.aggregate([
      { $match: filtro },
      {
        $group: {
          _id: '$tipo',
          totalMonto: { $sum: '$monto' },
          cantidad: { $sum: 1 },
          promedioMonto: { $avg: '$monto' }
        }
      }
    ]);

    res.status(200).json({
      recargas,
      paginacion: {
        pagina: parseInt(page),
        totalPaginas: Math.ceil(total / parseInt(limit)),
        totalRecargas: total,
        limite: parseInt(limit),
        hasMore: (skip + recargas.length) < total
      },
      estadisticas,
      configuracion: {
        incluyeMasivas: incluir_masivas === 'true',
        soloMasivas: solo_masivas === 'true'
      }
    });

  } catch (error) {
    console.error('Error en obtenerRecargas:', error);
    res.status(500).json({ 
      mensaje: 'Error en el servidor al obtener recargas', 
      error: error.message 
    });
  }
};

// Obtener solo las transacciones de tipo "retiro" con paginación
// Obtener solo las transacciones de tipo "retiro" con paginación
exports.obtenerRetiros = async (req, res) => {
  try {
    const usuarioId = req.params.id;
    const { 
      estado, 
      fecha_inicio, 
      fecha_fin, 
      limit = 10, // Cambiar a 10 para coincidir con frontend
      page = 0,   // Cambiar a 0 para coincidir con frontend
      skip = 0    // Agregar soporte para skip
    } = req.query;
    
    // Calcular skip basado en page o usar skip directamente
    const calculatedSkip = skip ? parseInt(skip) : (parseInt(page) * parseInt(limit));

    let filtro = { tipo: 'retiro' };
    
    if (usuarioId) {
      filtro.usuario_id = usuarioId;
    }
    
    if (estado) {
      filtro.estado = estado;
    }
    
    if (fecha_inicio && fecha_fin) {
      filtro.fecha = {
        $gte: new Date(fecha_inicio),
        $lte: new Date(fecha_fin)
      };
    } else if (fecha_inicio) {
      filtro.fecha = { $gte: new Date(fecha_inicio) };
    } else if (fecha_fin) {
      filtro.fecha = { $lte: new Date(fecha_fin) };
    }

    const retiros = await Transaccion.find(filtro)
      .populate('usuario_id', 'nombre email documento')
      .sort({ fecha: -1 })
      .skip(calculatedSkip)
      .limit(parseInt(limit))
      .select('monto fecha usuario_id estado descripcion');

    const total = await Transaccion.countDocuments(filtro);

    // Calcular si hay más resultados
    const hasMore = (calculatedSkip + retiros.length) < total;
    const currentPage = Math.floor(calculatedSkip / parseInt(limit));

    res.status(200).json({
      retiros,
      paginacion: {
        paginaActual: currentPage,
        totalPaginas: Math.ceil(total / parseInt(limit)),
        totalRetiros: total,
        limite: parseInt(limit),
        skip: calculatedSkip,
        hasMore: hasMore
      },
      totalRetirosCargados: retiros.length
    });

  } catch (error) {
    console.error('Error en obtenerRetiros:', error);
    res.status(500).json({ 
      mensaje: 'Error en el servidor al obtener retiros', 
      error: error.message 
    });
  }
};

// Obtener transacciones de recarga masiva específica
exports.obtenerTransaccionesRecargaMasiva = async (req, res) => {
  try {
    const { recargaMasivaId } = req.params;
    const { limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Verificar que la recarga masiva existe
    const recargaMasiva = await RecargaMasiva.findById(recargaMasivaId)
      .populate('ejecutado_por', 'nombre email')
      .populate('transaccion_principal_id');

    if (!recargaMasiva) {
      return res.status(404).json({ mensaje: 'Recarga masiva no encontrada' });
    }

    // Obtener transacción principal
    const transaccionPrincipal = await Transaccion.findById(recargaMasiva.transaccion_principal_id)
      .populate('usuario_id', 'nombre email');

    // Obtener transacciones individuales de esta recarga masiva
    const transaccionesIndividuales = await Transaccion.find({
      recarga_masiva_id: recargaMasivaId,
      tipo: 'recarga'
    })
    .populate('usuario_id', 'nombre email documento')
    .sort({ fecha: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const totalIndividuales = await Transaccion.countDocuments({
      recarga_masiva_id: recargaMasivaId,
      tipo: 'recarga'
    });

    res.status(200).json({
      recargaMasiva,
      transaccionPrincipal,
      transaccionesIndividuales: {
        datos: transaccionesIndividuales,
        paginacion: {
          pagina: parseInt(page),
          totalPaginas: Math.ceil(totalIndividuales / parseInt(limit)),
          totalTransacciones: totalIndividuales,
          limite: parseInt(limit),
          hasMore: (skip + transaccionesIndividuales.length) < totalIndividuales
        }
      }
    });

  } catch (error) {
    console.error('Error en obtenerTransaccionesRecargaMasiva:', error);
    res.status(500).json({ 
      mensaje: 'Error en el servidor al obtener transacciones de recarga masiva', 
      error: error.message 
    });
  }
};

// Obtener estadísticas de transacciones
exports.obtenerEstadisticas = async (req, res) => {
  try {
    const { usuarioId, fecha_inicio, fecha_fin } = req.query;
    
    let filtro = {};
    
    if (usuarioId) {
      filtro.usuario_id = usuarioId;
    }
    
    if (fecha_inicio && fecha_fin) {
      filtro.fecha = {
        $gte: new Date(fecha_inicio),
        $lte: new Date(fecha_fin)
      };
    }

    // Estadísticas por tipo de transacción
    const estadisticasPorTipo = await Transaccion.aggregate([
      { $match: filtro },
      {
        $group: {
          _id: '$tipo',
          totalMonto: { $sum: '$monto' },
          cantidad: { $sum: 1 },
          promedioMonto: { $avg: '$monto' },
          montoMaximo: { $max: '$monto' },
          montoMinimo: { $min: '$monto' }
        }
      },
      { $sort: { totalMonto: -1 } }
    ]);

    // Estadísticas por estado (especialmente para retiros)
    const estadisticasPorEstado = await Transaccion.aggregate([
      { 
        $match: { 
          ...filtro,
          tipo: 'retiro' 
        } 
      },
      {
        $group: {
          _id: '$estado',
          totalMonto: { $sum: '$monto' },
          cantidad: { $sum: 1 },
          promedioMonto: { $avg: '$monto' }
        }
      }
    ]);

    // Estadísticas mensuales
    const estadisticasMensuales = await Transaccion.aggregate([
      { $match: filtro },
      {
        $group: {
          _id: {
            year: { $year: '$fecha' },
            month: { $month: '$fecha' }
          },
          totalMonto: { $sum: '$monto' },
          cantidad: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    // Total general
    const totalGeneral = await Transaccion.aggregate([
      { $match: filtro },
      {
        $group: {
          _id: null,
          totalMontoGeneral: { $sum: '$monto' },
          totalTransacciones: { $sum: 1 },
          promedioGeneral: { $avg: '$monto' }
        }
      }
    ]);

    res.status(200).json({
      estadisticasPorTipo,
      estadisticasPorEstado,
      estadisticasMensuales,
      totalGeneral: totalGeneral[0] || {
        totalMontoGeneral: 0,
        totalTransacciones: 0,
        promedioGeneral: 0
      },
      periodo: {
        fecha_inicio: fecha_inicio || 'sin filtrar',
        fecha_fin: fecha_fin || 'sin filtrar',
        usuario: usuarioId ? 'específico' : 'todos'
      }
    });

  } catch (error) {
    console.error('Error en obtenerEstadisticas:', error);
    res.status(500).json({ 
      mensaje: 'Error en el servidor al obtener estadísticas', 
      error: error.message 
    });
  }
};

// Actualizar el estado de una transacción
exports.actualizarEstadoTransaccion = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, motivo } = req.body;

    if (!id) {
      return res.status(400).json({ mensaje: 'ID de transacción es requerido' });
    }

    if (!estado) {
      return res.status(400).json({ mensaje: 'Estado es requerido' });
    }

    const estadosValidos = ['pendiente', 'aprobado', 'rechazado'];
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ 
        mensaje: 'Estado no válido. Debe ser: pendiente, aprobado o rechazado' 
      });
    }

    const transaccionActual = await Transaccion.findById(id);
    if (!transaccionActual) {
      return res.status(404).json({ mensaje: 'Transacción no encontrada' });
    }

    if (transaccionActual.tipo !== 'retiro') {
      return res.status(400).json({ 
        mensaje: 'Solo las transacciones de retiro pueden cambiar de estado' 
      });
    }

    const actualizacion = { estado };
    if (motivo) {
      actualizacion.descripcion = `${transaccionActual.descripcion} | Actualizado: ${estado} - ${motivo}`;
    }

    const transaccionActualizada = await Transaccion.findByIdAndUpdate(
      id,
      actualizacion,
      { new: true, runValidators: true }
    ).populate('usuario_id', 'nombre email');

    // Si se rechaza un retiro, reembolsar el saldo
    if (estado === 'rechazado' && transaccionActual.estado !== 'rechazado') {
      console.log(`Reembolsar saldo por retiro rechazado: ${transaccionActual.monto} al usuario ${transaccionActual.usuario_id}`);
    }

    console.log(`Transacción ${id} actualizada a estado: ${estado}`);

    res.status(200).json({
      mensaje: `Estado de transacción actualizado a: ${estado}`,
      transaccion: transaccionActualizada
    });

  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ mensaje: 'ID de transacción no válido' });
    }
    
    console.error('Error en actualizarEstadoTransaccion:', error);
    res.status(500).json({ 
      mensaje: 'Error en el servidor al actualizar estado', 
      error: error.message 
    });
  }
};

// Eliminar una transacción por ID
exports.eliminarTransaccion = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    if (!id) {
      return res.status(400).json({ mensaje: 'ID de transacción es requerido' });
    }

    const transaccion = await Transaccion.findById(id);
    if (!transaccion) {
      return res.status(404).json({ mensaje: 'Transacción no encontrada' });
    }

    if (transaccion.tipo === 'recarga_masiva') {
      return res.status(400).json({ 
        mensaje: 'No se puede eliminar una transacción de recarga masiva' 
      });
    }

    if (transaccion.estado === 'aprobado') {
      return res.status(400).json({ 
        mensaje: 'No se puede eliminar una transacción aprobada' 
      });
    }

    const transaccionEliminada = await Transaccion.findByIdAndDelete(id);

    console.log(`Transacción eliminada: ${id}, Tipo: ${transaccion.tipo}, Monto: ${transaccion.monto}, Motivo: ${motivo || 'No especificado'}`);

    res.status(200).json({ 
      mensaje: 'Transacción eliminada correctamente',
      transaccion: transaccionEliminada,
      registro: {
        eliminado_el: new Date(),
        motivo: motivo || 'Administrativo'
      }
    });

  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ mensaje: 'ID de transacción no válido' });
    }
    
    console.error('Error en eliminarTransaccion:', error);
    res.status(500).json({ 
      mensaje: 'Error en el servidor al eliminar transacción', 
      error: error.message 
    });
  }
};

// Obtener retiros con filtros avanzados
exports.obtenerRetirosUsuarios = async (req, res) => {
  try {
    const usuarioId = req.params.id;
    const { 
      estado, 
      fecha_inicio, 
      fecha_fin, 
      limit = 20, 
      page = 1,
      monto_min,
      monto_max
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let filtro = { tipo: 'retiro' };
    
    if (usuarioId) {
      filtro.usuario_id = usuarioId;
    }
    
    if (estado) {
      filtro.estado = estado;
    }
    
    if (fecha_inicio && fecha_fin) {
      filtro.fecha = {
        $gte: new Date(fecha_inicio),
        $lte: new Date(fecha_fin)
      };
    } else if (fecha_inicio) {
      filtro.fecha = { $gte: new Date(fecha_inicio) };
    } else if (fecha_fin) {
      filtro.fecha = { $lte: new Date(fecha_fin) };
    }
    
    // Filtro por rango de monto
    if (monto_min || monto_max) {
      filtro.monto = {};
      if (monto_min) filtro.monto.$gte = parseFloat(monto_min);
      if (monto_max) filtro.monto.$lte = parseFloat(monto_max);
    }
    
    const retiros = await Transaccion.find(filtro)
      .populate('usuario_id', 'nombre email documento telefono')
      .sort({ fecha: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .select('monto fecha usuario_id estado descripcion');
    
    const total = await Transaccion.countDocuments(filtro);

    // Estadísticas de los retiros filtrados
    const estadisticas = await Transaccion.aggregate([
      { $match: filtro },
      {
        $group: {
          _id: '$estado',
          totalMonto: { $sum: '$monto' },
          cantidad: { $sum: 1 },
          promedioMonto: { $avg: '$monto' },
          montoMaximo: { $max: '$monto' },
          montoMinimo: { $min: '$monto' }
        }
      }
    ]);

    res.status(200).json({
      retiros,
      paginacion: {
        pagina: parseInt(page),
        totalPaginas: Math.ceil(total / parseInt(limit)),
        totalRetiros: total,
        limite: parseInt(limit),
        hasMore: (skip + retiros.length) < total
      },
      estadisticas,
      filtrosAplicados: {
        usuario: usuarioId ? 'específico' : 'todos',
        estado: estado || 'todos',
        rangoFechas: (fecha_inicio || fecha_fin) ? true : false,
        rangoMonto: (monto_min || monto_max) ? true : false
      }
    });

  } catch (error) {
    console.error('Error en obtenerRetirosUsuarios:', error);
    res.status(500).json({ 
      mensaje: 'Error en el servidor al obtener retiros', 
      error: error.message 
    });
  }
};

// Buscar transacciones por texto (descripción, ID, etc.)
exports.buscarTransacciones = async (req, res) => {
  try {
    const { q, tipo, limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    if (!q) {
      return res.status(400).json({ mensaje: 'Término de búsqueda requerido' });
    }

    let filtro = {
      $or: [
        { descripcion: { $regex: q, $options: 'i' } },
        { _id: q } // Buscar por ID exacto
      ]
    };

    // Si el término de búsqueda parece un monto, buscar por monto
    if (!isNaN(q)) {
      const monto = parseFloat(q);
      filtro.$or.push({ monto: monto });
    }

    // Filtrar por tipo si se especifica
    if (tipo) {
      filtro.tipo = tipo;
    }

    const transacciones = await Transaccion.find(filtro)
      .populate('usuario_id', 'nombre email documento')
      .populate('recarga_masiva_id', 'monto_individual total_billeteras')
      .sort({ fecha: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Transaccion.countDocuments(filtro);

    res.status(200).json({
      transacciones,
      paginacion: {
        pagina: parseInt(page),
        totalPaginas: Math.ceil(total / parseInt(limit)),
        totalResultados: total,
        limite: parseInt(limit),
        hasMore: (skip + transacciones.length) < total
      },
      busqueda: {
        termino: q,
        tipo: tipo || 'todos'
      }
    });

  } catch (error) {
    console.error('Error en buscarTransacciones:', error);
    res.status(500).json({ 
      mensaje: 'Error en el servidor al buscar transacciones', 
      error: error.message 
    });
  }
};

// Obtener billeteras que les faltan transacciones por fecha y tipo
exports.obtenerBilleterasFaltantesTransacciones = async (req, res) => {
  try {
    const { 
      fecha, 
      tipo_transaccion, 
      incluir_inactivas = 'false',
      limit = 100,
      page = 1
    } = req.query;

    if (!fecha) {
      return res.status(400).json({ mensaje: 'La fecha es requerida' });
    }

    if (!tipo_transaccion) {
      return res.status(400).json({ mensaje: 'El tipo de transacción es requerido' });
    }

    const fechaInicio = new Date(fecha);
    const fechaFin = new Date(fecha);
    fechaFin.setDate(fechaFin.getDate() + 1);

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Pipeline de agregación optimizado
    const pipeline = [
      // 1. Unir billeteras con usuarios
      {
        $lookup: {
          from: 'usuarios',
          localField: 'usuario_id',
          foreignField: '_id',
          as: 'usuario_info'
        }
      },
      { $unwind: '$usuario_info' },
      
      // 2. Filtrar por estado activo si es necesario
      ...(incluir_inactivas !== 'true' ? [{ $match: { activa: true } }] : []),
      
      // 3. Buscar transacciones existentes para este día y tipo
      {
        $lookup: {
          from: 'transaccions',
          let: { usuarioId: '$usuario_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$usuario_id', '$$usuarioId'] },
                tipo: tipo_transaccion,
                fecha: { $gte: fechaInicio, $lt: fechaFin }
              }
            }
          ],
          as: 'transacciones_existentes'
        }
      },
      
      // 4. Filtrar solo billeteras SIN transacciones ese día
      {
        $match: {
          'transacciones_existentes': { $size: 0 }
        }
      },
      
      // 5. Proyectar campos necesarios
      {
        $project: {
          _id: 1,
          usuario_id: 1,
          saldo: 1,
          activa: 1,
          usuario: {
            nombre: '$usuario_info.nombre',
            email: '$usuario_info.email',
            documento: '$usuario_info.documento',
            telefono: '$usuario_info.telefono'
          }
        }
      },
      
      // 6. Paginación
      { $skip: skip },
      { $limit: parseInt(limit) }
    ];

    // Pipeline para contar total
    const countPipeline = [
      {
        $lookup: {
          from: 'transaccions',
          let: { usuarioId: '$usuario_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$usuario_id', '$$usuarioId'] },
                tipo: tipo_transaccion,
                fecha: { $gte: fechaInicio, $lt: fechaFin }
              }
            }
          ],
          as: 'transacciones_existentes'
        }
      },
      {
        $match: {
          'transacciones_existentes': { $size: 0 }
        }
      },
      { $count: 'total' }
    ];

    const [billeterasFaltantes, totalResult, estadisticasTransacciones] = await Promise.all([
      Billetera.aggregate(pipeline),
      Billetera.aggregate(countPipeline),
      Transaccion.aggregate([
        {
          $match: {
            tipo: tipo_transaccion,
            fecha: { $gte: fechaInicio, $lt: fechaFin }
          }
        },
        {
          $group: {
            _id: null,
            totalMonto: { $sum: '$monto' },
            promedioMonto: { $avg: '$monto' },
            cantidad: { $sum: 1 },
            montoMaximo: { $max: '$monto' },
            montoMinimo: { $min: '$monto' }
          }
        }
      ])
    ]);

    const total = totalResult[0] ? totalResult[0].total : 0;
    const totalBilleteras = await Billetera.countDocuments(
      incluir_inactivas !== 'true' ? { activa: true } : {}
    );

    res.status(200).json({
      billeterasFaltantes,
      estadisticas: {
        fecha_consultada: fecha,
        tipo_transaccion: tipo_transaccion,
        total_billeteras: totalBilleteras,
        billeteras_con_transaccion: totalBilleteras - total,
        billeteras_sin_transaccion: total,
        porcentaje_cobertura: totalBilleteras > 0 ? 
          (((totalBilleteras - total) / totalBilleteras) * 100).toFixed(2) + '%' : '0%',
        transacciones_del_dia: estadisticasTransacciones[0] || {
          totalMonto: 0,
          promedioMonto: 0,
          cantidad: 0,
          montoMaximo: 0,
          montoMinimo: 0
        }
      },
      paginacion: {
        pagina: parseInt(page),
        totalPaginas: Math.ceil(total / parseInt(limit)),
        totalBilleterasFaltantes: total,
        limite: parseInt(limit),
        hasMore: (skip + billeterasFaltantes.length) < total
      },
      filtros: {
        fecha: fecha,
        tipo_transaccion: tipo_transaccion,
        incluir_inactivas: incluir_inactivas === 'true',
        limite: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error en obtenerBilleterasFaltantesTransacciones:', error);
    res.status(500).json({ 
      mensaje: 'Error en el servidor al obtener billeteras faltantes', 
      error: error.message 
    });
  }
};