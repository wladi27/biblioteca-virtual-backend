require('dotenv').config();
const mongoose = require('mongoose');
const Usuario = require('../models/usuario');

async function testPiramideParaRed() {
  await mongoose.connect(process.env.DB_URI);
  const usuarioId = '67bf9602c7a29c4692bde797'; // Wladimir Figuera

  const [usuarioRaiz] = await Usuario.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(usuarioId) } },
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

  const nivelesOrganizados = {};
  for (let i = 1; i <= 12; i++) {
    nivelesOrganizados[i] = [];
  }

  if (usuarioRaiz && usuarioRaiz.redCompleta) {
    usuarioRaiz.redCompleta.forEach((u) => {
      const nivelRed = (u.profundidad || 0) + 1;
      if (nivelesOrganizados[nivelRed]) {
        nivelesOrganizados[nivelRed].push({
          _id: u._id,
          nombre_usuario: u.nombre_usuario,
          nivel: nivelRed
        });
      }
    });
  }

  console.log('Nivel 1 count:', nivelesOrganizados[1]?.length, nivelesOrganizados[1]);
  console.log('Nivel 2 count:', nivelesOrganizados[2]?.length);
  console.log('Nivel 3 count:', nivelesOrganizados[3]?.length);
  console.log('Nivel 4 count:', nivelesOrganizados[4]?.length);

  await mongoose.disconnect();
}

testPiramideParaRed().catch(console.error);
