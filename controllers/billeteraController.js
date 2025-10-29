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
    const usuarios = await Usuario.find();
    let activadas = 0;
    // Creamos un array de promesas para procesar en paralelo
    const promesas = usuarios.map(async (usuario) => {
      let billetera = await Billetera.findOne({ usuario_id: usuario._id });
      if (!billetera) {
        billetera = new Billetera({ usuario_id: usuario._id, activa: true });
        await billetera.save();
        activadas++;
      } else if (!billetera.activa) {
        billetera.activa = true;
        await billetera.save();
        activadas++;
      }
    });
    await Promise.all(promesas);
    res.status(200).json({ mensaje: `Billeteras activadas o actualizadas: ${activadas}` });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};

// Recargar saldo a todas las billeteras activas (optimizado)
exports.recargaGeneral = async (req, res) => {
  try {
    const { monto } = req.body;
    if (!monto || isNaN(parseFloat(monto)) || parseFloat(monto) <= 0) {
      return res.status(400).json({ mensaje: 'El monto debe ser un número mayor que 0' });
    }
    const billeteras = await Billetera.find({ activa: true });
    const promesas = billeteras.map(async (billetera) => {
      billetera.saldo += parseFloat(monto);
      await billetera.save();
      // Registrar transacción de recarga masiva
      const nuevaTransaccion = new Transaccion({
        usuario_id: billetera.usuario_id,
        tipo: 'recarga',
        monto: parseFloat(monto),
        descripcion: `Recarga general de ${monto}`,
      });
      await nuevaTransaccion.save();
    });
    await Promise.all(promesas);
    res.status(200).json({ mensaje: `Recarga general realizada a ${billeteras.length} billeteras` });
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