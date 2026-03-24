const ReferralRequest = require('../models/referralRequest');
const Usuario = require('../models/usuario');
const Billetera = require('../models/billetera');
const Transaccion = require('../models/transaccion');

// Crear solicitud de referido
exports.crearSolicitud = async (req, res) => {
  try {
    const { solicitante_id, referido_id } = req.body;

    console.log('📝 Creando solicitud de referido:', { solicitante_id, referido_id });

    // Validación 1: No puedes referirte a ti mismo
    if (solicitante_id === referido_id) {
      return res.status(400).json({ message: 'No puedes referirte a ti mismo.' });
    }

    // Validación 2: Verifica que ambos usuarios existan
    const solicitante = await Usuario.findById(solicitante_id);
    const referido = await Usuario.findById(referido_id);

    if (!solicitante) {
      return res.status(404).json({ message: 'Usuario solicitante no encontrado.' });
    }

    if (!referido) {
      return res.status(404).json({ message: 'Usuario referido (patrocinador) no encontrado.' });
    }

    // Validación 3: Verificar que el referido (patrocinador) tenga billetera activa
    const billeteraReferido = await Billetera.findOne({ usuario_id: referido_id });
    if (!billeteraReferido || !billeteraReferido.activa) {
      return res.status(400).json({ message: 'El patrocinador no tiene billetera activa para recibir comisiones.' });
    }

    // Validación 4: Un usuario solo puede tener UN patrocinador (solicitud aceptada)
    const existingAcceptedRequest = await ReferralRequest.findOne({
      solicitante_id: solicitante_id,
      estado: 'aceptado'
    });

    if (existingAcceptedRequest) {
      return res.status(400).json({ message: 'Este usuario ya tiene un patrocinador activo.' });
    }

    // Validación 5: Un usuario no puede tener múltiples solicitudes pendientes como solicitante
    const existingPendingRequest = await ReferralRequest.findOne({
      solicitante_id: solicitante_id,
      estado: 'pendiente'
    });

    if (existingPendingRequest) {
      return res.status(400).json({ message: 'Ya tienes una solicitud de patrocinio pendiente.' });
    }

    // Validación 6: Prevenir referencias circulares
    let currentPatrocinadorId = referido_id;
    const visited = new Set();
    
    while (currentPatrocinadorId) {
      if (visited.has(currentPatrocinadorId.toString())) {
        break;
      }
      visited.add(currentPatrocinadorId.toString());
      
      if (currentPatrocinadorId.toString() === solicitante_id.toString()) {
        return res.status(400).json({ message: 'No puedes referir a tu propio patrocinador (referencia circular detectada).' });
      }
      
      const patrocinadorRequest = await ReferralRequest.findOne({ 
        solicitante_id: currentPatrocinadorId, 
        estado: 'aceptado' 
      });
      
      currentPatrocinadorId = patrocinadorRequest ? patrocinadorRequest.referido_id : null;
    }

    // Crear la solicitud
    const solicitud = await ReferralRequest.create({ 
      solicitante_id,  // Quien busca patrocinio (nuevo usuario)
      referido_id,     // Quien será el patrocinador (usuario existente)
      estado: 'pendiente'
    });

    console.log('✅ Solicitud creada exitosamente:', solicitud._id);
    
    res.status(201).json({ 
      message: 'Solicitud de patrocinio creada con éxito.', 
      solicitud 
    });
  } catch (error) {
    console.error('❌ Error al crear solicitud:', error);
    res.status(500).json({ 
      message: 'Error al crear la solicitud de patrocinio.', 
      error: error.message 
    });
  }
};

// Listar solicitudes recibidas (donde el usuario es el patrocinador)
exports.listarSolicitudesRecibidas = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, estado = 'pendiente' } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // SOLICITUDES RECIBIDAS: donde el usuario actual es el REFERIDO (patrocinador)
    let filtro = { referido_id: id };
    
    if (estado !== 'todos') {
      filtro.estado = estado;
    }
    
    const solicitudes = await ReferralRequest.find(filtro)
      .populate('solicitante_id', 'nombre_usuario nombre_completo nivel dni correo_electronico fecha_creacion')
      .sort({ fecha: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await ReferralRequest.countDocuments(filtro);
    
    res.json({
      solicitudes,
      paginacion: {
        paginaActual: parseInt(page),
        totalPaginas: Math.ceil(total / parseInt(limit)),
        totalSolicitudes: total,
        limite: parseInt(limit),
        hasMore: (skip + solicitudes.length) < total
      }
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error al obtener las solicitudes recibidas.', 
      error: error.message 
    });
  }
};

