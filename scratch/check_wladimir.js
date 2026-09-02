require('dotenv').config();
const mongoose = require('mongoose');
const Usuario = require('../models/usuario');

async function main() {
  await mongoose.connect(process.env.DB_URI);
  const u = await Usuario.findOne({ nombre_completo: /Wladimir/i }).lean();
  console.log('Usuario:', u ? {
    id: u._id,
    nombre_completo: u.nombre_completo,
    nombre_usuario: u.nombre_usuario,
    nivel: u.nivel,
    padre_id: u.padre_id,
    hijo1_id: u.hijo1_id,
    hijo2_id: u.hijo2_id,
    hijo3_id: u.hijo3_id,
  } : null);

  if (u) {
    const hijosConPadreId = await Usuario.find({ padre_id: u._id }).select('_id nombre_usuario nivel').lean();
    console.log('Hijos con padre_id:', hijosConPadreId);

    const hijosPorSlots = await Usuario.find({
      _id: { $in: [u.hijo1_id, u.hijo2_id, u.hijo3_id].filter(Boolean) }
    }).select('_id nombre_usuario nivel').lean();
    console.log('Hijos en slots hijo1/2/3_id:', hijosPorSlots);

    // Test aggregate graphLookup
    const [agg] = await Usuario.aggregate([
      { $match: { _id: u._id } },
      {
        $graphLookup: {
          from: 'usuarios',
          startWith: '$_id',
          connectFromField: '_id',
          connectToField: 'padre_id',
          as: 'redCompleta',
          maxDepth: 11,
          depthField: 'profundidad'
        }
      }
    ]);
    console.log('Total descendientes encontrados con graphLookup por padre_id:', agg?.redCompleta?.length || 0);
  }

  await mongoose.disconnect();
}

main().catch(console.error);
