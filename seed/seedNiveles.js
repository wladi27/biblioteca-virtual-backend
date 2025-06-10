const Nivel = require('../models/nivel');

const seedNiveles = async () => {
  const niveles = [
    { numero_nivel: 1, comision: 390.00 },
    { numero_nivel: 2, comision: 1170.00 },
    { numero_nivel: 3, comision: 3510.00 },
    { numero_nivel: 4, comision: 10530.00 },
    { numero_nivel: 5, comision: 31590.00 },
    { numero_nivel: 6, comision: 80555.00 },
    { numero_nivel: 7, comision: 241646.00 },
    { numero_nivel: 8, comision: 724991.00 },
    { numero_nivel: 9, comision: 2174972.00 },
    { numero_nivel: 10, comision: 6124915.00 },
    { numero_nivel: 11, comision: 19574744.00 },
    { numero_nivel: 12, comision: 58724231.00 }
  ];

  try {
    await Nivel.deleteMany({});
    await Nivel.insertMany(niveles);
    console.log('Niveles iniciales insertados correctamente.');
  } catch (err) {
    console.error('Error al insertar niveles:', err);
  }
};

module.exports = seedNiveles;