// Listar solicitudes enviadas (donde el usuario busca patrocinio)
exports.listarSolicitudesEnviadas = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, estado = 'pendiente' } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // SOLICITUDES ENVIADAS: donde el usuario actual es el SOLICITANTE  
    let filtro = { solicitante_id: id };
    
    if (estado !== 'todos') {
      filtro.estado = estado;
    }
    
    const solicitudes = await ReferralRequest.find(filtro)
      .populate('referido_id', 'nombre_usuario nombre_completo nivel dni correo_electronico')
      .sort({ fecha: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await ReferralRequest.countDocuments(filtro);
    
    res.json({
      solicitudes,
      paginacion: {
        paginaActual: parseInt(page),
        totalPaginas: Math.ceil(total / parseInt(limit)),
        totalSolicitudes: total,
        limite: parseInt(limit),
        hasMore: (skip + solicitudes.length) < total
      }
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error al obtener las solicitudes enviadas.', 
      error: error.message 
    });
  }
};

// Aceptar múltiples solicitudes a la vez (CORREGIDO)
exports.aceptarMultiplesSolicitudes = async (req, res) => {
  try {
    const { solicitudesIds } = req.body;

    if (!solicitudesIds || !Array.isArray(solicitudesIds) || solicitudesIds.length === 0) {
      return res.status(400).json({ 
        message: 'Se requiere un array de IDs de solicitudes.' 
      });
    }

    const resultados = {
      exitos: 0,
      errores: 0,
      detalles: []
    };

    // Procesar cada solicitud
    for (const solicitudId of solicitudesIds) {
      try {
        const solicitud = await ReferralRequest.findById(solicitudId)
          .populate('solicitante_id', 'nombre_usuario nivel')
          .populate('referido_id', 'nombre_usuario nivel');

        if (!solicitud) {
          resultados.errores++;
          resultados.detalles.push({
            solicitudId,
            estado: 'error',
            mensaje: 'Solicitud no encontrada'
          });
          continue;
        }

        if (solicitud.estado !== 'pendiente') {
          resultados.errores++;
          resultados.detalles.push({
            solicitudId,
            estado: 'error',
            mensaje: `La solicitud ya fue ${solicitud.estado}`
          });
          continue;
        }

        // Verificar que el patrocinador aún tiene billetera activa
        const billeteraPatrocinador = await Billetera.findOne({ 
          usuario_id: solicitud.referido_id._id 
        });

        if (!billeteraPatrocinador || !billeteraPatrocinador.activa) {
          resultados.errores++;
          resultados.detalles.push({
            solicitudId,
            estado: 'error',
            mensaje: 'Billetera del patrocinador no activa'
          });
          continue;
        }

        // Calcular monto de comisión según el nivel del solicitante
        const montoComision = solicitud.solicitante_id.nivel >= 1792 ? 7000 : 1400;

        // Pagar comisión al patrocinador
        billeteraPatrocinador.saldo += montoComision;
        await billeteraPatrocinador.save();

        // CORRECCIÓN: Usar tipo 'recarga' que seguro existe
        const transaccionComision = new Transaccion({
          usuario_id: solicitud.referido_id._id,
          tipo: 'recarga', // ← TIPO CORREGIDO
          monto: montoComision,
          descripcion: `Comisión por referido directo - Usuario: ${solicitud.solicitante_id.nombre_usuario}`,
          estado: 'aprobado',
          referencia_solicitud_id: solicitud._id
        });
        await transaccionComision.save();

        // Actualizar estado de la solicitud
        solicitud.estado = 'aceptado';
        solicitud.fecha_respuesta = new Date();
        await solicitud.save();

        resultados.exitos++;
        resultados.detalles.push({
          solicitudId,
          estado: 'aceptado',
          mensaje: `Comisión de ${montoComision} pagada`,
          usuario: solicitud.solicitante_id.nombre_usuario
        });

        console.log(`✅ Solicitud ${solicitudId} aceptada - Comisión: ${montoComision}`);

      } catch (error) {
        resultados.errores++;
        resultados.detalles.push({
          solicitudId,
          estado: 'error',
          mensaje: error.message
        });
        console.error(`❌ Error procesando solicitud ${solicitudId}:`, error);
      }
    }

    res.json({
      message: `Procesamiento completado: ${resultados.exitos} aceptadas, ${resultados.errores} errores`,
      resultados
    });

  } catch (error) {
    console.error('Error en aceptarMultiplesSolicitudes:', error);
    res.status(500).json({ 
      message: 'Error al procesar las solicitudes.', 
      error: error.message 
    });
  }
};

