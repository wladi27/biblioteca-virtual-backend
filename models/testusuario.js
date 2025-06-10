const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const testusuarioSchema = new mongoose.Schema({
  nombre_completo: { type: String, required: true },
  linea_llamadas: { type: String },
  linea_whatsapp: { type: String },
  cuenta_numero: { type: String },
  banco: { type: String },
  titular_cuenta: { type: String },
  correo_electronico: { type: String, required: true }, // No es único
  dni: { type: String, required: true },
  nombre_usuario: { type: String, required: true, unique: true },
  contraseña: { type: String, required: true },
  codigo_referido: { type: String }, // Campo opcional
  padre_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TestUsuario', default: null },
  nivel: { type: Number, default: 1 },
  hijo1_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TestUsuario', default: null },
  hijo2_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TestUsuario', default: null },
  hijo3_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TestUsuario', default: null },
});

// Encriptar la contraseña antes de guardar
testusuarioSchema.pre('save', async function (next) {
  if (!this.isModified('contraseña')) return next();
  this.contraseña = await bcrypt.hash(this.contraseña, 10);
  next();
});

// Método para comparar contraseñas
testusuarioSchema.methods.matchPassword = async function (contraseña) {
  return await bcrypt.compare(contraseña, this.contraseña);
};

module.exports = mongoose.model('TestUsuario', testusuarioSchema);
