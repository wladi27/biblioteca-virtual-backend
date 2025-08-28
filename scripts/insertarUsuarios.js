const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Usuario = require('../models/usuario'); // Asegúrate de que la ruta sea correcta

// Carga las variables de entorno desde el archivo .env en la raíz del proyecto
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const DB_URI = process.env.DB_URI; // Obtiene la URI desde las variables de entorno

async function importarUsuarios() {
  try {
    if (!DB_URI) {
      throw new Error('La variable de entorno DB_URI no está definida. Asegúrate de tener un archivo .env en la raíz del proyecto.');
    }
    await mongoose.connect(DB_URI);
    console.log('Conectado a la base de datos para la importación.');

    // 1. Limpiar la colección actual para evitar duplicados
    console.log('Limpiando la colección de usuarios...');
    await Usuario.deleteMany({});
    console.log('Colección "usuarios" limpiada.');

    // 2. Leer el archivo JSON
    const jsonPath = path.join(__dirname, '..', 'usuarios.json');
    const usuariosData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    // 3. Transformar los IDs de string a ObjectId
    const usuariosParaInsertar = usuariosData.map(user => {
      if (user._id && typeof user._id === 'string') {
        user._id = new mongoose.Types.ObjectId(user._id);
      }
      if (user.padre_id && typeof user.padre_id === 'string') {
        user.padre_id = new mongoose.Types.ObjectId(user.padre_id);
      }
      if (user.hijo1_id && typeof user.hijo1_id === 'string') {
        user.hijo1_id = new mongoose.Types.ObjectId(user.hijo1_id);
      }
      if (user.hijo2_id && typeof user.hijo2_id === 'string') {
        user.hijo2_id = new mongoose.Types.ObjectId(user.hijo2_id);
      }
      if (user.hijo3_id && typeof user.hijo3_id === 'string') {
        user.hijo3_id = new mongoose.Types.ObjectId(user.hijo3_id);
      }
      
      // Mongoose añade su propio campo __v, es mejor quitar el del JSON
      delete user.__v;

      return user;
    });

    // 4. Insertar los datos corregidos
    console.log(`Insertando ${usuariosParaInsertar.length} usuarios con IDs corregidos...`);
    // Usamos insertMany porque es rápido y no activa el hook 'pre-save' que re-hashearía las contraseñas.
    await Usuario.insertMany(usuariosParaInsertar, { ordered: false });

    console.log('¡Importación completada exitosamente!');

  } catch (error) {
    console.error('Ocurrió un error durante la importación:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Desconectado de la base de datos.');
  }
}

importarUsuarios();
