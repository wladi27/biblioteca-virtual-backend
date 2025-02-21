const mongoose = require('mongoose');

// Reemplaza estos valores con tus credenciales
const usuario = '<usuario>'; // Tu usuario de MongoDB
const contraseña = '<contraseña>'; // Tu contraseña de MongoDB
const cluster = '<cluster>'; // Tu nombre de clúster
const baseDeDatos = 'test'; // Nombre de tu base de datos

// URL de conexión
const uri = 'mongodb+srv://wladimir:W27330449@mls.s2hdk.mongodb.net/?retryWrites=true&w=majority&appName=mls';

// Conectar a MongoDB
mongoose.connect(uri)
  .then(() => {
    console.log('Conectado a la base de datos');
    
    // Eliminar el índice para el campo dni
    return mongoose.connection.db.collection('usuarios').dropIndex('dni_1');
  })
  .then(result => {
    console.log('Índice eliminado:', result);
  })
  .catch(err => {
    console.error('Error:', err);
  })
  .finally(() => {
    // Cerrar la conexión
    mongoose.connection.close();
  });
