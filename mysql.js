const mysql = require('mysql2');

// Configuración de la conexión
const connection = mysql.createConnection({
  host: 'b8cixjs7aacqrfitqlge-mysql.services.clever-cloud.com', // Cambia esto por tu endpoint de RDS
  user: 'uncghzj2tlzwuopu',                        // Cambia esto por tu usuario de la base de datos
  password: 'Z609FSKWwFUZomaRiwV9',                 // Cambia esto por tu contraseña
  database: 'b8cixjs7aacqrfitqlge',    // Cambia esto por el nombre de tu base de datos
  port: 3306                                  // Puerto por defecto para MySQL
});

// Conectar a la base de datos
connection.connect((err) => {
  if (err) {
    console.error('Error de conexión: ' + err.stack);
    return;
  }
  console.log('Conectado a la base de datos MySQL como ID ' + connection.threadId);
});

module.exports = connection;
