const Billetera = require('../models/billetera');
const Transaccion = require('../models/transaccion');
const Usuario = require('../models/usuario');
const RecargaMasiva = require('../models/recargaMasiva');

// Verificar el estado de la billetera
exports.verificarEstado = async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const billetera = await Billetera.findOne({ usuario_id: usuarioId });

    if (!billetera) {
      return res.status(404).json({ activa: false, saldo: 0 });
    }

    res.status(200).json({ activa: billetera.activa, saldo: billetera.saldo });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};

// Obtener información de la billetera con desglose de fuentes de saldo
exports.obtenerBilletera = async (req, res) => {
  try {
    const { usuarioId } = req.params;
    let billetera = await Billetera.findOne({ usuario_id: usuarioId });

    if (!billetera) {
      // Si el usuario existe, crear billetera activa por defecto con saldo 0
      const usuario = await Usuario.findById(usuarioId);
      if (usuario) {
        billetera = new Billetera({ usuario_id: usuarioId, activa: true, saldo: 0 });
        await billetera.save();
      } else {
        return res.status(404).json({ mensaje: 'Billetera no encontrada para este usuario' });
      }
    }

    // Calcular desglose contable a partir de transacciones aprobadas/completadas
    const transacciones = await Transaccion.find({
      usuario_id: usuarioId,
      estado: { $in: ['aprobado', 'completado', 'pendiente'] }
    }).lean();

    let totalRecargasDiarias = 0;
    let totalRecargasMasivas = 0;
    let totalRecargasIndividuales = 0;
    let totalComisionesNiveles = 0;
    let totalComisionesReferidos = 0;
    let totalAportes = 0;
    let totalRetiros = 0;

    transacciones.forEach((t) => {
      const monto = Number(t.monto) || 0;
      switch (t.tipo) {
        case 'recarga_diaria':
          totalRecargasDiarias += monto;
          break;
        case 'recarga_masiva':
          totalRecargasMasivas += monto;
          break;
        case 'recarga':
        case 'recarga_individual':
          totalRecargasIndividuales += monto;
          break;
        case 'comision_nivel':
          totalComisionesNiveles += monto;
          break;
        case 'comision_referido':
          totalComisionesReferidos += monto;
          break;
        case 'aporte_aprobado':
          totalAportes += monto;
          break;
        case 'retiro':
          if (t.estado !== 'rechazado') {
            totalRetiros += monto;
          }
          break;
        default:
          break;
      }
    });

    res.status(200).json({
      _id: billetera._id,
      saldo: billetera.saldo,
      activa: billetera.activa,
      usuario_id: billetera.usuario_id,
      desglose: {
        recargasDiarias: totalRecargasDiarias,
        recargasMasivas: totalRecargasMasivas,
        recargasIndividuales: totalRecargasIndividuales,
        comisionesNiveles: totalComisionesNiveles,
        comisionesReferidos: totalComisionesReferidos,
        aportes: totalAportes,
        retiros: totalRetiros,
        saldoCalculado: (
          totalRecargasDiarias +
          totalRecargasMasivas +
          totalRecargasIndividuales +
          totalComisionesNiveles +
          totalComisionesReferidos +
          totalAportes -
          totalRetiros
        )
      }
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};

// Activar billetera
exports.activarBilletera = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    let billetera = await Billetera.findOne({ usuario_id: usuarioId });

    if (billetera) {
      if (billetera.activa) {
        return res.status(400).json({ mensaje: 'La billetera ya está activada' });
      }
      billetera.activa = true;
      await billetera.save();
    } else {
      billetera = new Billetera({ usuario_id: usuarioId, activa: true, saldo: 0 });
      await billetera.save();
    }

    res.status(200).json({ mensaje: 'Billetera activada exitosamente', billetera });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};

// Recargar billetera INDIVIDUAL (Solo Administrador)
exports.recargarBilletera = async (req, res) => {
  try {
    const { monto, usuarioId, usuario_id, descripcion } = req.body;
    const targetUserId = usuarioId || usuario_id;

    if (!targetUserId) {
      return res.status(400).json({ mensaje: 'El ID del usuario es requerido' });
    }

    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      return res.status(400).json({ mensaje: 'El monto debe ser un número mayor que 0' });
    }

    let billetera = await Billetera.findOne({ usuario_id: targetUserId });
    if (!billetera) {
      billetera = new Billetera({ usuario_id: targetUserId, activa: true, saldo: 0 });
    }

    billetera.saldo += montoNum;
    billetera.activa = true;
    await billetera.save();

    const nuevaTransaccion = new Transaccion({
      usuario_id: targetUserId,
      tipo: 'recarga_individual',
      monto: montoNum,
      descripcion: descripcion || `Recarga individual administrativa de ${montoNum} COP`,
      estado: 'aprobado',
      fecha: new Date()
    });
    await nuevaTransaccion.save();

    res.status(200).json({
      mensaje: 'Recarga individual exitosa',
      saldo: billetera.saldo,
      transaccion: nuevaTransaccion
    });
  } catch (error) {
    console.error('Error en recargarBilletera:', error);
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};

// Enviar dinero (Deshabilitado temporalmente según requerimiento)
exports.enviarDinero = async (req, res) => {
  return res.status(403).json({
    mensaje: 'La opción de transferir/enviar dinero se habilitará próximamente.'
  });
};

// Retirar dinero con validación estricta de fondos
exports.retirarDinero = async (req, res) => {
  try {
    const { monto, cuentaDestino, banco } = req.body;
    const usuarioId = req.user.id;

    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      return res.status(400).json({ mensaje: 'El monto de retiro debe ser mayor que 0' });
    }

    const billetera = await Billetera.findOne({ usuario_id: usuarioId });

    if (!billetera || !billetera.activa) {
      return res.status(404).json({ mensaje: 'Billetera no encontrada o no activa' });
    }

    if (billetera.saldo < montoNum) {
      return res.status(400).json({
        mensaje: `Saldo insuficiente. Saldo disponible: ${billetera.saldo} COP, Monto solicitado: ${montoNum} COP`
      });
    }

    // Descontar saldo y registrar retiro pendiente
    billetera.saldo -= montoNum;
    await billetera.save();

    const nuevaTransaccion = new Transaccion({
      usuario_id: usuarioId,
      tipo: 'retiro',
      monto: montoNum,
      descripcion: `Solicitud de retiro de ${montoNum} COP ${banco ? 'a ' + banco : ''}`,
      estado: 'pendiente',
      fecha: new Date()
    });
    await nuevaTransaccion.save();

    res.status(200).json({
      mensaje: 'Solicitud de retiro registrada exitosamente',
      saldo: billetera.saldo,
      transaccion: nuevaTransaccion
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};

// Eliminar billetera
exports.eliminarBilletera = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const billetera = await Billetera.findOne({ usuario_id: usuarioId });

    if (!billetera) {
      return res.status(404).json({ mensaje: 'Billetera no encontrada' });
    }

    if (billetera.saldo > 0) {
      return res.status(400).json({ mensaje: 'No puedes eliminar una billetera con saldo positivo' });
    }

    await Billetera.deleteOne({ usuario_id: usuarioId });
    res.status(200).json({ mensaje: 'Billetera eliminada exitosamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};

// Pagar comisión por referido directo
exports.recargarPorReferidoDirecto = async (req, res) => {
  try {
    const { usuarioId, nivel, solicitanteNombre } = req.body;

    if (!usuarioId) {
      return res.status(400).json({ mensaje: 'El ID del usuario es requerido' });
    }

    const monto = parseInt(nivel, 10) >= 1792 ? 7000 : 1400;
    let billetera = await Billetera.findOne({ usuario_id: usuarioId });

    if (!billetera) {
      billetera = new Billetera({ usuario_id: usuarioId, activa: true, saldo: 0 });
    }

    billetera.saldo += monto;
    billetera.activa = true;
    await billetera.save();

    const nuevaTransaccion = new Transaccion({
      usuario_id: usuarioId,
      tipo: 'comision_referido',
      monto: monto,
      descripcion: `Comisión por referido directo ${solicitanteNombre ? '(' + solicitanteNombre + ')' : ''} de ${monto} COP`,
      estado: 'aprobado',
      fecha: new Date()
    });
    await nuevaTransaccion.save();

    res.status(200).json({
      mensaje: 'Comisión por referido directo acreditada exitosamente',
      saldo: billetera.saldo,
      transaccion: nuevaTransaccion
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};

// Pagar comisión por nivel de la matriz alcanzado
exports.pagarComisionNivel = async (usuarioId, numeroNivel, montoComision) => {
  try {
    let billetera = await Billetera.findOne({ usuario_id: usuarioId });
    if (!billetera) {
      billetera = new Billetera({ usuario_id: usuarioId, activa: true, saldo: 0 });
    }

    billetera.saldo += montoComision;
    billetera.activa = true;
    await billetera.save();

    const transaccion = new Transaccion({
      usuario_id: usuarioId,
      tipo: 'comision_nivel',
      monto: montoComision,
      descripcion: `Comisión por alcanzar/completar Nivel ${numeroNivel} en la matriz (${montoComision} COP)`,
      estado: 'aprobado',
      fecha: new Date()
    });
    await transaccion.save();

    return { success: true, saldo: billetera.saldo, transaccion };
  } catch (error) {
    console.error(`Error pagando comisión de nivel ${numeroNivel} a usuario ${usuarioId}:`, error);
    throw error;
  }
};

// Activar solo billeteras inactivas (Optimizado en alto rendimiento)
exports.activarBilleterasInactivas = async (req, res) => {
  try {
    const existingWallets = await Billetera.find().select('usuario_id').lean();
    const existingUserIds = new Set(existingWallets.map(w => w.usuario_id ? w.usuario_id.toString() : ''));
    const allUsers = await Usuario.find().select('_id').lean();
    
    const missingWallets = allUsers
      .filter(u => !existingUserIds.has(u._id.toString()))
      .map(u => ({ usuario_id: u._id, activa: true, saldo: 0 }));

    let insertadas = 0;
    if (missingWallets.length > 0) {
      const insertRes = await Billetera.insertMany(missingWallets, { ordered: false });
      insertadas = insertRes.length;
    }

    const updateRes = await Billetera.updateMany({ activa: { $ne: true } }, { $set: { activa: true } });
    const activadas = insertadas + (updateRes.modifiedCount || 0);

    res.status(200).json({
      mensaje: `Proceso completado: ${activadas} billeteras verificadas y activadas`,
      activadas
    });
  } catch (error) {
    console.error('Error en activarBilleterasInactivas:', error);
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};

// Ejecución general de recargas masivas
const ejecutarRecargaMasivaGeneral = async ({
  monto,
  ejecutadoPor = null,
  esDiaria = false,
  registrarTransaccionesIndividuales = true
}) => {
  const montoNumero = parseFloat(monto);
  if (isNaN(montoNumero) || montoNumero <= 0) {
    const error = new Error('El monto debe ser un número mayor que 0');
    error.statusCode = 400;
    throw error;
  }

  const totalBilleteras = await Billetera.countDocuments({ activa: true });
  if (totalBilleteras === 0) {
    const error = new Error('No hay billeteras activas para recargar');
    error.statusCode = 404;
    throw error;
  }

  const tipoTransaccion = esDiaria ? 'recarga_diaria' : 'recarga_masiva';

  const adminUser = !ejecutadoPor ? await Usuario.findOne({ rol: 'admin' }) : null;
  const usuarioEjecutor = ejecutadoPor || adminUser?._id || null;

  const recargaMasiva = new RecargaMasiva({
    monto_individual: montoNumero,
    total_billeteras: totalBilleteras,
    monto_total: montoNumero * totalBilleteras,
    ejecutado_por: usuarioEjecutor,
    estado: 'procesando'
  });
  await recargaMasiva.save();

  // Actualizar saldo de todas las billeteras activas
  const resultado = await Billetera.updateMany(
    { activa: true },
    { $inc: { saldo: montoNumero } }
  );

  // Registrar transacción principal
  const primerUsuario = !usuarioEjecutor ? await Usuario.findOne() : null;
  const transaccionPrincipal = new Transaccion({
    usuario_id: usuarioEjecutor || primerUsuario?._id,
    tipo: tipoTransaccion,
    monto: montoNumero * resultado.modifiedCount,
    descripcion: `RECARGA MASIVA: ${montoNumero} COP cargados a ${resultado.modifiedCount} billeteras activas`,
    estado: 'aprobado',
    recarga_masiva_id: recargaMasiva._id,
    es_recarga_masiva: true,
    fecha: new Date()
  });
  await transaccionPrincipal.save();

  recargaMasiva.transaccion_principal_id = transaccionPrincipal._id;
  recargaMasiva.estado = 'completado';
  await recargaMasiva.save();

  if (registrarTransaccionesIndividuales) {
    await module.exports.crearTransaccionesIndividuales(recargaMasiva._id, montoNumero, tipoTransaccion);
  }

  return {
    recarga_masiva_id: recargaMasiva._id,
    billeterasAfectadas: resultado.modifiedCount,
    totalBilleteras,
    montoIndividual: montoNumero,
    montoTotal: montoNumero * resultado.modifiedCount,
    transaccionPrincipal: transaccionPrincipal._id,
    tipo: tipoTransaccion
  };
};

// Recarga masiva ULTRA RÁPIDA (Admin)
exports.recargaGeneralUltraRapida = async (req, res) => {
  try {
    const { monto } = req.body;
    const ejecutadoPor = req.user ? req.user._id : null;
    const resultado = await ejecutarRecargaMasivaGeneral({ monto, ejecutadoPor, esDiaria: false });

    res.status(200).json({
      mensaje: 'Recarga masiva completada exitosamente',
      ...resultado
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      mensaje: error.message || 'Error en el servidor',
      error: error.message
    });
  }
};

exports.ejecutarRecargaMasivaAutomatica = async (opciones = {}) => {
  return ejecutarRecargaMasivaGeneral({ ...opciones, esDiaria: true });
};

// Crear transacciones individuales optimizadas para Vercel Serverless
exports.crearTransaccionesIndividuales = async (recargaMasivaId, monto, tipo = 'recarga_masiva') => {
  try {
    const billeteras = await Billetera.find({ activa: true }).select('usuario_id').lean();
    if (!billeteras || billeteras.length === 0) return 0;

    const fecha = new Date();
    const batchSize = 1000;
    const transacciones = billeteras.map((billetera) => ({
      usuario_id: billetera.usuario_id,
      tipo: tipo,
      monto: monto,
      descripcion: `Recarga individual (${tipo}) de ${monto} COP`,
      recarga_masiva_id: recargaMasivaId,
      es_recarga_masiva: true,
      fecha: fecha,
      estado: 'aprobado'
    }));

    for (let i = 0; i < transacciones.length; i += batchSize) {
      const batch = transacciones.slice(i, i + batchSize);
      await Transaccion.insertMany(batch, { ordered: false });
    }

    return transacciones.length;
  } catch (error) {
    console.error('Error creando transacciones individuales:', error);
    return 0;
  }
};

exports.crearTransaccionesIndividualesBackground = exports.crearTransaccionesIndividuales;

// Reconciliar saldo (Auditoría contable)
exports.reconciliarSaldo = async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const billetera = await Billetera.findOne({ usuario_id: usuarioId });

    if (!billetera) {
      return res.status(404).json({ mensaje: 'Billetera no encontrada' });
    }

    const transacciones = await Transaccion.find({
      usuario_id: usuarioId,
      estado: { $in: ['aprobado', 'completado'] }
    });

    let ingresos = 0;
    let egresos = 0;

    transacciones.forEach((t) => {
      const m = Number(t.monto) || 0;
      if (t.tipo === 'retiro') {
        egresos += m;
      } else {
        ingresos += m;
      }
    });

    const saldoAuditado = ingresos - egresos;
    const saldoAnterior = billetera.saldo;

    billetera.saldo = saldoAuditado;
    await billetera.save();

    res.status(200).json({
      mensaje: 'Saldo reconciliado exitosamente',
      saldoAnterior,
      saldoAuditado,
      diferencia: saldoAuditado - saldoAnterior
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al reconciliar saldo', error: error.message });
  }
};

// Obtener historial de recargas masivas
exports.obtenerRecargasMasivas = async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const recargas = await RecargaMasiva.find()
      .populate('ejecutado_por', 'nombre_completo correo_electronico')
      .populate('transaccion_principal_id', 'monto descripcion fecha')
      .sort({ fecha_ejecucion: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await RecargaMasiva.countDocuments();

    res.status(200).json({
      recargas,
      paginacion: {
        pagina: parseInt(page, 10),
        totalPaginas: Math.ceil(total / parseInt(limit, 10)),
        totalRecargas: total,
        limite: parseInt(limit, 10)
      }
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error obteniendo recargas masivas', error: error.message });
  }
};

// Revertir recarga masiva
exports.revertirRecargaMasiva = async (req, res) => {
  try {
    const { recargaMasivaId } = req.params;
    const recargaMasiva = await RecargaMasiva.findById(recargaMasivaId);

    if (!recargaMasiva) {
      return res.status(404).json({ mensaje: 'Recarga masiva no encontrada' });
    }

    if (recargaMasiva.revertida) {
      return res.status(400).json({ mensaje: 'Esta recarga masiva ya ha sido revertida' });
    }

    const montoDescontar = recargaMasiva.monto_individual;

    // Descontar saldo cuidando que no quede negativo si es posible
    await Billetera.updateMany(
      { activa: true },
      { $inc: { saldo: -montoDescontar } }
    );

    recargaMasiva.revertida = true;
    recargaMasiva.estado = 'revertido';
    await recargaMasiva.save();

    res.status(200).json({ mensaje: 'Recarga masiva revertida exitosamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al revertir recarga masiva', error: error.message });
  }
};

// Mantener métodos heredados por compatibilidad
exports.activarBilleterasMasivo = exports.activarBilleterasInactivas;
exports.recargaGeneral = exports.recargaGeneralUltraRapida;
exports.obtenerRecargasMasivasRevertidas = async (req, res) => {
  try {
    const recargas = await RecargaMasiva.find({ revertida: true }).sort({ fecha_ejecucion: -1 });
    res.status(200).json({ recargas });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};
exports.obtenerRecargasMasivasNoRevertidas = async (req, res) => {
  try {
    const recargas = await RecargaMasiva.find({ revertida: false }).sort({ fecha_ejecucion: -1 });
    res.status(200).json({ recargas });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};
exports.obtenerDetalleRecargaMasiva = async (req, res) => {
  try {
    const { id } = req.params;
    const recarga = await RecargaMasiva.findById(id);
    if (!recarga) return res.status(404).json({ mensaje: 'Recarga no encontrada' });
    res.status(200).json({ recarga });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};
exports.recargaMasivaFaltantes = exports.recargaGeneralUltraRapida;