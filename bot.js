const axios = require('axios');
const fs = require('fs');

// Cargar usuarios desde el archivo JSON
const cargarUsuarios = () => {
  const data = fs.readFileSync('usuarios.json', 'utf8');
  return JSON.parse(data);
};

const enviarUsuarios = async () => {
  const usuarios = cargarUsuarios();

  // Enviar cada usuario a la API con un retraso de 5 segundos
  for (const usuario of usuarios) {
    try {
      console.log(`Enviando usuario: ${usuario.nombre_completo} con correo: ${usuario.correo_electronico}`); // Imprimir usuario y correo
      await new Promise(resolve => setTimeout(resolve, 5000)); // Esperar 5 segundos
      const response = await axios.post('http://localhost:3000/auth/registrar', usuario);
      console.log(`Usuario enviado: ${usuario.nombre_completo}. Respuesta:`, response.data);
    } catch (error) {
      console.error(`Error al enviar usuario ${usuario.nombre_completo}:`, error.response ? error.response.data : error.message);
    }
  }
};

enviarUsuarios();
