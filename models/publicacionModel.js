// models/publicacionModel.js
const mongoose = require('mongoose');

const publicacionSchema = new mongoose.Schema({
    titulo: { type: String, required: true },
    file: { type: String, required: true }, // Ruta del archivo
    descripcion: { type: String, required: true },
    status: { type: String, enum: ['activo', 'inactivo'], default: 'activo' },
    fecha: { type: Date, default: Date.now }
});

const Publicacion = mongoose.model('Publicacion', publicacionSchema);

module.exports = Publicacion;
