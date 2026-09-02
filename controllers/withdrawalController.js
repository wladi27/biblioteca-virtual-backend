const mongoose = require('mongoose');
const Withdrawal = require('../models/Withdrawal');
const Usuario = require('../models/usuario');
const Billetera = require('../models/billetera');
const Transaccion = require('../models/transaccion');
const ReferralRequest = require('../models/referralRequest');
const { verificarUsuarioAporte } = require('../utils/comisionesReferidos');

const MONTO_MINIMO_RETIRO = 10000; // COP $10,000
const MINIMO_REFERIDOS_VALIDADOS = 3; // Mínimo 3 socios directos con aporte verificado

/**
 * Consulta y valida todos los requisitos que necesita un usuario para solicitar un retiro.
 * Retorna el estado detallado de cada condición.
 */
const obtenerValidacionRetiroUsuario = async (req, res) => {
  try {
    const { usuarioId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
      return res.status(400).json({ message: 'ID de usuario inválido.' });
    }

    const [usuario, billetera, usuarioVerificado, referidosDirectos, retiroPendiente] = await Promise.all([
      Usuario.findById(usuarioId).select('nombre_completo nombre_usuario banco cuenta_numero titular_cuenta dni'),
      Billetera.findOne({ usuario_id: usuarioId }),
      verificarUsuarioAporte(usuarioId),
      ReferralRequest.find({
        solicitante_id: usuarioId,
        estado: 'aceptado'
      }).select('referido_id'),
      Withdrawal.findOne({ usuarioId, status: 'pendiente' })
    ]);

    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    // Contar referidos directos que tengan su aporte verificado
    let referidosValidadosCount = 0;
    for (const ref of referidosDirectos) {
      if (ref.referido_id) {
        const verif = await verificarUsuarioAporte(ref.referido_id);
        if (verif) {
          referidosValidadosCount++;
        }
      }
    }

    const saldoDisponible = billetera?.saldo || 0;
    const tieneBanco = !!(usuario.banco && usuario.cuenta_numero);
    const cumpleReferidos = referidosValidadosCount >= MINIMO_REFERIDOS_VALIDADOS;
    const cumpleSaldoMinimo = saldoDisponible >= MONTO_MINIMO_RETIRO;
    const tienePendiente = !!retiroPendiente;

    const puedeRetirar = usuarioVerificado && cumpleReferidos && cumpleSaldoMinimo && tieneBanco && !tienePendiente;

    res.json({
      usuario: {
        _id: usuario._id,
        nombre: usuario.nombre_completo || usuario.nombre_usuario,
        banco: usuario.banco || '',
        cuenta_numero: usuario.cuenta_numero || '',
        titular_cuenta: usuario.titular_cuenta || usuario.nombre_completo || ''
      },
      saldoDisponible,
      montoMinimoRetiro: MONTO_MINIMO_RETIRO,
      requisitos: {
        usuarioVerificado: {
          cumple: usuarioVerificado,
          titulo: 'Usuario Verificado con Aporte',
          detalle: usuarioVerificado ? 'Aporte inicial validado' : 'Debes realizar y validar tu aporte inicial'
        },
        referidosValidados: {
          cumple: cumpleReferidos,
          actual: referidosValidadosCount,
          requeridos: MINIMO_REFERIDOS_VALIDADOS,
          titulo: `Mínimo ${MINIMO_REFERIDOS_VALIDADOS} Referidos Directos Validados`,
          detalle: `${referidosValidadosCount} de ${MINIMO_REFERIDOS_VALIDADOS} socios con aporte aprobado`
        },
        saldoSuficiente: {
          cumple: cumpleSaldoMinimo,
          titulo: `Saldo Mínimo (COP $${MONTO_MINIMO_RETIRO.toLocaleString('es-CO')})`,
          detalle: `Saldo disponible: COP $${saldoDisponible.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`
        },
        datosBancarios: {
          cumple: tieneBanco,
          titulo: 'Datos Bancarios Registrados',
          detalle: tieneBanco ? `${usuario.banco} - N° ${usuario.cuenta_numero}` : 'Registra tu cuenta bancaria en tu Perfil'
        },
        sinRetiroPendiente: {
          cumple: !tienePendiente,
          titulo: 'Sin Retiros Pendientes',
          detalle: tienePendiente ? 'Tienes un retiro en trámite' : 'Disponible para solicitar'
        }
      },
      puedeRetirar,
      retiroPendiente: retiroPendiente ? {
        _id: retiroPendiente._id,
        monto: retiroPendiente.monto,
        fecha: retiroPendiente.fecha,
        status: retiroPendiente.status
      } : null
    });

  } catch (error) {
    console.error('Error al obtener validación de retiro:', error);
    res.status(500).json({ message: 'Error al verificar condiciones de retiro', error: error.message });
  }
};

