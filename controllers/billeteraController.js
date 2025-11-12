const Billetera = require('../models/billetera');
const Transaccion = require('../models/transaccion');
const Usuario = require('../models/usuario'); 

// Verificar el estado de la billetera
exports.verificarEstado = async (req, res) => {
  try {
    const { usuarioId } = req.params; // Obtener el usuarioId de los parámetros de la URL
    const billetera = await Billetera.findOne({ usuario_id: usuarioId });

    if (!billetera) {
      return res.status(404).json({ activa: false });
    }

    res.status(200).json({ activa: billetera.activa });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};

// Obtener información de la billetera
exports.obtenerBilletera = async (req, res) => {
  try {
    const { usuarioId } = req.params; // Obtener el usuarioId de los parámetros de la URL
    const billetera = await Billetera.findOne({ usuario_id: usuarioId });

    if (!billetera) {
      return res.status(404).json({ mensaje: 'Billetera no encontrada' });
    }

    // Retornar datos de la billetera
    res.status(200).json({
      _id: billetera._id,
      saldo: billetera.saldo,
      activa: billetera.activa,
      usuario_id: billetera.usuario_id,
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};


// Activar billetera
exports.activarBilletera = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const billeteraExistente = await Billetera.findOne({ usuario_id: usuarioId });

    if (billeteraExistente) {
      return res.status(400).json({ mensaje: 'La billetera ya está activada' });
    }

    const nuevaBilletera = new Billetera({ usuario_id: usuarioId, activa: true });
    await nuevaBilletera.save();

    res.status(201).json({ mensaje: 'Billetera activada exitosamente', billetera: nuevaBilletera });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};

// Recargar billetera
exports.recargarBilletera = async (req, res) => {
  try {
    const { monto, usuarioId } = req.body; // Obtener monto y usuarioId del cuerpo de la solicitud

    if (!usuarioId) {
      return res.status(400).json({ mensaje: 'El ID del usuario es requerido' });
    }

    if (monto === undefined || monto === null || isNaN(parseFloat(monto)) || parseFloat(monto) <= 0) {
      return res.status(400).json({ mensaje: 'El monto debe ser un número mayor que 0' });
    }

    const billetera = await Billetera.findOne({ usuario_id: usuarioId });

    if (!billetera || !billetera.activa) {
      return res.status(404).json({ mensaje: 'Billetera no encontrada o no activa para este usuario' });
    }

    billetera.saldo += parseFloat(monto);
    await billetera.save();

    const nuevaTransaccion = new Transaccion({
      usuario_id: usuarioId,
      tipo: 'recarga',
      monto: parseFloat(monto),
      descripcion: `Recarga de ${monto} realizada`,
    });
    await nuevaTransaccion.save();

    res.status(200).json({ mensaje: 'Recarga exitosa', saldo: billetera.saldo });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};

// Enviar dinero
exports.enviarDinero = async (req, res) => {
  try {
    const { destinatario_id, monto } = req.body;
    const usuarioId = req.user.id;

    if (!destinatario_id) return res.status(400).json({ mensaje: 'destinatario_id es requerido' });
    if (!monto || isNaN(parseFloat(monto)) || parseFloat(monto) <= 0) return res.status(400).json({ mensaje: 'Monto inválido' });

    const cantidad = parseFloat(monto);

    // Decrementar saldo del emisor de forma atómica
    const billeteraEmisor = await Billetera.findOneAndUpdate(
      { usuario_id: usuarioId, activa: true, saldo: { $gte: cantidad } },
      { $inc: { saldo: -cantidad } },
      { new: true }
    );

    if (!billeteraEmisor) {
      return res.status(400).json({ mensaje: 'Saldo insuficiente o billetera no activa' });
    }

    // Incrementar saldo del receptor
    const billeteraReceptor = await Billetera.findOneAndUpdate(
      { usuario_id: destinatario_id, activa: true },
      { $inc: { saldo: cantidad } },
      { new: true }
    );

    // Si receptor no existe o no está activo, revertir débito del emisor
    if (!billeteraReceptor) {
      try {
        await Billetera.findOneAndUpdate({ usuario_id: usuarioId }, { $inc: { saldo: cantidad } });
      } catch (err) {
        console.error('Error al revertir débito tras fallo en receptor:', err.message);
      }
      return res.status(404).json({ mensaje: 'Billetera receptora no encontrada o no activa' });
    }

    // Registrar transacciones
    const transaccionEmisor = new Transaccion({
      usuario_id: usuarioId,
      tipo: 'envio',
      monto: cantidad,
      descripcion: `Envío de COP ${cantidad} al usuario ${destinatario_id}`,
      estado: 'aprobado'
    });
    await transaccionEmisor.save();

    const transaccionReceptor = new Transaccion({
      usuario_id: destinatario_id,
      tipo: 'recibido',
      monto: cantidad,
      descripcion: `Recepción de COP ${cantidad} del usuario ${usuarioId}`,
      estado: 'aprobado'
    });
    await transaccionReceptor.save();

    res.status(200).json({ mensaje: 'Envío exitoso', saldo: billeteraEmisor.saldo });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};


// Retirar dinero
// Retirar dinero
exports.retirarDinero = async (req, res) => {
  try {
    const { monto } = req.body;
    const usuarioId = req.user.id;

    if (!monto || isNaN(parseFloat(monto)) || parseFloat(monto) <= 0) return res.status(400).json({ mensaje: 'Monto inválido' });

    const cantidad = parseFloat(monto);

    // Decrementar saldo de forma atómica
    const billetera = await Billetera.findOneAndUpdate(
      { usuario_id: usuarioId, activa: true, saldo: { $gte: cantidad } },
      { $inc: { saldo: -cantidad } },
      { new: true }
    );

    if (!billetera) {
      return res.status(400).json({ mensaje: 'Saldo insuficiente o billetera no activa' });
    }

    // Crear la transacción con estado pendiente
    const nuevaTransaccion = new Transaccion({
      usuario_id: usuarioId,
      tipo: 'retiro',
      monto: cantidad,
      descripcion: `Retiro de COP ${cantidad} realizado`,
      estado: 'pendiente', // Establecer estado como pendiente
    });
    await nuevaTransaccion.save();

    res.status(200).json({ mensaje: 'Retiro creado y saldo reservado', saldo: billetera.saldo, retiro: nuevaTransaccion });
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

// Activar billetera para todos los usuarios que no la tengan activa (optimizado)
exports.activarBilleterasMasivo = async (req, res) => {
  try {
    // 1. Activar todas las billeteras que ya existen pero están inactivas
    const resultadoUpdate = await Billetera.updateMany(
      { activa: false },
      { $set: { activa: true } }
    );
    const billeterasActualizadas = resultadoUpdate.modifiedCount;

    // 2. Encontrar usuarios que todavía no tienen billetera
    const usuarios = await Usuario.find().select('_id');
    const usuariosIds = usuarios.map(u => u._id);

    const billeterasExistentes = await Billetera.find({ usuario_id: { $in: usuariosIds } }).select('usuario_id');
    const usuariosConBilleteraIds = billeterasExistentes.map(b => b.usuario_id.toString());

    const usuariosSinBilleteraIds = usuariosIds.filter(id => !usuariosConBilleteraIds.includes(id.toString()));

    let billeterasCreadas = 0;
    // 3. Crear billeteras para los usuarios que no tienen una
    if (usuariosSinBilleteraIds.length > 0) {
      const nuevasBilleteras = usuariosSinBilleteraIds.map(id => ({
        usuario_id: id,
        saldo: 0,
        activa: true,
      }));
      const resultadoInsert = await Billetera.insertMany(nuevasBilleteras);
      billeterasCreadas = resultadoInsert.length;
    }

    res.status(200).json({ 
      mensaje: `Proceso completado. Billeteras activadas: ${billeterasActualizadas}. Billeteras nuevas creadas: ${billeterasCreadas}.`
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};

// Recargar saldo a todas las billeteras activas (optimizado)
exports.recargaGeneral = async (req, res) => {
  try {
    const { monto } = req.body;
    const montoFloat = parseFloat(monto);

    if (!monto || isNaN(montoFloat) || montoFloat <= 0) {
      return res.status(400).json({ mensaje: 'El monto debe ser un número mayor que 0' });
    }

    // Obtener todas las billeteras activas
    const billeterasActivas = await Billetera.find({ activa: true }).select('usuario_id');

    if (billeterasActivas.length === 0) {
      return res.status(200).json({ mensaje: 'No hay billeteras activas para recargar.' });
    }

    // Extraer los IDs de las billeteras a actualizar
    const billeterasIds = billeterasActivas.map(b => b._id);

    // 1. Actualizar los saldos en una sola operación
    await Billetera.updateMany(
      { _id: { $in: billeterasIds } },
      { $inc: { saldo: montoFloat } }
    );

    // 2. Crear las transacciones en un solo lote
    const transacciones = billeterasActivas.map(billetera => ({
      usuario_id: billetera.usuario_id,
      tipo: 'recarga',
      monto: montoFloat,
      descripcion: `Recarga general de ${monto}`,
    }));

    await Transaccion.insertMany(transacciones);

    res.status(200).json({ mensaje: `Recarga general realizada a ${billeterasActivas.length} billeteras` });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};

// Recargar billetera por referido directo
exports.recargarPorReferidoDirecto = async (req, res) => {
  try {
    const { usuarioId, nivel } = req.body; // ID del usuario que recibe el pago y el nivel del referido

    if (!usuarioId) {
      return res.status(400).json({ mensaje: 'El ID del usuario es requerido' });
    }

    // Validar que el nivel sea un número
    if (nivel === undefined || nivel === null || isNaN(parseInt(nivel))) {
      return res.status(400).json({ mensaje: 'El nivel es requerido y debe ser un número' });
    }

    // Determinar el monto basado en el nivel
    const monto = parseInt(nivel) >= 1792 ? 1400 : 500;

    const billetera = await Billetera.findOne({ usuario_id: usuarioId });

    if (!billetera || !billetera.activa) {
      return res.status(404).json({ mensaje: 'Billetera no encontrada o no activa para este usuario' });
    }

    billetera.saldo += monto;
    await billetera.save();

    const nuevaTransaccion = new Transaccion({
      usuario_id: usuarioId,
      tipo: 'recarga',
      monto: monto,
      descripcion: `Pago por referido directo de ${monto}`,
    });
    await nuevaTransaccion.save();

    res.status(200).json({ mensaje: 'Recarga por referido directo exitosa', saldo: billetera.saldo });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};