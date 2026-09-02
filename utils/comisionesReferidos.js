const ReferralRequest = require('../models/referralRequest');
const Aporte = require('../models/aporteModel');
const Billetera = require('../models/billetera');
const Transaccion = require('../models/transaccion');
const Usuario = require('../models/usuario');

const MONTO_COMISION_DEFAULT = 1400; // COP $1,400 por referido directo

/**
 * Verifica si un usuario tiene un aporte aprobado (aporte: true)
 * @param {string|ObjectId} usuarioId
 * @returns {Promise<boolean>}
 */
const verificarUsuarioAporte = async (usuarioId) => {
  if (!usuarioId) return false;
  try {
    const aporteAprobado = await Aporte.findOne({ 
      usuarioId: usuarioId.toString(), 
      aporte: true 
    }).lean();
    return !!aporteAprobado;
  } catch (error) {
    console.error(`Error verificando aporte de usuario ${usuarioId}:`, error);
    return false;
  }
};

/**
 * Detecta si vincular a 'patrocinadorId' con 'referidoId' crearía un ciclo de referencias.
 * Recorre la cadena de patrocinio hacia arriba y hacia abajo para asegurar que no haya ciclos circulares.
 * @param {string|ObjectId} patrocinadorId 
 * @param {string|ObjectId} referidoId 
 * @returns {Promise<{ esCiclo: boolean, mensaje?: string }>}
 */
const detectarCicloReferencia = async (patrocinadorId, referidoId) => {
  if (!patrocinadorId || !referidoId) {
    return { esCiclo: true, mensaje: 'IDs de usuarios inválidos para validar patrocinio.' };
  }

  const pIdStr = patrocinadorId.toString();
  const rIdStr = referidoId.toString();

  // 1. No auto-referencia
  if (pIdStr === rIdStr) {
    return { esCiclo: true, mensaje: 'No puedes referirte a ti mismo.' };
  }

  // 2. Verificar patrocinio inverso directo (Si R ya patrocina a P)
  const patrocinioInverso = await ReferralRequest.findOne({
    solicitante_id: referidoId,
    referido_id: patrocinadorId,
    estado: 'aceptado'
  }).lean();

  if (patrocinioInverso) {
    return { 
      esCiclo: true, 
      mensaje: 'Conflicto de patrocinio: El usuario que intentas referir ya es tu patrocinador directo.' 
    };
  }

  // 3. Recorrer la cadena de patrocinio hacia arriba (Ancestros del Patrocinador P)
  // Si R está en la línea ascendente de P, P no puede patrocinar a R (crearía ciclo R -> ... -> P -> R)
  let actualId = patrocinadorId;
  const visitados = new Set([pIdStr]);
  const maxProfundidad = 50;
  let profundidad = 0;

  while (actualId && profundidad < maxProfundidad) {
    profundidad++;
    const relacion = await ReferralRequest.findOne({
      referido_id: actualId,
      estado: 'aceptado'
    }).select('solicitante_id').lean();

    if (!relacion || !relacion.solicitante_id) {
      break; // Llegamos a la raíz de la red
    }

    const ancestroIdStr = relacion.solicitante_id.toString();

    if (ancestroIdStr === rIdStr) {
      return { 
        esCiclo: true, 
        mensaje: `Ciclo detectado: El usuario ya es tu patrocinador superior (Línea ascendente nivel +${profundidad}). No se permiten referencias circulares.` 
      };
    }

    if (visitados.has(ancestroIdStr)) {
      break;
    }

    visitados.add(ancestroIdStr);
    actualId = relacion.solicitante_id;
  }

  // 4. Recorrer la cadena de patrocinio hacia abajo (Descendientes del Referido R)
  // Si P ya es descendiente de R en la red, P no puede patrocinar a R
  let colaDescendientes = [rIdStr];
  const visitadosDesc = new Set([rIdStr]);
  let profundidadDesc = 0;

  while (colaDescendientes.length > 0 && profundidadDesc < 12) {
    profundidadDesc++;
    const descendientesDocs = await ReferralRequest.find({
      solicitante_id: { $in: colaDescendientes },
      estado: 'aceptado'
    }).select('referido_id').lean();

    if (descendientesDocs.length === 0) break;

    const nuevosHijos = [];
    for (const doc of descendientesDocs) {
      if (!doc.referido_id) continue;
      const hijoIdStr = doc.referido_id.toString();
      if (hijoIdStr === pIdStr) {
        return {
          esCiclo: true,
          mensaje: 'Ciclo detectado: Ya eres descendiente directo o indirecto de este usuario en la red de referidos.'
        };
      }
      if (!visitadosDesc.has(hijoIdStr)) {
        visitadosDesc.add(hijoIdStr);
        nuevosHijos.push(hijoIdStr);
      }
    }
    colaDescendientes = nuevosHijos;
  }

  return { esCiclo: false };
};

