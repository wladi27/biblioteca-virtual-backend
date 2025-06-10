const Publicacion = require('../models/publicacionModel');

// Crear una nueva publicación
exports.crearPublicacion = async (req, res) => {
  try {
    const { titulo, descripcion, status } = req.body;
    const fileUrl = req.file ? req.file.path : null; // URL pública de Cloudinary
    const nuevaPublicacion = new Publicacion({
      titulo,
      descripcion,
      status,
      file: fileUrl,
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

// Obtener una publicación por ID
exports.obtenerPublicacionPorId = async (req, res) => {
  try {
    const publicacion = await Publicacion.findById(req.params.id);
    if (!publicacion) {
      return res.status(404).json({ message: 'Publicación no encontrada' });
    }
    res.status(200).json(publicacion);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener la publicación', error: error.message });
  }
};

// Actualizar una publicación por ID
exports.actualizarPublicacion = async (req, res) => {
  try {
    const { titulo, descripcion, status } = req.body;
    const fileUrl = req.file ? req.file.path : undefined; // Solo si hay nuevo archivo

    const actualizacion = { titulo, descripcion, status };
    if (fileUrl) actualizacion.file = fileUrl;

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