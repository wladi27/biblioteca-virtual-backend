const Transaccion = require('../models/transaccion');

// Obtener transacciones (todas o por usuario específico) con paginación
exports.obtenerTransacciones = async (req, res) => {
  try {
    const usuarioId = req.params.id;
    const limit = parseInt(req.query.limit) || 20; // Límite de 20 por defecto
    const skip = parseInt(req.query.skip) || 0;
    const tipo = req.query.tipo; // Nuevo: obtener el tipo de la consulta

    let query = {};
    if (usuarioId) {
      query = { usuario_id: usuarioId };
    }

    // Nuevo: si se especifica un tipo, añadirlo a la consulta
    if (tipo) {
      query.tipo = tipo;
    }

    // Obtener el total de transacciones para la paginación
    const total = await Transaccion.countDocuments(query);

    // Obtener las transacciones con paginación
    const transacciones = await Transaccion.find(query)
      .sort({ fecha: -1 })
      .skip(skip)
      .limit(limit);

    // Devolver las transacciones y el total
    return res.status(200).json({
      total,
      transacciones,
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};

// Obtener el total de transacciones
exports.obtenerTotalTransacciones = async (req, res) => {
  try {
    const total = await Transaccion.countDocuments();
    res.status(200).json({ total });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};

// Obtener solo las transacciones de tipo "recarga" con paginación
exports.obtenerRecargas = async (req, res) => {
  try {
    const usuarioId = req.params.id;
    const limit = parseInt(req.query.limit) || 20;
    const skip = parseInt(req.query.skip) || 0;

    let filtro = { tipo: 'recarga' };
    if (usuarioId) {
      filtro.usuario_id = usuarioId;
    }

    const recargas = await Transaccion
      .find(filtro)
      .sort({ fecha: -1 })
      .skip(skip)
      .limit(limit)
      .select('monto fecha usuario_id estado descripcion');

    // Devuelve siempre un array, aunque esté vacío (no 404)
    return res.status(200).json(recargas);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};

// Obtener solo las transacciones de tipo "retiro" con paginación
exports.obtenerRetiros = async (req, res) => {
  try {
    const usuarioId = req.params.id;
    const limit = parseInt(req.query.limit) || 20;
    const skip = parseInt(req.query.skip) || 0;

    let filtro = { tipo: 'retiro' };
    if (usuarioId) {
      filtro.usuario_id = usuarioId;
    }

    const retiros = await Transaccion
      .find(filtro)
      .sort({ fecha: -1 })
      .skip(skip)
      .limit(limit)
      .select('monto fecha usuario_id estado descripcion');

    // Devuelve siempre un array, aunque esté vacío (no 404)
    return res.status(200).json(retiros);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};

// Actualizar el estado de una transacción
exports.actualizarEstadoTransaccion = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    // Validar que el ID no esté vacío
    if (!id) {
      return res.status(400).json({ mensaje: 'ID de transacción es requerido' });
    }

    // Validar que el estado no esté vacío
    if (!estado) {
      return res.status(400).json({ mensaje: 'Estado es requerido' });
    }

    // Buscar la transacción y actualizar el estado
    const transaccionActualizada = await Transaccion.findByIdAndUpdate(
      id,
      { estado },
      { new: true } // Devuelve la transacción actualizada
    );

    // Verificar si se encontró y actualizó la transacción
    if (!transaccionActualizada) {
      return res.status(404).json({ mensaje: 'Transacción no encontrada' });
    }

    // Devolver la transacción actualizada
    return res.status(200).json(transaccionActualizada);
  } catch (error) {
    // Manejar errores específicos
    if (error.name === 'CastError') {
      return res.status(400).json({ mensaje: 'ID de transacción no válido' });
    }
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};

// Eliminar una transacción por ID
exports.eliminarTransaccion = async (req, res) => {
  try {
    const { id } = req.params;

    // Validar que el ID no esté vacío
    if (!id) {
      return res.status(400).json({ mensaje: 'ID de transacción es requerido' });
    }

    // Buscar y eliminar la transacción
    const transaccionEliminada = await Transaccion.findByIdAndDelete(id);

    // Verificar si se encontró y eliminó la transacción
    if (!transaccionEliminada) {
      return res.status(404).json({ mensaje: 'Transacción no encontrada' });
    }

    // Devolver confirmación de eliminación
    return res.status(200).json({ 
      mensaje: 'Transacción eliminada correctamente',
      transaccion: transaccionEliminada 
    });

  } catch (error) {
    // Manejar errores específicos
    if (error.name === 'CastError') {
      return res.status(400).json({ mensaje: 'ID de transacción no válido' });
    }
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};

// En transaccionController.js - modificar obtenerRetiros
exports.obtenerRetirosUsuarios = async (req, res) => {
  try {
    const usuarioId = req.params.id;
    const { estado, fecha_inicio, fecha_fin, limit = 20, skip = 0 } = req.query;
    
    let filtro = { tipo: 'retiro' };
    
    if (usuarioId) filtro.usuario_id = usuarioId;
    if (estado) filtro.estado = estado;
    if (fecha_inicio && fecha_fin) {
      filtro.fecha = {
        $gte: new Date(fecha_inicio),
        $lte: new Date(fecha_fin)
      };
    }
    
    const retiros = await Transaccion.find(filtro)
      .sort({ fecha: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .select('monto fecha usuario_id estado descripcion');
    
    return res.status(200).json(retiros);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};