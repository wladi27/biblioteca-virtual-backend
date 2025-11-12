const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Usuario = require('../models/usuario');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const DB_URI = process.env.DB_URI;

async function exportarUsuarios() {
  try {
    if (!DB_URI) {
      throw new Error('La variable de entorno DB_URI no está definida.');
    }
    await mongoose.connect(DB_URI);
    console.log('Conectado a la base de datos para la exportación.');

    // Obtener todos los usuarios, ordenados por ID (fecha de creación)
    const usuarios = await Usuario.find().sort({ _id: 1 }).lean();

    // Guardar en un archivo JSON
    const outputPath = path.join(__dirname, '..', 'usuarios_exportados.json');
    fs.writeFileSync(outputPath, JSON.stringify(usuarios, null, 2));

    console.log(`Se han exportado ${usuarios.length} usuarios a ${outputPath}`);

  } catch (error) {
    console.error('Ocurrió un error durante la exportación:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Desconectado de la base de datos.');
  }
}

exportarUsuarios();
