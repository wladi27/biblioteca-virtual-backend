require('dotenv').config();
const mongoose = require('mongoose');
const Usuario = require('../models/usuario');
const ReferralRequest = require('../models/referralRequest');

async function inspect() {
  await mongoose.connect(process.env.DB_URI);

  const allUsers = await Usuario.find().select('_id nombre_usuario nombre_completo correo_electronico').lean();
  const user92 = allUsers.find(u => u._id.toString().endsWith('92bde797') || u._id.toString().includes('92bde797'));
  const testUser = allUsers.find(u => u.nombre_usuario === 'test123' || u.nombre_usuario === 'test');

  console.log('USER ACTUAL (92bde797):', user92);
  console.log('TEST USER:', testUser);

  const reqs = await ReferralRequest.find().populate('solicitante_id', 'nombre_usuario').populate('referido_id', 'nombre_usuario').lean();
  console.log('TOTAL REQS EN BD:', reqs.length);
  
  const relevantReqs = reqs.filter(r => 
    r.solicitante_id?._id?.toString() === user92?._id?.toString() ||
    r.referido_id?._id?.toString() === user92?._id?.toString() ||
    r.solicitante_id?._id?.toString() === testUser?._id?.toString() ||
    r.referido_id?._id?.toString() === testUser?._id?.toString()
  );

  console.log('SOLICITUDES RELEVANTES:', relevantReqs);

  await mongoose.disconnect();
}

inspect().catch(console.error);