// Cambiar estado de la solicitud individual (CORREGIDO)
exports.cambiarEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!['aceptado', 'rechazado'].includes(estado)) {
      return res.status(400).json({ 
        message: 'Estado inválido. Use \'aceptado\' o \'rechazado\'.' 
      });
    }

    const solicitud = await ReferralRequest.findById(id)
      .populate('solicitante_id', 'nombre_usuario nivel')
      .populate('referido_id', 'nombre_usuario nivel');

    if (!solicitud) {
      return res.status(404).json({ message: 'Solicitud no encontrada.' });
    }

    if (solicitud.estado !== 'pendiente') {
      return res.status(400).json({ 
        message: `Esta solicitud ya fue ${solicitud.estado}. No se puede modificar.` 
      });
    }

    // Si se acepta la solicitud, procesar el pago de comisión
    if (estado === 'aceptado') {
      // Verificar que el patrocinador aún tiene billetera activa
      const billeteraPatrocinador = await Billetera.findOne({ 
        usuario_id: solicitud.referido_id._id 
      });

      if (!billeteraPatrocinador || !billeteraPatrocinador.activa) {
        return res.status(400).json({ 
          message: 'No se puede aceptar la solicitud. La billetera del patrocinador no está activa.' 
        });
      }

      // Calcular monto de comisión según el nivel del solicitante
      const montoComision = solicitud.solicitante_id.nivel >= 1792 ? 7000 : 500;

      // Pagar comisión al patrocinador
      billeteraPatrocinador.saldo += montoComision;
      await billeteraPatrocinador.save();

      // CORRECCIÓN: Usar tipo 'recarga' que seguro existe
      const transaccionComision = new Transaccion({
        usuario_id: solicitud.referido_id._id,
        tipo: 'recarga', // ← TIPO CORREGIDO
        monto: montoComision,
        descripcion: `Comisión por referido directo - Usuario: ${solicitud.solicitante_id.nombre_usuario}`,
        estado: 'aprobado',
        referencia_solicitud_id: solicitud._id
      });
      await transaccionComision.save();

      console.log(`✅ Comisión de ${montoComision} pagada al patrocinador ${solicitud.referido_id.nombre_usuario}`);
    }

    // Actualizar estado de la solicitud
    solicitud.estado = estado;
    solicitud.fecha_respuesta = new Date();
    await solicitud.save();

    res.json({ 
      message: `Solicitud ${estado} con éxito.${estado === 'aceptado' ? ' Comisión pagada al patrocinador.' : ''}`, 
      solicitud 
    });

  } catch (error) {
    console.error('Error en cambiarEstado:', error);
    res.status(500).json({ 
      message: 'Error al actualizar el estado de la solicitud.', 
      error: error.message 
    });
  }
};

// Obtener patrocinador activo de un usuario
exports.obtenerPatrocinador = async (req, res) => {
  try {
    const { usuarioId } = req.params;

    const solicitudAceptada = await ReferralRequest.findOne({
      solicitante_id: usuarioId,
      estado: 'aceptado'
    }).populate('referido_id', 'nombre_usuario nombre_completo nivel dni');

    if (!solicitudAceptada) {
      return res.status(404).json({ 
        message: 'No se encontró patrocinador activo para este usuario.' 
      });
    }

    res.json({
      patrocinador: solicitudAceptada.referido_id,
      fecha_aceptacion: solicitudAceptada.fecha_respuesta
    });

  } catch (error) {
    res.status(500).json({ 
      message: 'Error al obtener el patrocinador.', 
      error: error.message 
    });
  }
};

// Obtener referidos directos de un usuario (personas que él patrocina)
exports.obtenerReferidosDirectos = async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const referidos = await ReferralRequest.find({
      referido_id: usuarioId,
      estado: 'aceptado'
    })
    .populate('solicitante_id', 'nombre_usuario nombre_completo nivel dni fecha_creacion')
    .sort({ fecha_respuesta: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const total = await ReferralRequest.countDocuments({
      referido_id: usuarioId,
      estado: 'aceptado'
    });

    res.json({
      total_referidos: total,
      referidos: referidos.map(ref => ({
        usuario: ref.solicitante_id,
        fecha_aceptacion: ref.fecha_respuesta
      })),
      paginacion: {
        paginaActual: parseInt(page),
        totalPaginas: Math.ceil(total / parseInt(limit)),
        limite: parseInt(limit),
        hasMore: (skip + referidos.length) < total
      }
    });

  } catch (error) {
    res.status(500).json({ 
      message: 'Error al obtener los referidos directos.', 
      error: error.message 
    });
  }
};

// Listar todas las solicitudes
exports.listarTodasLasSolicitudes = async (req, res) => {
  try {
    const { estado, limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let filtro = {};
    if (estado && estado !== 'todos') {
      filtro.estado = estado;
    }

    const solicitudes = await ReferralRequest.find(filtro)
      .populate('solicitante_id', 'nombre_usuario nombre_completo nivel dni')
      .populate('referido_id', 'nombre_usuario nombre_completo nivel dni')
      .sort({ fecha: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ReferralRequest.countDocuments(filtro);

    res.json({
      solicitudes,
      paginacion: {
        pagina: parseInt(page),
        totalPaginas: Math.ceil(total / parseInt(limit)),
        totalSolicitudes: total,
        limite: parseInt(limit),
        hasMore: (skip + solicitudes.length) < total
      }
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error al obtener todas las solicitudes', 
      error: error.message 
    });
  }
};