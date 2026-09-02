require('dotenv').config();
const mongoose = require('mongoose');
const Usuario = require('../models/usuario');
const ReferralRequest = require('../models/referralRequest');
const ReferralCode = require('../models/ReferralCode');

async function inspectSample() {
  await mongoose.connect(process.env.DB_URI);

  const reqs = await ReferralRequest.find().limit(15).populate('solicitante_id').populate('referido_id').lean();
  console.log('--- MUESTRA DE SOLICITUDES EN BD ---');
  for (const r of reqs) {
    console.log({
      solicitante: r.solicitante_id?.nombre_usuario,
      solicitante_fecha: r.solicitante_id?.fecha_creacion || r.solicitante_id?.createdAt,
      referido: r.referido_id?.nombre_usuario,
      referido_fecha: r.referido_id?.fecha_creacion || r.referido_id?.createdAt,
      estado: r.estado,
      fecha_solicitud: r.fecha
    });
  }

  // Verificar el usuario Wladi27 y test123
  const wladi = await Usuario.findOne({ nombre_usuario: 'Wladi27' }).lean();
  const test123 = await Usuario.findOne({ nombre_usuario: 'test123' }).lean();

  console.log('--- WLADI27 vs TEST123 ---');
  console.log('Wladi27:', { _id: wladi._id, padre_id: wladi.padre_id, nivel: wladi.nivel, fecha: wladi.fecha_creacion });
  console.log('test123:', { _id: test123?._id, padre_id: test123?.padre_id, nivel: test123?.nivel, fecha: test123?.fecha_creacion });

  // Ver si test123 fue creado con código de referido de Wladi o viceversa
  const codesWladi = await ReferralCode.find({ userId: wladi._id }).lean();
  console.log('Códigos de Wladi:', codesWladi);

  await mongoose.disconnect();
}

inspectSample().catch(console.error);
