const { MongoClient } = require('mongodb');
require('dotenv').config();

const sourceUri = process.env.SOURCE_MONGO_URI;
const destUri = process.env.DEST_MONGO_URI || process.env.DB_URI;

const sourceDBName = process.env.SOURCE_DB_NAME || 'biblioteca_db';
const destDBName = process.env.DEST_DB_NAME || 'test';

async function migrate() {
  if (!sourceUri || !destUri) {
    console.error('Por favor, define las variables de entorno SOURCE_MONGO_URI y DEST_MONGO_URI.');
    process.exit(1);
  }

  const sourceClient = new MongoClient(sourceUri);
  const destClient = new MongoClient(destUri);

  try {
    await sourceClient.connect();
    console.log('Conectado a la base de datos de origen...');
    await destClient.connect();
    console.log('Conectado a la base de datos de destino...');

    const sourceDb = sourceClient.db(sourceDBName);
    const destDb = destClient.db(destDBName);

    const collections = await sourceDb.listCollections().toArray();

    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      console.log(`--- Migrando colección: ${collectionName} ---`);

      const sourceCollection = sourceDb.collection(collectionName);
      const destCollection = destDb.collection(collectionName);

      const documents = await sourceCollection.find({}).toArray();

      if (documents.length > 0) {
        await destCollection.insertMany(documents, { ordered: false });
        console.log(` -> Se migraron ${documents.length} documentos a la colección ${collectionName}.`);
      } else {
        console.log(` -> La colección ${collectionName} está vacía, no se migró nada.`);
      }
    }

    console.log('\n¡Migración completada exitosamente!');
  } catch (err) {
    console.error('Ocurrió un error durante la migración:', err);
  } finally {
    await sourceClient.close();
    await destClient.close();
    console.log('Conexiones cerradas.');
  }
}

if (require.main === module) {
  migrate();
}

module.exports = migrate;