/**
 * Crea una solicitud de retiro garantizando:
 * 1. Idempotencia anti-fraude y anti-duplicados por concurrencia multi-dispositivo.
 * 2. Validación de usuario verificado con aporte.
 * 3. Mínimo 3 referidos directos con aporte verificado.
 * 4. Monto mínimo de retiro ($10,000 COP).
 * 5. Débito atómico en MongoDB previniendo doble gasto o sobregiro.
 */
const crearRetiro = async (req, res) => {
  try {
    const usuarioId = req.body.usuarioId || req.body.userId;
    const monto = parseFloat(req.body.monto);
    const notas = req.body.notas || '';
    const idempotencyKey = req.headers['x-idempotency-key'] || req.body.idempotencyKey || req.body.idempotency_key;

    console.log('💸 Intento de retiro bancario:', { usuarioId, monto, idempotencyKey });

    // 1. Manejo de Idempotencia: Si ya existe una petición con este token, devolver el resultado previo
    if (idempotencyKey) {
      const retiroPrevio = await Withdrawal.findOne({ idempotencyKey });
      if (retiroPrevio) {
        console.log('⚡ Solicitud de retiro idempotente duplicada interceptada:', idempotencyKey);
        return res.status(200).json({
          message: 'Solicitud de retiro recibida previamente (Idempotente).',
          retiro: retiroPrevio,
          esRepetido: true
        });
      }
    }

    // 2. Validación de Usuario
    if (!usuarioId || !mongoose.Types.ObjectId.isValid(usuarioId)) {
      return res.status(400).json({ message: 'ID de usuario inválido.' });
    }

    const usuario = await Usuario.findById(usuarioId);
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado en el sistema.' });
    }

    // 3. Validación de Usuario Verificado (Aporte aprobado)
    const usuarioVerificado = await verificarUsuarioAporte(usuarioId);
    if (!usuarioVerificado) {
      return res.status(400).json({ 
        message: 'Requisito no cumplido: Debes tener tu aporte inicial verificado para poder solicitar retiros de fondos.' 
      });
    }

    // 4. Validación de Mínimo 3 Referidos Directos Validados
    const referidosDirectos = await ReferralRequest.find({
      solicitante_id: usuarioId,
      estado: 'aceptado'
    }).select('referido_id');

    let referidosValidadosCount = 0;
    for (const ref of referidosDirectos) {
      if (ref.referido_id) {
        const verif = await verificarUsuarioAporte(ref.referido_id);
        if (verif) {
          referidosValidadosCount++;
        }
      }
    }

    if (referidosValidadosCount < MINIMO_REFERIDOS_VALIDADOS) {
      return res.status(400).json({
        message: `Requisito no cumplido: Debes tener al menos ${MINIMO_REFERIDOS_VALIDADOS} referidos directos con aporte verificado para retirar. Actualmente tienes ${referidosValidadosCount} de ${MINIMO_REFERIDOS_VALIDADOS}.`,
        referidosValidados: referidosValidadosCount,
        referidosRequeridos: MINIMO_REFERIDOS_VALIDADOS
      });
    }

    // 5. Validación de Monto Mínimo
    if (!monto || isNaN(monto) || monto < MONTO_MINIMO_RETIRO) {
      return res.status(400).json({
        message: `El monto mínimo de retiro es de COP $${MONTO_MINIMO_RETIRO.toLocaleString('es-CO')}.`
      });
    }

    // 6. Validación de Retiro Pendiente Existente (Evita acumulación o colas abusivas)
    const retiroPendiente = await Withdrawal.findOne({
      usuarioId,
      status: 'pendiente'
    });

    if (retiroPendiente) {
      return res.status(400).json({
        message: 'Ya tienes una solicitud de retiro pendiente de aprobación. Espera a que sea procesada antes de solicitar un nuevo retiro.'
      });
    }

    // 7. DÉBITO ATÓMICO EN MONGOOSE (Blindaje absoluto contra doble gasto concurrente)
    // Solo actualiza si saldo >= monto. Si dos peticiones simultáneas entran, solo una coincidirá.
    const billeteraActualizada = await Billetera.findOneAndUpdate(
      { 
        usuario_id: usuarioId, 
        saldo: { $gte: monto } 
      },
      { 
        $inc: { saldo: -monto } 
      },
      { new: true }
    );

    if (!billeteraActualizada) {
      const billetera = await Billetera.findOne({ usuario_id: usuarioId });
      const saldoReal = billetera ? billetera.saldo : 0;
      return res.status(400).json({
        message: `Saldo insuficiente. Tu saldo disponible actual es de COP $${saldoReal.toLocaleString('es-CO', { minimumFractionDigits: 2 })}.`
      });
    }

    // 8. Crear Transacción Contable de Débito/Retiro en estado 'pendiente'
    const transaccion = new Transaccion({
      usuario_id: usuarioId,
      tipo: 'retiro',
      monto: monto,
      descripcion: `Solicitud de retiro bancario ${notas ? `- ${notas}` : ''}`,
      estado: 'pendiente',
      fecha: new Date()
    });
    await transaccion.save();

    // 9. Crear el registro oficial de Retiro
    const retiro = new Withdrawal({
      usuarioId,
      monto,
      notas,
      idempotencyKey: idempotencyKey || null,
      status: 'pendiente',
      banco: usuario.banco || '',
      cuenta_numero: usuario.cuenta_numero || '',
      titular_cuenta: usuario.titular_cuenta || usuario.nombre_completo || '',
      transaccionId: transaccion._id,
      fecha: new Date()
    });
    await retiro.save();

    console.log(`✅ Retiro creado exitosamente por COP $${monto} para usuario ${usuarioId}. Saldo restante: COP $${billeteraActualizada.saldo}`);

    res.status(201).json({
      message: 'Solicitud de retiro registrada exitosamente.',
      retiro,
      saldoRestante: billeteraActualizada.saldo
    });

  } catch (error) {
    console.error('❌ Error al crear retiro:', error);
    res.status(500).json({ message: 'Error al procesar la solicitud de retiro.', error: error.message });
  }
};

