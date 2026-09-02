const mongoose = require('mongoose');

const referralRequestSchema = new mongoose.Schema({
  solicitante_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },
  referido_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },
  estado: {
    type: String,
    enum: ['pendiente', 'aceptado', 'rechazado'],
    default: 'pendiente',
    index: true
  },
  comision_pagada: {
    type: Boolean,
    default: false,
    index: true
  },
  monto_comision: {
    type: Number,
    default: 1400
  },
  fecha_pago_comision: {
    type: Date
  },
  estado_comision: {
    type: String,
    enum: ['pendiente_verificacion', 'pagada', 'no_aplica'],
    default: 'pendiente_verificacion',
    index: true
  },
  motivo_pendiente: {
    type: String,
    default: 'Pendiente de verificación de aporte inicial'
  },
  fecha: {
    type: Date,
    default: Date.now,
    index: true
  },
  fecha_respuesta: {
    type: Date
  }
});

module.exports = mongoose.model('ReferralRequest', referralRequestSchema);