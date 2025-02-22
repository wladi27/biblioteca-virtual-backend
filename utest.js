const fs = require('fs');
const axios = require('axios');

// Lee el archivo users.json
const leerUsuarios = async () => {
  try {
    const data = fs.readFileSync('users.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error al leer el archivo:', error);
    process.exit(1);
  }
};

// Envía los usuarios a la API con un intervalo
const enviarUsuarios = async (usuarios) => {
  const intervalo = 5000; // Intervalo de 5 segundos entre cada solicitud

  for (const usuario of usuarios) {
    // Prepara el objeto de usuario según el controlador
    const usuarioData = {
      _id: usuario._id,
      nombre_completo: usuario.nombre_completo,
      linea_llamadas: usuario.linea_llamadas,
      linea_whatsapp: usuario.linea_whatsapp,
      cuenta_numero: usuario.cuenta_numero,
      banco: usuario.banco,
      titular_cuenta: usuario.titular_cuenta,
      correo_electronico: usuario.correo_electronico,
      dni: usuario.dni,
      nombre_usuario: usuario.nombre_usuario,
      contraseña: '0123456', // Establece la contraseña a '0123456' para todos
      codigo_referido: usuario.codigo_referido || '', // Asigna una cadena vacía si no hay código referido
      validar_codigo_referido: false,
    };

    try {
      const response = await axios.post('http://localhost:5000/usuarios', usuarioData); // Cambia la URL según tu API
      console.log(`Usuario creado: ${response.data.nombre_completo} (ID: ${response.data._id})`);
    } catch (error) {
      console.error(`Error al crear el usuario ${usuario.nombre_completo}:`, error.response ? error.response.data : error.message);
    }

    // Espera el intervalo antes de continuar con el siguiente usuario
    await new Promise(resolve => setTimeout(resolve, intervalo));
  }
};

// Función principal
const importarUsuarios = async () => {
  const usuarios = await leerUsuarios();
  await enviarUsuarios(usuarios);
};

// Ejecuta el script
importarUsuarios();
