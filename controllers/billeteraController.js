const Billetera = require('../models/billetera');
const Transaccion = require('../models/transaccion');
const Usuario = require('../models/usuario');
const RecargaMasiva = require('../models/recargaMasiva');

// ID fijo del administrador
const ADMIN_ID = '68b9ad3ec732b1c4a5a33541';

// Verificar el estado de la billetera
exports.verificarEstado = async (req, res) => {
  try {
    const { usuarioId } = req.params;
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
    const { usuarioId } = req.params;
    const billetera = await Billetera.findOne({ usuario_id: usuarioId });

    if (!billetera) {
      return res.status(404).json({ mensaje: 'Billetera no encontrada' });
    }

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

// Recargar billetera INDIVIDUAL
exports.recargarBilletera = async (req, res) => {
  try {
    const { monto, usuarioId } = req.body;

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
      descripcion: `Recarga individual de ${monto}`,
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

    const billeteraEmisor = await Billetera.findOne({ usuario_id: usuarioId });
    const billeteraReceptor = await Billetera.findOne({ usuario_id: destinatario_id });

    if (!billeteraEmisor || !billeteraReceptor || !billeteraEmisor.activa || !billeteraReceptor.activa) {
      return res.status(404).json({ mensaje: 'Billetera no encontrada o no activa' });
    }

    const transaccionEmisor = new Transaccion({
      usuario_id: usuarioId,
      tipo: 'envio',
      monto: monto,
      descripcion: `Envío de COP ${monto} al usuario ${destinatario_id}`,
    });
    await transaccionEmisor.save();

    const transaccionReceptor = new Transaccion({
      usuario_id: destinatario_id,
      tipo: 'recibido',
      monto: monto,
      descripcion: `Recepción de COP ${monto} del usuario ${usuarioId}`,
    });
    await transaccionReceptor.save();

    res.status(200).json({ mensaje: 'Envío exitoso', saldo: billeteraEmisor.saldo });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};

// Retirar dinero
exports.retirarDinero = async (req, res) => {
  try {
    const { monto } = req.body;
    const usuarioId = req.user.id;

    const billetera = await Billetera.findOne({ usuario_id: usuarioId });

    if (!billetera || !billetera.activa) {
      return res.status(404).json({ mensaje: 'Billetera no encontrada o no activa' });
    }

    const nuevaTransaccion = new Transaccion({
      usuario_id: usuarioId,
      tipo: 'retiro',
      monto: monto,
      descripcion: `Retiro de COP ${monto} realizado`,
      estado: 'pendiente',
    });
    await nuevaTransaccion.save();

    billetera.saldo -= monto;
    await billetera.save();

    res.status(200).json({ mensaje: 'Retiro exitoso', saldo: billetera.saldo });
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

// Activar SOLO billeteras inactivas (Optimizado)
exports.activarBilleterasInactivas = async (req, res) => {
  try {
    console.time('activarBilleterasInactivas');
    
    const usuariosNecesitanActivacion = await Usuario.aggregate([
      {
        $lookup: {
          from: 'billeteras',
          localField: '_id',
          foreignField: 'usuario_id',
          as: 'billeteraInfo'
        }
      },
      {
        $match: {
          $or: [
            { billeteraInfo: { $eq: [] } },
            { 'billeteraInfo.activa': false }
          ]
        }
      },
      {
        $project: {
          _id: 1,
          tieneBilletera: { $gt: [{ $size: '$billeteraInfo' }, 0] },
          billeteraId: { $arrayElemAt: ['$billeteraInfo._id', 0] }
        }
      }
    ]);

    if (usuariosNecesitanActivacion.length === 0) {
      return res.status(200).json({ 
        mensaje: 'Todas las billeteras ya están activas', 
        activadas: 0,
        totalProcesadas: 0
      });
    }

    let activadas = 0;
    const batchSize = 100;
    const resultados = [];

    for (let i = 0; i < usuariosNecesitanActivacion.length; i += batchSize) {
      const batch = usuariosNecesitanActivacion.slice(i, i + batchSize);
      const promesasBatch = [];

      for (const usuario of batch) {
        if (usuario.tieneBilletera) {
          promesasBatch.push(
            Billetera.findByIdAndUpdate(
              usuario.billeteraId,
              { activa: true },
              { new: true }
            ).then(() => {
              activadas++;
              return { usuarioId: usuario._id, accion: 'activada' };
            })
          );
        } else {
          promesasBatch.push(
            new Billetera({
              usuario_id: usuario._id,
              activa: true,
              saldo: 0
            }).save().then(() => {
              activadas++;
              return { usuarioId: usuario._id, accion: 'creada' };
            })
          );
        }
      }

      const batchResultados = await Promise.all(promesasBatch);
      resultados.push(...batchResultados);

      if (i + batchSize < usuariosNecesitanActivacion.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    console.timeEnd('activarBilleterasInactivas');

    res.status(200).json({
      mensaje: `Proceso completado: ${activadas} billeteras activadas/creadas`,
      activadas: activadas,
      totalProcesadas: usuariosNecesitanActivacion.length,
      detalles: resultados.slice(0, 10)
    });

  } catch (error) {
    console.error('Error en activarBilleterasInactivas:', error);
    res.status(500).json({ 
      mensaje: 'Error en el servidor', 
      error: error.message 
    });
  }
};

// Recarga masiva ULTRA RÁPIDA con nuevo tipo recarga_masiva
exports.recargaGeneralUltraRapida = async (req, res) => {
  let recargaMasiva;
  
  try {
    console.time('recargaGeneralUltraRapida');
    const { monto } = req.body;

    if (!monto || isNaN(parseFloat(monto)) || parseFloat(monto) <= 0) {
      return res.status(400).json({ mensaje: 'El monto debe ser un número mayor que 0' });
    }

    const montoNumero = parseFloat(monto);
    
    // 1. Contar billeteras activas
    const totalBilleteras = await Billetera.countDocuments({ activa: true });
    
    if (totalBilleteras === 0) {
      return res.status(404).json({ mensaje: 'No hay billeteras activas para recargar' });
    }

    // 2. Crear registro de recarga masiva con ID fijo del admin
    recargaMasiva = new RecargaMasiva({
      monto_individual: montoNumero,
      total_billeteras: totalBilleteras,
      monto_total: montoNumero * totalBilleteras,
      ejecutado_por: ADMIN_ID,
      estado: 'procesando'
    });
    await recargaMasiva.save();

    // 3. Actualizar TODAS las billeteras activas
    const resultado = await Billetera.updateMany(
      { activa: true },
      { $inc: { saldo: montoNumero } }
    );

    // 4. Crear TRANSACCIÓN PRINCIPAL de recarga masiva
    const transaccionPrincipal = new Transaccion({
      usuario_id: ADMIN_ID,
      tipo: 'recarga_masiva',
      monto: montoNumero * resultado.modifiedCount,
      descripcion: `RECARGA MASIVA: ${montoNumero} cargado individualmente a ${resultado.modifiedCount} billeteras activas`,
      estado: 'aprobado',
      recarga_masiva_id: recargaMasiva._id,
      es_recarga_masiva: true
    });
    await transaccionPrincipal.save();

    // 5. Actualizar recarga masiva con la transacción principal
    recargaMasiva.transaccion_principal_id = transaccionPrincipal._id;
    recargaMasiva.estado = 'completado';
    await recargaMasiva.save();

    // 6. Crear transacciones individuales en background
    this.crearTransaccionesIndividualesBackground(recargaMasiva._id, montoNumero);

    console.timeEnd('recargaGeneralUltraRapida');

    res.status(200).json({
      mensaje: `✅ Recarga masiva completada exitosamente`,
      recarga_masiva_id: recargaMasiva._id,
      billeterasAfectadas: resultado.modifiedCount,
      totalBilleteras: totalBilleteras,
      montoIndividual: montoNumero,
      montoTotal: montoNumero * resultado.modifiedCount,
      transaccionPrincipal: transaccionPrincipal._id,
      ejecutado_por: ADMIN_ID,
      tiempo: '2-3 segundos (máximo)'
    });

  } catch (error) {
    console.error('Error en recargaGeneralUltraRapida:', error);
    
    // Revertir recarga masiva si falló
    if (recargaMasiva && recargaMasiva._id) {
      await RecargaMasiva.findByIdAndUpdate(recargaMasiva._id, { estado: 'fallido' });
    }
    
    res.status(500).json({ 
      mensaje: 'Error en el servidor', 
      error: error.message 
    });
  }
};

// Método para crear transacciones individuales en background
exports.crearTransaccionesIndividualesBackground = async (recargaMasivaId, monto) => {
  try {
    setTimeout(async () => {
      try {
        console.log(`🔄 Iniciando creación de transacciones individuales para recarga masiva: ${recargaMasivaId}`);
        
        const billeteras = await Billetera.find({ activa: true }).select('usuario_id');
        const batchSize = 100;
        let totalCreadas = 0;
        
        for (let i = 0; i < billeteras.length; i += batchSize) {
          const batch = billeteras.slice(i, i + batchSize);
          const transaccionesBatch = batch.map(billetera => ({
            usuario_id: billetera.usuario_id,
            tipo: 'recarga',
            monto: monto,
            descripcion: `Recarga masiva individual de ${monto}`,
            recarga_masiva_id: recargaMasivaId,
            es_recarga_masiva: true,
            fecha: new Date(),
            estado: 'aprobado'
          }));
          
          await Transaccion.insertMany(transaccionesBatch);
          totalCreadas += transaccionesBatch.length;
          console.log(`📊 Transacciones individuales creadas: ${totalCreadas}/${billeteras.length}`);
        }
        
        console.log(`✅ Transacciones individuales completadas para recarga masiva: ${recargaMasivaId} - Total: ${totalCreadas}`);
      } catch (error) {
        console.error('❌ Error creando transacciones individuales:', error);
      }
    }, 2000);
    
  } catch (error) {
    console.error('Error en crearTransaccionesIndividualesBackground:', error);
  }
};

// Obtener historial de recargas masivas
exports.obtenerRecargasMasivas = async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const recargas = await RecargaMasiva.find()
      .populate('ejecutado_por', 'nombre email')
      .populate('transaccion_principal_id', 'monto descripcion fecha')
      .sort({ fecha_ejecucion: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await RecargaMasiva.countDocuments();

    res.status(200).json({
      recargas,
      paginacion: {
        pagina: parseInt(page),
        totalPaginas: Math.ceil(total / parseInt(limit)),
        totalRecargas: total,
        limite: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error obteniendo recargas masivas', error: error.message });
  }
};

// Obtener detalle de una recarga masiva específica
exports.obtenerDetalleRecargaMasiva = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const recarga = await RecargaMasiva.findById(id)
      .populate('ejecutado_por', 'nombre email')
      .populate('transaccion_principal_id', 'monto descripcion fecha');

    if (!recarga) {
      return res.status(404).json({ mensaje: 'Recarga masiva no encontrada' });
    }

    // Obtener transacciones individuales de esta recarga masiva
    const transaccionesIndividuales = await Transaccion.find({
      recarga_masiva_id: id,
      tipo: 'recarga'
    })
    .populate('usuario_id', 'nombre email')
    .sort({ fecha: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const totalTransacciones = await Transaccion.countDocuments({
      recarga_masiva_id: id,
      tipo: 'recarga'
    });

    res.status(200).json({
      recarga,
      transaccionesIndividuales: {
        datos: transaccionesIndividuales,
        paginacion: {
          pagina: parseInt(page),
          totalPaginas: Math.ceil(totalTransacciones / parseInt(limit)),
          totalTransacciones: totalTransacciones,
          limite: parseInt(limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error obteniendo detalle', error: error.message });
  }
};

// Recargar billetera por referido directo
exports.recargarPorReferidoDirecto = async (req, res) => {
  try {
    const { usuarioId, nivel } = req.body;

    if (!usuarioId) {
      return res.status(400).json({ mensaje: 'El ID del usuario es requerido' });
    }

    if (nivel === undefined || nivel === null || isNaN(parseInt(nivel))) {
      return res.status(400).json({ mensaje: 'El nivel es requerido y debe ser un número' });
    }

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

// Mantener métodos originales por compatibilidad
exports.activarBilleterasMasivo = async (req, res) => {
  try {
    const usuarios = await Usuario.find();
    let activadas = 0;
    
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

// Método original (con transacciones individuales - lento)
exports.recargaGeneral = async (req, res) => {
  try {
    const { monto } = req.body;
    if (!monto || isNaN(parseFloat(monto)) || parseFloat(monto) <= 0) {
      return res.status(400).json({ mensaje: 'El monto debe ser un número mayor que 0' });
    }
    
    const billeteras = await Billetera.find({ activa: true });

    if (billeteras.length === 0) {
      return res.status(404).json({ mensaje: 'No hay billeteras activas para recargar' });
    }


    const promesas = billeteras.map(async (billetera) => {
      billetera.saldo += parseFloat(monto);
      await billetera.save();
      
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

    const transacciones = await Transaccion.find({ recarga_masiva_id: recargaMasivaId });

    const promesas = transacciones.map(async (transaccion) => {
      const billetera = await Billetera.findOne({ usuario_id: transaccion.usuario_id });
      if (billetera) {
        billetera.saldo -= transaccion.monto;
        await billetera.save();
      }
    });

    await Promise.all(promesas);

    recargaMasiva.revertida = true;
    await recargaMasiva.save();

    res.status(200).json({ mensaje: 'Recarga masiva revertida exitosamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};

exports.obtenerRecargasMasivasRevertidas = async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const recargas = await RecargaMasiva.find({ revertida: true })
      .populate('ejecutado_por', 'nombre email')
      .populate('transaccion_principal_id', 'monto descripcion fecha')
      .sort({ fecha_ejecucion: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await RecargaMasiva.countDocuments({ revertida: true });

    res.status(200).json({
      recargas,
      paginacion: {
        pagina: parseInt(page),
        totalPaginas: Math.ceil(total / parseInt(limit)),
        totalRecargas: total,
        limite: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error obteniendo recargas masivas revertidas', error: error.message });
  }
};

exports.obtenerRecargasMasivasNoRevertidas = async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const recargas = await RecargaMasiva.find({ revertida: false })
      .populate('ejecutado_por', 'nombre email')
      .populate('transaccion_principal_id', 'monto descripcion fecha')
      .sort({ fecha_ejecucion: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await RecargaMasiva.countDocuments({ revertida: false });

    res.status(200).json({
      recargas,
      paginacion: {
        pagina: parseInt(page),
        totalPaginas: Math.ceil(total / parseInt(limit)),
        totalRecargas: total,
        limite: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error obteniendo recargas masivas no revertidas', error: error.message });
  }
};

// Método específico para pagar comisiones por referidos
exports.pagarComisionReferido = async (patrocinadorId, montoComision, solicitanteNombre) => {
  try {
    const billeteraPatrocinador = await Billetera.findOne({ usuario_id: patrocinadorId });
    
    if (!billeteraPatrocinador || !billeteraPatrocinador.activa) {
      throw new Error('Billetera del patrocinador no encontrada o inactiva');
    }

    // Añadir comisión a la billetera
    billeteraPatrocinador.saldo += montoComision;
    await billeteraPatrocinador.save();

    // Crear transacción de comisión
    const transaccionComision = new Transaccion({
      usuario_id: patrocinadorId,
      tipo: 'comision_referido',
      monto: montoComision,
      descripcion: `Comisión por referido directo - Usuario: ${solicitanteNombre}`,
      estado: 'aprobado'
    });
    await transaccionComision.save();

    return { 
      success: true, 
      nuevoSaldo: billeteraPatrocinador.saldo,
      transaccionId: transaccionComision._id 
    };
  } catch (error) {
    console.error('Error en pagarComisionReferido:', error);
    throw error;
  }
};