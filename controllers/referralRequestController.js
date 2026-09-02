const mongoose = require('mongoose');
const ReferralRequest = require('../models/referralRequest');
const Usuario = require('../models/usuario');
const Billetera = require('../models/billetera');
const Transaccion = require('../models/transaccion');
const { 
  verificarUsuarioAporte, 
  detectarCicloReferencia,
  procesarComisionReferido, 
  recorrerYLiquidarComisionesPendientes,
  MONTO_COMISION_DEFAULT 
} = require('../utils/comisionesReferidos');

/**
 * ARQUITECTURA DE ROLES EN REFERRALREQUEST:
 * - solicitante_id = PATROCINADOR (quien invita y recibe la comisión de $1,400 COP).
 * - referido_id = REFERIDO (el nuevo socio invitado).
 */

// Crear solicitud de referido con validación exhaustiva anti-ciclos y duplicados
exports.crearSolicitud = async (req, res) => {
  try {
    const { solicitante_id, referido_id } = req.body;

    console.log('📝 Creando solicitud de referido:', { solicitante_id, referido_id });

    // 1. Validación de formato de IDs
    if (!solicitante_id || !referido_id) {
      return res.status(400).json({ message: 'Se requieren el ID del patrocinador y el ID del referido.' });
    }

    if (!mongoose.Types.ObjectId.isValid(solicitante_id) || !mongoose.Types.ObjectId.isValid(referido_id)) {
      return res.status(400).json({ message: 'Uno o ambos IDs de usuario no tienen un formato válido.' });
    }

    // 2. Validación de auto-referido
    if (solicitante_id.toString() === referido_id.toString()) {
      return res.status(400).json({ message: 'No puedes referirte a ti mismo.' });
    }

    // 3. Verifica que ambos usuarios existan en la base de datos
    const [patrocinador, referido] = await Promise.all([
      Usuario.findById(solicitante_id).select('_id nombre_usuario nombre_completo'),
      Usuario.findById(referido_id).select('_id nombre_usuario nombre_completo')
    ]);

    if (!patrocinador) {
      return res.status(404).json({ message: 'El usuario patrocinador no existe en el sistema.' });
    }

    if (!referido) {
      return res.status(404).json({ message: 'El usuario referido no existe en el sistema.' });
    }

    // 4. Validación de ciclos de referencia (anti-bucles y ancestros)
    const validacionCiclo = await detectarCicloReferencia(solicitante_id, referido_id);
    if (validacionCiclo.esCiclo) {
      return res.status(400).json({ message: validacionCiclo.mensaje || 'Referencia circular no permitida.' });
    }

    // 5. Validación de patrocinador único activo para el referido
    const existingAcceptedRequest = await ReferralRequest.findOne({
      referido_id: referido_id,
      estado: 'aceptado'
    }).populate('solicitante_id', 'nombre_usuario');

    if (existingAcceptedRequest) {
      const nomPatr = existingAcceptedRequest.solicitante_id?.nombre_usuario || 'otro socio';
      return res.status(400).json({ 
        message: `El socio @${referido.nombre_usuario} ya cuenta con un patrocinador activo (@${nomPatr}).` 
      });
    }

    // 6. Evitar solicitudes pendientes duplicadas
    const existingPendingRequest = await ReferralRequest.findOne({
      solicitante_id: solicitante_id,
      referido_id: referido_id,
      estado: 'pendiente'
    });

    if (existingPendingRequest) {
      return res.status(400).json({ message: 'Ya existe una solicitud pendiente de confirmación entre estos socios.' });
    }

    // 7. Crear la solicitud en estado pendiente
    const solicitud = await ReferralRequest.create({ 
      solicitante_id,  // Patrocinador (dueño de la red)
      referido_id,     // Referido (socio invitado)
      estado: 'pendiente',
      comision_pagada: false,
      monto_comision: MONTO_COMISION_DEFAULT,
      estado_comision: 'pendiente_verificacion',
      motivo_pendiente: 'Solicitud pendiente de confirmación'
    });

    console.log('✅ Solicitud de patrocinio creada exitosamente:', solicitud._id);
    
    res.status(201).json({ 
      message: 'Solicitud de referido creada con éxito.', 
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

// Listar solicitudes recibidas / pendientes para el patrocinador
exports.listarSolicitudesRecibidas = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, estado = 'pendiente' } = req.query;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID de usuario inválido.' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let filtro = { solicitante_id: id };
    
    if (estado !== 'todos') {
      filtro.estado = estado;
    }
    
    const solicitudes = await ReferralRequest.find(filtro)
      .populate('referido_id', 'nombre_usuario nombre_completo nivel dni correo_electronico linea_whatsapp linea_llamadas fecha_creacion')
      .sort({ fecha: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await ReferralRequest.countDocuments(filtro);

    // Enriquecer con el estado de verificación del referido
    const solicitudesEnriquecidas = await Promise.all(solicitudes.map(async (sol) => {
      const solObj = sol.toObject();
      const referidoId = sol.referido_id?._id || sol.referido_id;
      solObj.referido_verificado = await verificarUsuarioAporte(referidoId);
      return solObj;
    }));
    
    res.json({
      solicitudes: solicitudesEnriquecidas,
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

// Listar solicitudes enviadas (donde el usuario es el referido invitado)
exports.listarSolicitudesEnviadas = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, estado = 'pendiente' } = req.query;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID de usuario inválido.' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let filtro = { referido_id: id };
    
    if (estado !== 'todos') {
      filtro.estado = estado;
    }
    
    const solicitudes = await ReferralRequest.find(filtro)
      .populate('solicitante_id', 'nombre_usuario nombre_completo nivel dni correo_electronico linea_whatsapp linea_llamadas')
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

// Aceptar múltiples solicitudes a la vez con validación anti-ciclos
exports.aceptarMultiplesSolicitudes = async (req, res) => {
  try {
    const { solicitudesIds } = req.body;

    if (!solicitudesIds || !Array.isArray(solicitudesIds) || solicitudesIds.length === 0) {
      return res.status(400).json({ 
        message: 'Se requiere un array de IDs de solicitudes válido.' 
      });
    }

    // Limitar tamaño de lote a máximo 50
    const loteIds = solicitudesIds.slice(0, 50);

    const resultados = {
      exitos: 0,
      errores: 0,
      comisionesLiquidadas: 0,
      detalles: []
    };

    for (const solicitudId of loteIds) {
      try {
        if (!mongoose.Types.ObjectId.isValid(solicitudId)) {
          resultados.errores++;
          resultados.detalles.push({ solicitudId, estado: 'error', mensaje: 'ID de solicitud inválido' });
          continue;
        }

        const solicitud = await ReferralRequest.findById(solicitudId);

        if (!solicitud) {
          resultados.errores++;
          resultados.detalles.push({ solicitudId, estado: 'error', mensaje: 'Solicitud no encontrada' });
          continue;
        }

        if (solicitud.estado !== 'pendiente') {
          resultados.errores++;
          resultados.detalles.push({ solicitudId, estado: 'error', mensaje: `La solicitud ya fue ${solicitud.estado}` });
          continue;
        }

        // Validación anti-ciclo antes de aceptar
        const ciclo = await detectarCicloReferencia(solicitud.solicitante_id, solicitud.referido_id);
        if (ciclo.esCiclo) {
          resultados.errores++;
          resultados.detalles.push({ solicitudId, estado: 'error', mensaje: ciclo.mensaje });
          continue;
        }

        solicitud.estado = 'aceptado';
        solicitud.fecha_respuesta = new Date();
        await solicitud.save();

        // Procesar comisión evaluando verificación mutua
        const resComision = await procesarComisionReferido(solicitud._id);
        if (resComision.pagada) {
          resultados.comisionesLiquidadas++;
        }

        resultados.exitos++;
        resultados.detalles.push({
          solicitudId,
          estado: 'aceptado',
          comision_pagada: resComision.pagada,
          mensaje_comision: resComision.pagada ? `COP $${resComision.monto} pagados` : resComision.motivo
        });

      } catch (error) {
        resultados.errores++;
        resultados.detalles.push({ solicitudId, estado: 'error', mensaje: error.message });
      }
    }

    res.json({
      message: `Procesamiento completado: ${resultados.exitos} aceptadas (${resultados.comisionesLiquidadas} con comisión pagada inmediatamente), ${resultados.errores} errores.`,
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

// Cambiar estado de la solicitud individual con validación de ciclos
exports.cambiarEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID de solicitud inválido.' });
    }

    if (!['aceptado', 'rechazado'].includes(estado)) {
      return res.status(400).json({ 
        message: 'Estado inválido. Use \'aceptado\' o \'rechazado\'.' 
      });
    }

    const solicitud = await ReferralRequest.findById(id);

    if (!solicitud) {
      return res.status(404).json({ message: 'Solicitud no encontrada.' });
    }

    if (solicitud.estado !== 'pendiente') {
      return res.status(400).json({ 
        message: `Esta solicitud ya fue ${solicitud.estado}. No se puede modificar.` 
      });
    }

    if (estado === 'aceptado') {
      // Validación anti-ciclo en el momento de aceptar
      const validacionCiclo = await detectarCicloReferencia(solicitud.solicitante_id, solicitud.referido_id);
      if (validacionCiclo.esCiclo) {
        return res.status(400).json({ message: validacionCiclo.mensaje || 'Conflicto de referencia circular detectado.' });
      }
    }

    solicitud.estado = estado;
    solicitud.fecha_respuesta = new Date();
    await solicitud.save();

    let comisionInfo = null;
    if (estado === 'aceptado') {
      // Procesar comisión evaluando verificación mutua
      comisionInfo = await procesarComisionReferido(solicitud._id);
    } else {
      solicitud.estado_comision = 'no_aplica';
      solicitud.motivo_pendiente = 'Solicitud rechazada';
      await solicitud.save();
    }

    res.json({ 
      message: estado === 'aceptado' 
        ? (comisionInfo?.pagada 
            ? `Solicitud aceptada y comisión de COP $${comisionInfo.monto} liquidada al instante a tu billetera.` 
            : `Solicitud aceptada. ${comisionInfo?.motivo || 'Comisión pendiente de verificación mutua.'}`)
        : 'Solicitud rechazada.', 
      solicitud,
      comision: comisionInfo
    });

  } catch (error) {
    console.error('Error en cambiarEstado:', error);
    res.status(500).json({ 
      message: 'Error al actualizar el estado de la solicitud.', 
      error: error.message 
    });
  }
};

// Obtener patrocinador activo de un usuario (referido_id -> solicitante_id)
exports.obtenerPatrocinador = async (req, res) => {
  try {
    const { usuarioId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
      return res.status(400).json({ message: 'ID de usuario inválido.' });
    }

    const solicitudAceptada = await ReferralRequest.findOne({
      referido_id: usuarioId,
      estado: 'aceptado'
    }).populate('solicitante_id', 'nombre_usuario nombre_completo nivel dni correo_electronico linea_whatsapp linea_llamadas');

    if (!solicitudAceptada) {
      return res.status(404).json({ 
        message: 'No se encontró patrocinador activo para este usuario.' 
      });
    }

    res.json({
      patrocinador: solicitudAceptada.solicitante_id,
      fecha_aceptacion: solicitudAceptada.fecha_respuesta
    });

  } catch (error) {
    res.status(500).json({ 
      message: 'Error al obtener el patrocinador.', 
      error: error.message 
    });
  }
};

// Obtener referidos directos de un patrocinador (solicitante_id == usuarioId)
exports.obtenerReferidosDirectos = async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
      return res.status(400).json({ message: 'ID de usuario inválido.' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // 1. Verificar si el patrocinador está verificado
    const patrocinadorVerificado = await verificarUsuarioAporte(usuarioId);

    // 2. Traer solicitudes de referidos aceptadas donde este usuario es el patrocinador (solicitante_id)
    const referidosRequests = await ReferralRequest.find({
      solicitante_id: usuarioId,
      estado: 'aceptado'
    })
    .populate('referido_id', 'nombre_usuario nombre_completo nivel dni correo_electronico linea_whatsapp linea_llamadas fecha_creacion')
    .sort({ fecha_respuesta: -1, fecha: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const total = await ReferralRequest.countDocuments({
      solicitante_id: usuarioId,
      estado: 'aceptado'
    });

    // 3. Enriquecer cada referido con su estado de aporte y liquidación
    const referidosEnriquecidos = await Promise.all(referidosRequests.map(async (ref) => {
      const referidoUser = ref.referido_id || {};
      const referidoVerificado = referidoUser._id ? await verificarUsuarioAporte(referidoUser._id) : false;

      // Si ambos están verificados pero por alguna razón no se había liquidado la comisión, liquidarla ahora
      if (!ref.comision_pagada && referidoVerificado && patrocinadorVerificado) {
        await procesarComisionReferido(ref._id);
        ref.comision_pagada = true;
        ref.estado_comision = 'pagada';
      }

      return {
        _id: ref._id,
        usuario: referidoUser,
        fecha_aceptacion: ref.fecha_respuesta || ref.fecha,
        referido_verificado: referidoVerificado,
        patrocinador_verificado: patrocinadorVerificado,
        comision_pagada: ref.comision_pagada,
        monto_comision: ref.monto_comision || MONTO_COMISION_DEFAULT,
        fecha_pago_comision: ref.fecha_pago_comision,
        estado_comision: ref.estado_comision,
        motivo_pendiente: ref.motivo_pendiente
      };
    }));

    res.json({
      total_referidos: total,
      patrocinador_verificado: patrocinadorVerificado,
      referidos: referidosEnriquecidos,
      paginacion: {
        paginaActual: parseInt(page),
        totalPaginas: Math.ceil(total / parseInt(limit)),
        limite: parseInt(limit),
        hasMore: (skip + referidosRequests.length) < total
      }
    });

  } catch (error) {
    console.error('Error al obtener referidos directos:', error);
    res.status(500).json({ 
      message: 'Error al obtener los referidos directos.', 
      error: error.message 
    });
  }
};

// Resumen de comisiones y métricas de referidos para el patrocinador
exports.obtenerResumenComisiones = async (req, res) => {
  try {
    const { usuarioId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
      return res.status(400).json({ message: 'ID de usuario inválido.' });
    }

    const [patrocinadorVerificado, referidosRequests] = await Promise.all([
      verificarUsuarioAporte(usuarioId),
      ReferralRequest.find({
        solicitante_id: usuarioId,
        estado: 'aceptado'
      }).select('comision_pagada monto_comision referido_id')
    ]);

    let comisionesPagadasTotal = 0;
    let comisionesPendientesTotal = 0;
    let referidosVerificadosCount = 0;

    for (const ref of referidosRequests) {
      if (ref.comision_pagada) {
        comisionesPagadasTotal += ref.monto_comision || MONTO_COMISION_DEFAULT;
      } else {
        comisionesPendientesTotal += ref.monto_comision || MONTO_COMISION_DEFAULT;
      }

      if (ref.referido_id) {
        const isVerif = await verificarUsuarioAporte(ref.referido_id);
        if (isVerif) referidosVerificadosCount++;
      }
    }

    res.json({
      total_referidos: referidosRequests.length,
      patrocinador_verificado: patrocinadorVerificado,
      referidos_verificados: referidosVerificadosCount,
      comisiones_pagadas_total: comisionesPagadasTotal,
      comisiones_pendientes_total: comisionesPendientesTotal
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener resumen de comisiones', error: error.message });
  }
};

// Barrido y liquidación global de comisiones pendientes
exports.liquidarComisionesPendientesGlobal = async (req, res) => {
  try {
    const resultado = await recorrerYLiquidarComisionesPendientes();
    res.json({
      success: true,
      mensaje: `Barrido completado: ${resultado.liquidadas} comisiones pagadas exitosamente.`,
      resultado
    });
  } catch (error) {
    res.status(500).json({ message: 'Error durante el barrido de comisiones', error: error.message });
  }
};

// Listar todas las solicitudes (Admin)
exports.listarTodasLasSolicitudes = async (req, res) => {
  try {
    const { estado, limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let filtro = {};
    if (estado && estado !== 'todos') {
      filtro.estado = estado;
    }

    const solicitudes = await ReferralRequest.find(filtro)
      .populate('solicitante_id', 'nombre_usuario nombre_completo nivel dni correo_electronico')
      .populate('referido_id', 'nombre_usuario nombre_completo nivel dni correo_electronico')
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