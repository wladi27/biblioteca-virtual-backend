const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const usuarioSchema = new mongoose.Schema({
  nombre_completo: { type: String, required: true },
  linea_llamadas: { type: String },
  linea_whatsapp: { type: String },
  cuenta_numero: { type: String },
  banco: { type: String },
  titular_cuenta: { type: String },
  correo_electronico: { type: String, required: true },
  dni: { type: String, required: true },
  nombre_usuario: { type: String, required: true, unique: true },
  contraseña: { type: String, required: true },
  codigo_referido: { type: String },
  padre_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null, index: true },
  nivel: { type: Number, default: 1, index: true },
  hijo1_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null, index: true },
  hijo2_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null, index: true },
  hijo3_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null, index: true },
  rol: { type: String, enum: ['user', 'admin'], default: 'user', index: true },
  token: { type: String },
}, {
  timestamps: true
});

// Índices compuestos para consultas rápidas de la pirámide y jerarquía
usuarioSchema.index({ hijo1_id: 1, hijo2_id: 1, hijo3_id: 1, _id: 1 });
usuarioSchema.index({ padre_id: 1, nivel: 1 });
usuarioSchema.index({ codigo_referido: 1 });

// Encriptar la contraseña antes de guardar
usuarioSchema.pre('save', async function (next) {
  if (!this.isModified('contraseña')) return next();
  this.contraseña = await bcrypt.hash(this.contraseña, 10);
  next();
});

// Método para comparar contraseñas
usuarioSchema.methods.matchPassword = async function (contraseña) {
  return await bcrypt.compare(contraseña, this.contraseña);
};

module.exports = mongoose.model('Usuario', usuarioSchema);