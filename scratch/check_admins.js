require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Usuario = require('../models/usuario');

async function check() {
  await mongoose.connect(process.env.DB_URI);
  console.log('--- Model User (Admins) ---');
  const admins = await User.find().lean();
  console.log(admins);

  console.log('--- Model Usuario with rol admin ---');
  const usuarios = await Usuario.find({ rol: { $in: ['admin', 'superadmin'] } }).lean();
  console.log(usuarios.map(u => ({ id: u._id, username: u.nombre_usuario, email: u.correo_electronico, rol: u.rol })));

  // Check if ErickySamara@@ exists in User or Usuario
  const user1 = await User.findOne({ username: 'ErickySamara@@' });
  const user2 = await Usuario.findOne({ nombre_usuario: 'ErickySamara@@' });
  console.log('ErickySamara@@ in User:', user1 ? 'Found' : 'Not found');
  console.log('ErickySamara@@ in Usuario:', user2 ? `Found with rol: ${user2.rol}` : 'Not found');

  await mongoose.disconnect();
}

check();
