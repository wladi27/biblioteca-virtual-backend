const mongoose = require('mongoose');

// URL de conexión
const uri = 'mongodb+srv://wladimir:W27330449@mls.s2hdk.mongodb.net/?retryWrites=true&w=majority&appName=mls';

// Conectar a MongoDB
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Conectado a la base de datos');
    
    // Eliminar el índice
    return mongoose.connection.db.collection('usuarios').dropIndex('correo_electronico_1');
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
