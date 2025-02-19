// controllers/publicacionController.js
const Publicacion = require('../models/publicacionModel');
const path = require('path');
const fs = require('fs');

// Crear una nueva publicación
const crearPublicacion = async (req, res) => {
    const { titulo, descripcion, status } = req.body;
    const file = req.file; // Archivo subido

    if (!file) {
        return res.status(400).json({ error: 'El archivo es requerido' });
    }

    try {
        const nuevaPublicacion = new Publicacion({
            titulo,
            file: file.path, // Guardar la ruta del archivo
            descripcion,
            status
        });
        await nuevaPublicacion.save();
        res.status(201).json(nuevaPublicacion);
    } catch (error) {
        res.status(500).json({ error: 'Error al guardar la publicación' });
    }
};

// Obtener todas las publicaciones
const obtenerPublicaciones = async (req, res) => {
    try {
        const publicaciones = await Publicacion.find();
        res.status(200).json(publicaciones);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener las publicaciones' });
    }
};

// Obtener una publicación por ID
const obtenerPublicacionPorId = async (req, res) => {
    const { id } = req.params;

    try {
        const publicacion = await Publicacion.findById(id);
        if (!publicacion) {
            return res.status(404).json({ error: 'Publicación no encontrada' });
        }
        res.status(200).json(publicacion);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener la publicación' });
    }
};

// Actualizar una publicación por ID
const actualizarPublicacion = async (req, res) => {
    const { id } = req.params;
    const { titulo, descripcion, status } = req.body;
    const file = req.file; // Archivo subido

    try {
        const actualizacion = { titulo, descripcion, status };
        if (file) {
            actualizacion.file = file.path; // Actualizar la ruta del archivo si se subió uno nuevo
        }

        const publicacionActualizada = await Publicacion.findByIdAndUpdate(id, actualizacion, { new: true });
        if (!publicacionActualizada) {
            return res.status(404).json({ error: 'Publicación no encontrada' });
        }
        res.status(200).json(publicacionActualizada);
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar la publicación' });
    }
};

// Eliminar una publicación por ID
const eliminarPublicacion = async (req, res) => {
    const { id } = req.params;

    try {
        const publicacionEliminada = await Publicacion.findByIdAndDelete(id);
        if (!publicacionEliminada) {
            return res.status(404).json({ error: 'Publicación no encontrada' });
        }
        // Eliminar el archivo del sistema de archivos
        fs.unlink(publicacionEliminada.file, (err) => {
            if (err) console.error('Error al eliminar el archivo:', err);
        });
        res.status(204).json();
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar la publicación' });
    }
};

module.exports = {
    crearPublicacion,
    obtenerPublicaciones,
    obtenerPublicacionPorId,
    actualizarPublicacion,
    eliminarPublicacion
};
