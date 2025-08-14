const Transaccion = require('../models/transaccion');

// Obtener transacciones (todas o por usuario específico)
exports.obtenerTransacciones = async (req, res) => {
  try {
    // Obtener el ID del usuario desde los parámetros de la URL (si está presente)
    const usuarioId = req.params.id;

    if (usuarioId) {
      // Validar que el ID no esté vacío
      if (!usuarioId) {
        return res.status(400).json({ mensaje: 'ID de usuario es requerido' });
      }

      // Obtener las transacciones del usuario específico, ordenadas por fecha (más recientes primero)
      const transacciones = await Transaccion.find({ usuario_id: usuarioId }).sort({ fecha: -1 });

      // Verificar si se encontraron transacciones
      if (transacciones.length === 0) {
        return res.status(404).json({ mensaje: 'No se encontraron transacciones para este usuario' });
      }

      // Devolver las transacciones encontradas
      return res.status(200).json(transacciones);
    } else {
      // Obtener todas las transacciones, ordenadas por fecha (más recientes primero)
      const transacciones = await Transaccion.find().sort({ fecha: -1 });

      // Verificar si se encontraron transacciones
      if (transacciones.length === 0) {
        return res.status(404).json({ mensaje: 'No se encontraron transacciones' });
      }

      // Devolver las transacciones encontradas
      return res.status(200).json(transacciones);
    }
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