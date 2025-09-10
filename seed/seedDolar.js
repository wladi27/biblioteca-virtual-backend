const Dolar = require('../models/dolar');

const seedDolar = async () => {
  try {
    await Dolar.deleteMany({});
    const dolar = new Dolar({ name: 'USD_COP', value: 4006 });
    await dolar.save();
    console.log('Valor inicial del dolar insertado correctamente.');
  } catch (err) {
    console.error('Error al insertar el valor del dolar:', err);
  }
};

module.exports = seedDolar;
