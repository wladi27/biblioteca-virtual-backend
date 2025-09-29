// scripts/encontrarPatrocinadoresActivos.js
const mongoose = require('mongoose');
const ReferralRequest = require('../models/referralRequest');
const Usuario = require('../models/usuario'); // Asegúrate de que la ruta sea correcta

// Configuración directa de la conexión
const MONGODB_URI = process.env.MONGO_URI || 'mongodb://wladi:Wladi.0127!@72.60.70.200:27000';

const conectarDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Conectado a MongoDB');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error.message);
    process.exit(1);
  }
};

const encontrarPatrocinadoresActivos = async () => {
  try {
    await conectarDB();

    const ahora = new Date();
    const inicioDeMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const finDeMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59);

    console.log(`\n📊 Buscando patrocinadores con 12+ referidos aceptados entre ${inicioDeMes.toLocaleDateString()} y ${finDeMes.toLocaleDateString()}`);

    const patrocinadoresStats = await ReferralRequest.aggregate([
      {
        $match: {
          fecha: { $gte: inicioDeMes, $lte: finDeMes },
          estado: 'aceptado',
        },
      },
      {
        $group: {
          _id: '$solicitante_id',
          conteoReferidos: { $sum: 1 },
        },
      },
      {
        $match: {
          conteoReferidos: { $gte: 12 },
        },
      },
      {
        $lookup: {
          from: 'usuarios', // Nombre de la colección de usuarios
          localField: '_id',
          foreignField: '_id',
          as: 'patrocinadorInfo',
        },
      },
      {
        $unwind: '$patrocinadorInfo',
      },
      {
        $sort: {
          conteoReferidos: -1,
        },
      },
      {
        $project: {
          _id: 0,
          patrocinador_id: '$_id',
          nombre_completo: '$patrocinadorInfo.nombre_completo',
          nombre_usuario: '$patrocinadorInfo.nombre_usuario',
          conteoReferidos: 1,
        },
      },
    ]);

    if (patrocinadoresStats.length === 0) {
      console.log('\n❌ No se encontraron patrocinadores que cumplan con el criterio.');
    } else {
      console.log(`\n✅ Se encontraron ${patrocinadoresStats.length} patrocinadores con 12+ referidos aceptados:\n`);
      patrocinadoresStats.forEach((stat, index) => {
        console.log(`${index + 1}. ${stat.nombre_completo} (@${stat.nombre_usuario}) - ${stat.conteoReferidos} referidos`);
      });
    }

  } catch (error) {
    console.error('💥 Error ejecutando el script:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Conexión cerrada');
  }
};

// Ejecutar el script
encontrarPatrocinadoresActivos();
