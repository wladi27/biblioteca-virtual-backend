const mongoose = require('mongoose');

const DolarSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, default: 'USD_COP' },
    value: { type: Number, required: true }
});

module.exports = mongoose.model('Dolar', DolarSchema);
