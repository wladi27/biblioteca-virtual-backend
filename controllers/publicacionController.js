const Publicacion = require('../models/publicacionModel');

// Crear una nueva publicación
exports.crearPublicacion = async (req, res) => {
  try {
    const { titulo, descripcion, status, file } = req.body; // Recibimos la URL del archivo
    const nuevaPublicacion = new Publicacion({
      titulo,
      descripcion,
      status,
      file, // Guardamos la URL del archivo
    });
    await nuevaPublicacion.save();
    res.status(201).json(nuevaPublicacion);
  } catch (error) {
    res.status(500).json({ message: 'Error al crear la publicación', error: error.message });
  }
};

// Obtener todas las publicaciones
exports.obtenerPublicaciones = async (req, res) => {
  try {
    const publicaciones = await Publicacion.find().sort({ createdAt: -1 });
    res.status(200).json(publicaciones);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener publicaciones', error: error.message });
  }
};

// Actualizar una publicación por ID
exports.actualizarPublicacion = async (req, res) => {
  try {
    const { titulo, descripcion, status, file } = req.body; // Recibimos la URL del archivo
    const actualizacion = { titulo, descripcion, status, file }; // Actualizamos el archivo si se envía

    const publicacionActualizada = await Publicacion.findByIdAndUpdate(
      req.params.id,
      actualizacion,
      { new: true }
    );
    if (!publicacionActualizada) {
      return res.status(404).json({ message: 'Publicación no encontrada' });
    }
    res.status(200).json(publicacionActualizada);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar la publicación', error: error.message });
  }
};

// Eliminar una publicación por ID
exports.eliminarPublicacion = async (req, res) => {
  try {
    const publicacion = await Publicacion.findByIdAndDelete(req.params.id);
    if (!publicacion) {
      return res.status(404).json({ message: 'Publicación no encontrada' });
    }
    res.status(200).json({ message: 'Publicación eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar la publicación', error: error.message });
  }
};