/**
 * Procesa la liquidación de comisión de una solicitud de referido específica.
 * NOTA DE ARQUITECTURA:
 * - solicitante_id = PATROCINADOR (quien invita y recibe la comisión de $1,400 COP).
 * - referido_id = REFERIDO (el socio invitado).
 * Solo paga si la solicitud está aceptada y AMBOS tienen aporte verificado.
 * @param {string|ObjectId} solicitudId
 * @returns {Promise<{ pagada: boolean, monto: number, motivo?: string, error?: string }>}
 */
const procesarComisionReferido = async (solicitudId) => {
  try {
    const solicitud = await ReferralRequest.findById(solicitudId)
      .populate('solicitante_id', 'nombre_usuario nombre_completo correo_electronico')
      .populate('referido_id', 'nombre_usuario nombre_completo correo_electronico');

    if (!solicitud) {
      return { pagada: false, error: 'Solicitud no encontrada' };
    }

    if (solicitud.estado !== 'aceptado') {
      return { pagada: false, motivo: `La solicitud no está aceptada (estado: ${solicitud.estado})` };
    }

    if (solicitud.comision_pagada) {
      return { pagada: false, motivo: 'La comisión ya fue liquidada previamente' };
    }

    // solicitante_id = PATROCINADOR (el que cobra)
    // referido_id = REFERIDO (el socio traído)
    const patrocinadorId = solicitud.solicitante_id?._id || solicitud.solicitante_id;
    const referidoId = solicitud.referido_id?._id || solicitud.referido_id;

    if (!patrocinadorId || !referidoId) {
      return { pagada: false, error: 'Datos de usuarios incompletos en la solicitud' };
    }

    // 1. Verificar si AMBOS tienen aporte verificado
    const [patrocinadorVerificado, referidoVerificado] = await Promise.all([
      verificarUsuarioAporte(patrocinadorId),
      verificarUsuarioAporte(referidoId)
    ]);

    // Caso A: AMBOS ESTÁN VERIFICADOS -> Liquidar comisión inmediatamente al patrocinador
    if (patrocinadorVerificado && referidoVerificado) {
      const monto = solicitud.monto_comision || MONTO_COMISION_DEFAULT;

      // Abonar a la billetera del patrocinador
      await Billetera.findOneAndUpdate(
        { usuario_id: patrocinadorId },
        { 
          $inc: { saldo: monto },
          $set: { activa: true }
        },
        { upsert: true, new: true }
      );

      // Registrar la transacción contable para el patrocinador
      const referidoUsername = solicitud.referido_id?.nombre_usuario || 'usuario';
      const transaccion = new Transaccion({
        usuario_id: patrocinadorId,
        tipo: 'comision_referido',
        monto: monto,
        descripcion: `Comisión por referido directo verificado - Socio: @${referidoUsername}`,
        estado: 'aprobado',
        referencia_solicitud_id: solicitud._id,
        fecha: new Date()
      });
      await transaccion.save();

      // Actualizar la solicitud a estado pagada
      solicitud.comision_pagada = true;
      solicitud.estado_comision = 'pagada';
      solicitud.fecha_pago_comision = new Date();
      solicitud.motivo_pendiente = 'Comisión de referido liquidada exitosamente';
      await solicitud.save();

      console.log(`🎉 Comisión de COP $${monto} pagada a patrocinador ${patrocinadorId} por referido ${referidoId}`);
      return { pagada: true, monto, patrocinadorId, referidoId };
    }

    // Caso B: FALTA LA VERIFICACIÓN DE UNO O DE AMBOS -> Marcar pendiente con motivo detallado
    let motivo = '';
    if (!patrocinadorVerificado && !referidoVerificado) {
      motivo = 'Ambos socios deben verificar su aporte inicial para liquidar la comisión.';
    } else if (!patrocinadorVerificado) {
      motivo = 'Debes verificar tu aporte inicial para recibir la comisión de COP $1,400.';
    } else {
      const usernameRef = solicitud.referido_id?.nombre_usuario || 'referido';
      motivo = `Esperando que tu referido @${usernameRef} realice y verifique su aporte inicial.`;
    }

    solicitud.comision_pagada = false;
    solicitud.estado_comision = 'pendiente_verificacion';
    solicitud.motivo_pendiente = motivo;
    await solicitud.save();

    return { 
      pagada: false, 
      motivo,
      patrocinadorVerificado, 
      referidoVerificado 
    };

  } catch (error) {
    console.error(`Error procesando comisión para solicitud ${solicitudId}:`, error);
    return { pagada: false, error: error.message };
  }
};

