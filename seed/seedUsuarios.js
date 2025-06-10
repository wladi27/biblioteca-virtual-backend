const Usuario = require('../models/usuario');
const bcrypt = require('bcrypt');

const seedUsuarios = async () => {
  const usuarios = [];

  for (let i = 1; i <= 50; i++) {
    const nombre_completo = `Usuario ${i}`;
    const linea_llamadas = `123456789${i}`;
    const linea_whatsapp = `987654321${i}`;
    const cuenta_numero = `1234567890${i}`;
    const banco = `Banco ${i}`;
    const titular_cuenta = `Usuario ${i}`;
    const correo_electronico = `usuario${i}@example.com`;
    const nivel = Math.floor(Math.random() * 5); // Asignar un nivel aleatorio entre 0 y 4
    const dni = `12345678${i}`;
    const nombre_usuario = `usuario${i}`;
    const contraseña = await bcrypt.hash('password123', 10);
    const codigo_referido = `REF-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Asegurarse de que el correo electrónico no sea nulo
    if (correo_electronico) {
      usuarios.push({
        nombre_completo,
        linea_llamadas,
        linea_whatsapp,
        cuenta_numero,
        banco,
        titular_cuenta,
        correo_electronico,
        nivel,
        dni,
        nombre_usuario,
        contraseña,
        codigo_referido
      });
    }
  }

  try {
    // Eliminar documentos existentes con correo nulo
    await Usuario.deleteMany({ correo_electronico: null });

    // Limpiar la colección antes de insertar nuevos documentos
    await Usuario.deleteMany({});

    const bulkOps = usuarios.map(usuario => ({
      updateOne: {
        filter: { correo_electronico: usuario.correo_electronico },
        update: { $setOnInsert: usuario },
        upsert: true
      }
    }));

    await Usuario.bulkWrite(bulkOps, { ordered: false });
    console.log('Usuarios iniciales insertados correctamente.');
  } catch (err) {
    console.error('Error al insertar usuarios:', err);
  }
};

module.exports = seedUsuarios;
