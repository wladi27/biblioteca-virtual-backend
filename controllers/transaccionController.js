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