const obtenerRetiros = async (req, res) => {
  try {
    const retiros = await Withdrawal.find()
      .populate('usuarioId', 'nombre_completo nombre_usuario dni banco cuenta_numero titular_cuenta')
      .sort({ fecha: -1 });
    res.status(200).json(retiros);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const obtenerRetiroPorId = async (req, res) => {
  try {
    const retiro = await Withdrawal.findById(req.params.id).populate('usuarioId', 'nombre_completo nombre_usuario dni banco cuenta_numero titular_cuenta');
    if (!retiro) return res.status(404).json({ message: 'Retiro no encontrado' });
    res.status(200).json(retiro);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const obtenerRetirosPorUsuario = async (req, res) => {
  try {
    const retiros = await Withdrawal.find({ usuarioId: req.params.usuarioId })
      .populate('usuarioId', 'nombre_completo nombre_usuario')
      .sort({ fecha: -1 });
    res.status(200).json(retiros);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const actualizarRetiro = async (req, res) => {
  try {
    const retiro = await Withdrawal.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!retiro) return res.status(404).json({ message: 'Retiro no encontrado' });
    res.status(200).json(retiro);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/**
 * Actualiza el estado del retiro.
 * Si se rechaza, reintegra automáticamente los fondos a la billetera del usuario.
 * Si se completa/paga, aprueba la transacción asociada.
 */
const actualizarEstadoRetiro = async (req, res) => {
  try {
    const { status, motivo_rechazo } = req.body;
    if (!['pendiente', 'completado', 'rechazado', 'pagado'].includes(status)) {
      return res.status(400).json({ message: 'Estado no válido' });
    }
    
    const retiro = await Withdrawal.findById(req.params.id);
    if (!retiro) return res.status(404).json({ message: 'Retiro no encontrado' });

    const estadoAnterior = retiro.status;
    retiro.status = status;
    if (motivo_rechazo) {
      retiro.motivo_rechazo = motivo_rechazo;
    }
    await retiro.save();

    // Si cambió de 'pendiente' a 'rechazado', reembolsar saldo al usuario
    if (estadoAnterior === 'pendiente' && status === 'rechazado') {
      await Billetera.findOneAndUpdate(
        { usuario_id: retiro.usuarioId },
        { $inc: { saldo: retiro.monto } }
      );
      if (retiro.transaccionId) {
        await Transaccion.findByIdAndUpdate(retiro.transaccionId, { 
          estado: 'rechazado',
          descripcion: `Retiro rechazado: ${motivo_rechazo || 'Cancelado por administración'}`
        });
      }
      console.log(`↩️ Saldo reembolsado de COP $${retiro.monto} al usuario ${retiro.usuarioId} por retiro rechazado.`);
    } 
    // Si cambió a completado o pagado, aprobar la transacción
    else if (['completado', 'pagado'].includes(status)) {
      if (retiro.transaccionId) {
        await Transaccion.findByIdAndUpdate(retiro.transaccionId, { estado: 'aprobado' });
      }
    }

    res.status(200).json({ message: `Estado actualizado a ${status}`, retiro });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const eliminarRetiro = async (req, res) => {
  try {
    const retiro = await Withdrawal.findByIdAndDelete(req.params.id);
    if (!retiro) return res.status(404).json({ message: 'Retiro no encontrado' });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  MONTO_MINIMO_RETIRO,
  MINIMO_REFERIDOS_VALIDADOS,
  obtenerValidacionRetiroUsuario,
  crearRetiro,
  obtenerRetiros,
  obtenerRetiroPorId,
  obtenerRetirosPorUsuario,
  actualizarRetiro,
  eliminarRetiro,
  actualizarEstadoRetiro
};
