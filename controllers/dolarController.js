const Dolar = require('../models/dolar');

// Get the current dollar value
const getDolarValue = async (req, res) => {
    try {
        const dolar = await Dolar.findOne({ name: 'USD_COP' });
        if (!dolar) {
            return res.status(404).json({ message: 'Valor del dolar no encontrado' });
        }
        res.json(dolar);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Create a new dollar value
const createDolarValue = async (req, res) => {
    const { value } = req.body;
    try {
        const newDolar = new Dolar({ value });
        const savedDolar = await newDolar.save();
        res.status(201).json(savedDolar);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Update the dollar value
const updateDolarValue = async (req, res) => {
    const { value } = req.body;
    try {
        const updatedDolar = await Dolar.findOneAndUpdate({ name: 'USD_COP' }, { value }, { new: true });
        if (!updatedDolar) {
            return res.status(404).json({ message: 'Valor del dolar no encontrado' });
        }
        res.json(updatedDolar);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Delete a dollar value
const deleteDolarValue = async (req, res) => {
    try {
        const deletedDolar = await Dolar.findOneAndDelete({ name: 'USD_COP' });
        if (!deletedDolar) {
            return res.status(404).json({ message: 'Valor del dolar no encontrado' });
        }
        res.json({ message: 'Valor del dolar eliminado' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getDolarValue,
    createDolarValue,
    updateDolarValue,
    deleteDolarValue
};