const Aporte = require('../models/aporteModel');

// Crear un nuevo aporte
const crearAporte = async (req, res) => {
    const { usuarioId } = req.body;

    if (!usuarioId) {
        return res.status(400).json({ error: 'El ID del usuario es requerido' });
    }

    try {
        const { usuarioId, aporte } = req.body;
        const nuevoAporte = new Aporte({ usuarioId, aporte });
        await nuevoAporte.save();
        res.status(201).json(nuevoAporte);
    } catch (err) {
        res.status(500).json({ message: 'Error al crear el aporte' });
    }
};

// Obtener todos los aportes
const obtenerAportes = async (req, res) => {
    try {
        const aportes = await Aporte.find();
        res.status(200).json(aportes);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener los aportes' });
    }
};

// Obtener un aporte por ID
const obtenerAportePorId = async (req, res) => {
    const { id } = req.params;

    try {
        const aporte = await Aporte.findById(id);
        if (!aporte) {
            return res.status(404).json({ error: 'Aporte no encontrado' });
        }
        res.status(200).json(aporte);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener el aporte' });
    }
};

// Actualizar un aporte por ID
const actualizarAporte = async (req, res) => {
    const { id } = req.params;
    const { usuarioId, aporte } = req.body;

    try {
        const aporteActualizado = await Aporte.findByIdAndUpdate(id, { usuarioId, aporte }, { new: true });
        if (!aporteActualizado) {
            return res.status(404).json({ error: 'Aporte no encontrado' });
        }
        res.status(200).json(aporteActualizado);
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar el aporte' });
    }
};

// Eliminar un aporte por ID
const eliminarAporte = async (req, res) => {
    const { id } = req.params;

    try {
        const aporteEliminado = await Aporte.findByIdAndDelete(id);
        if (!aporteEliminado) {
            return res.status(404).json({ error: 'Aporte no encontrado' });
        }
        res.status(204).json();
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar el aporte' });
    }
};

module.exports = {
    crearAporte,
    obtenerAportes,
    obtenerAportePorId,
    actualizarAporte,
    eliminarAporte
};
