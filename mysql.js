const mysql = require('mysql2');
require('dotenv').config();

const connection = mysql.createConnection({
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'mls_db',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10)
});

if (process.env.MYSQL_HOST) {
  connection.connect((err) => {
    if (err) {
      console.error('Error de conexión MySQL: ' + err.stack);
      return;
    }
    console.log('Conectado a MySQL como ID ' + connection.threadId);
  });
}

module.exports = connection;
