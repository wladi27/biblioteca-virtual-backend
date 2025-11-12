const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Usuario = require('../models/usuario');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const DB_URI = process.env.DB_URI;

async function importarYReparar() {
  try {
    if (!DB_URI) {
      throw new Error('La variable de entorno DB_URI no está definida.');
    }
    await mongoose.connect(DB_URI);
    console.log('Conectado a la base de datos para la importación y reparación.');

    // 1. Leer el archivo JSON
    const jsonPath = path.join(__dirname, '..', 'usuarios_exportados.json');
    if (!fs.existsSync(jsonPath)) {
        throw new Error(`El archivo usuarios_exportados.json no se encuentra. Ejecuta primero el script de exportación.`);
    }
    const usuariosData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    // 2. Limpiar la colección actual
    console.log('Limpiando la colección de usuarios...');
    await Usuario.deleteMany({});
    console.log('Colección "usuarios" limpiada.');

    // 3. Re-insertar usuarios y reconstruir la pirámide
    console.log(`Insertando y reparando la pirámide para ${usuariosData.length} usuarios...`);

    if (usuariosData.length === 0) {
      console.log('No hay usuarios para importar.');
      return;
    }

    // El primer usuario es la raíz
    let registrationCounter = 0; // Initialize registration counter
    const primerUsuarioData = usuariosData[0];
    const hashedPasswordRaiz = primerUsuarioData.contraseña; // Store the hashed password
    primerUsuarioData.contraseña = "dummy_password"; // Set a dummy password to satisfy required: true

    // Quitamos los campos de la pirámide vieja para reconstruirla
    delete primerUsuarioData.padre_id;
    delete primerUsuarioData.hijo1_id;
    delete primerUsuarioData.hijo2_id;
    delete primerUsuarioData.hijo3_id;
    delete primerUsuarioData.nivel;
    delete primerUsuarioData.nivel_piramide;
    
    registrationCounter++; // Increment for the root user
    const usuarioRaiz = new Usuario({
        ...primerUsuarioData,
        nivel: registrationCounter, // Assign registration order
        nivel_piramide: 1, // Depth in pyramid
        padre_id: null,
    });
    await usuarioRaiz.save();
    // Now update the password directly with the original hashed password
    await Usuario.findByIdAndUpdate(usuarioRaiz._id, { contraseña: hashedPasswordRaiz }, { new: true, runValidators: false });
    console.log(`Usuario raíz ${usuarioRaiz.nombre_usuario} creado.`);

    // Estructura para mantener la pirámide en memoria y encontrar padres rápidamente
    const padresDisponibles = [usuarioRaiz];

    // Iterar sobre el resto de los usuarios
    for (let i = 1; i < usuariosData.length; i++) {
      const usuarioData = usuariosData[i];
      const hashedPassword = usuarioData.contraseña; // Store the hashed password
      usuarioData.contraseña = "dummy_password"; // Set a dummy password to satisfy required: true
      
      // El primer padre en la lista es el que tiene espacio
      const padreEncontrado = await Usuario.findById(padresDisponibles[0]._id);

      if (!padreEncontrado) {
          throw new Error(`No se encontró al padre esperado en la base de datos.`);
      }

      // Quitamos los campos de la pirámide vieja
      delete usuarioData.padre_id;
      delete usuarioData.hijo1_id;
      delete usuarioData.hijo2_id;
      delete usuarioData.hijo3_id;
      delete usuarioData.nivel;
      delete usuarioData.nivel_piramide;

      registrationCounter++; // Increment for each user in the loop
      const nuevoUsuario = new Usuario({
          ...usuarioData,
          padre_id: padreEncontrado._id,
          nivel: registrationCounter, // Assign registration order
          nivel_piramide: padreEncontrado.nivel_piramide + 1, // Depth in pyramid
      });
      await nuevoUsuario.save();
      // Now update the password directly with the original hashed password
      await Usuario.findByIdAndUpdate(nuevoUsuario._id, { contraseña: hashedPassword }, { new: true, runValidators: false });

      // Asignar como hijo
      if (!padreEncontrado.hijo1_id) {
        padreEncontrado.hijo1_id = nuevoUsuario._id;
      } else if (!padreEncontrado.hijo2_id) {
        padreEncontrado.hijo2_id = nuevoUsuario._id;
      } else {
        padreEncontrado.hijo3_id = nuevoUsuario._id;
      }
      await padreEncontrado.save();

      // Actualizar la lista de padres disponibles
      padresDisponibles.push(nuevoUsuario);

      // Si el padre actual ya está lleno, lo removemos de la lista de disponibles
      if (padreEncontrado.hijo1_id && padreEncontrado.hijo2_id && padreEncontrado.hijo3_id) {
        padresDisponibles.shift();
      }
      
      console.log(`Usuario ${nuevoUsuario.nombre_usuario} asignado como hijo de ${padreEncontrado.nombre_usuario}`);
    }

    console.log('¡Importación y reparación completadas exitosamente!');

  } catch (error) {
    console.error('Ocurrió un error durante el proceso:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Desconectado de la base de datos.');
  }
}

importarYReparar();