/**
 * Recorre todas las solicitudes de referidos pendientes de pago y liquida aquellas donde
 * AMBOS socios ya cuenten con aporte verificado.
 * @param {object} filtroExtra - Filtro opcional (ej: { solicitante_id: usuarioId })
 * @returns {Promise<{ revisadas: number, liquidadas: number, aunPendientes: number, totalPagado: number, detalles: Array }>}
 */
const recorrerYLiquidarComisionesPendientes = async (filtroExtra = {}) => {
  try {
    const filtro = {
      estado: 'aceptado',
      comision_pagada: { $ne: true },
      ...filtroExtra
    };

    const solicitudesPendientes = await ReferralRequest.find(filtro).select('_id solicitante_id referido_id');

    let liquidadas = 0;
    let aunPendientes = 0;
    let totalPagado = 0;
    const detalles = [];

    for (const sol of solicitudesPendientes) {
      const resultado = await procesarComisionReferido(sol._id);
      if (resultado.pagada) {
        liquidadas++;
        totalPagado += resultado.monto || MONTO_COMISION_DEFAULT;
        detalles.push({ solicitudId: sol._id, estado: 'liquidada', monto: resultado.monto });
      } else {
        aunPendientes++;
        detalles.push({ solicitudId: sol._id, estado: 'pendiente', motivo: resultado.motivo });
      }
    }

    console.log(`📊 Barrido de comisiones de referidos: ${solicitudesPendientes.length} revisadas, ${liquidadas} liquidadas (Total: COP $${totalPagado}), ${aunPendientes} aún pendientes.`);

    return {
      revisadas: solicitudesPendientes.length,
      liquidadas,
      aunPendientes,
      totalPagado,
      detalles
    };
  } catch (error) {
    console.error('Error en recorrerYLiquidarComisionesPendientes:', error);
    throw error;
  }
};

/**
 * Se invoca inmediatamente cuando se valida el aporte de un usuario.
 * Revisa si este usuario tiene solicitudes como patrocinador o como referido que ya puedan pagarse.
 * @param {string|ObjectId} usuarioId
 */
const procesarComisionesPendientesPorVerificacion = async (usuarioId) => {
  if (!usuarioId) return { revisadas: 0, liquidadas: 0 };
  try {
    const filtro = {
      $or: [
        { solicitante_id: usuarioId },
        { referido_id: usuarioId }
      ]
    };
    return await recorrerYLiquidarComisionesPendientes(filtro);
  } catch (error) {
    console.error(`Error procesando comisiones pendientes para usuario ${usuarioId}:`, error);
    return { error: error.message };
  }
};

module.exports = {
  MONTO_COMISION_DEFAULT,
  verificarUsuarioAporte,
  detectarCicloReferencia,
  procesarComisionReferido,
  recorrerYLiquidarComisionesPendientes,
  procesarComisionesPendientesPorVerificacion
};
