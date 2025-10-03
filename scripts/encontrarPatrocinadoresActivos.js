// scripts/encontrarPatrocinadoresActivos.js
const mongoose = require('mongoose');
const readline = require('readline');
const ReferralRequest = require('../models/referralRequest');
const Usuario = require('../models/usuario'); // Asegúrate de que la ruta sea correcta

// Configuración directa de la conexión
const MONGODB_URI = process.env.MONGO_URI || '';

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

// --- Constantes de Configuración ---
const MINIMO_REFERIDOS = 12;
const NIVEL_MINIMO_REFERIDO = 1792;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const preguntar = (pregunta) => {
  return new Promise(resolve => rl.question(pregunta, resolve));
};

const encontrarPatrocinadoresActivos = async () => {
  let year, month;

  try {
    const yearStr = await preguntar('Ingrese el año para la consulta (ej: 2024): ');
    const monthStr = await preguntar('Ingrese el mes para la consulta (1-12): ');

    year = parseInt(yearStr);
    month = parseInt(monthStr);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12 || year < 2000) {
      console.error('❌ Año o mes inválido. Por favor, ejecute el script de nuevo e ingrese valores correctos.');
      return; // Termina la ejecución si la entrada es inválida
    }

    await conectarDB();

    // Usar el mes y año proporcionados por el usuario (el mes en JS es 0-11)
    const inicioDeMes = new Date(year, month - 1, 1);
    const finDeMes = new Date(year, month, 0, 23, 59, 59);

    console.log(`\n📊 Buscando patrocinadores con ${MINIMO_REFERIDOS}+ referidos (nivel ${NIVEL_MINIMO_REFERIDO}+) para ${inicioDeMes.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}...`);

    const patrocinadoresStats = await ReferralRequest.aggregate([
      // 1. Filtrar solicitudes por fecha y estado
      {
        $match: {
          fecha: { $gte: inicioDeMes, $lte: finDeMes },
          estado: 'aceptado',
        },
      },
      // 2. Obtener la información del usuario REFERIDO
      {
        $lookup: {
          from: 'usuarios',
          localField: 'referido_id',
          foreignField: '_id',
          as: 'referidoInfo',
        },
      },
      { $unwind: '$referidoInfo' },
      // 3. Filtrar para que solo se consideren referidos con el nivel mínimo
      {
        $match: {
          'referidoInfo.nivel': { $gte: NIVEL_MINIMO_REFERIDO },
        },
      },
      // 4. Agrupar por patrocinador y contar los referidos que pasaron el filtro
      {
        $group: {
          _id: '$solicitante_id',
          conteoReferidos: { $sum: 1 },
          listaReferidos: { $push: '$referidoInfo.nombre_usuario' } // Nuevo: Agrupar los nombres de usuario de los referidos
        },
      },
      // 5. Filtrar patrocinadores que tengan el mínimo de referidos requeridos
      {
        $match: {
          conteoReferidos: { $gte: MINIMO_REFERIDOS },
        },
      },
      // 6. Obtener la información del PATROCINADOR
      {
        $lookup: {
          from: 'usuarios',
          localField: '_id',
          foreignField: '_id',
          as: 'patrocinadorInfo',
        },
      },
      { $unwind: '$patrocinadorInfo' },
      // 7. Ordenar de mayor a menor por cantidad de referidos
      {
        $sort: {
          conteoReferidos: -1,
        },
      },
      // 8. Formatear la salida final
      {
        $project: {
          _id: 0,
          patrocinador_id: '$_id',
          nombre_completo: '$patrocinadorInfo.nombre_completo',
          nombre_usuario: '$patrocinadorInfo.nombre_usuario',
          conteoReferidos: 1,
          referidos: '$listaReferidos' // Nuevo: Incluir la lista de referidos en el resultado
        },
      },
    ]);

    if (patrocinadoresStats.length === 0) {
      console.log('\n❌ No se encontraron patrocinadores que cumplan con el criterio.');
    } else {
      console.log(`\n✅ Se encontraron ${patrocinadoresStats.length} patrocinadores cumpliendo los criterios:\n`);
      patrocinadoresStats.forEach((stat, index) => {
        console.log(`${index + 1}. ${stat.nombre_completo} (@${stat.nombre_usuario}) - ${stat.conteoReferidos} referidos:`);
        console.log(`   └─ Referidos: ${stat.referidos.join(', ')}\n`); // Nuevo: Mostrar la lista de referidos
      });
    }

  } catch (error) {
    console.error('💥 Error ejecutando el script:', error);
  } finally {
    rl.close();
    await mongoose.connection.close();
    console.log('\n🔌 Conexión cerrada');
  }
};

// Ejecutar el script
encontrarPatrocinadoresActivos();
