
// scripts/backupUsuarios.js
require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Usuario = require('../models/usuario');
const connectDB = require('../config/db');

const backupUsuarios = async () => {
  try {
    await connectDB();
    console.log('Conectado a la base de datos para realizar el backup.');

    const usuarios = await Usuario.find().lean();
    console.log(`Se encontraron ${usuarios.length} usuarios para respaldar.`);

    const backupDir = path.join(__dirname, '..', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const filePath = path.join(backupDir, `usuarios_backup_${Date.now()}.json`);
    fs.writeFileSync(filePath, JSON.stringify(usuarios, null, 2));

    console.log(`Backup de usuarios creado exitosamente en: ${filePath}`);

  } catch (error) {
    console.error('Error durante el backup:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Desconectado de la base de datos.');
  }
};

backupUsuarios();
