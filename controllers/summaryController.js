const Usuario = require('../models/usuario');
const Aporte = require('../models/aporteModel');
const ReferralCode = require('../models/ReferralCode');
const Withdrawal = require('../models/Withdrawal');
const Billetera = require('../models/billetera');
const Publicacion = require('../models/publicacionModel');

const getSummaryData = async (req, res) => {
    try {
        const totalUsuarios = await Usuario.countDocuments();
        const totalAportes = await Aporte.countDocuments();
        const totalReferralCodes = await ReferralCode.countDocuments();
        const totalWithdrawals = await Withdrawal.countDocuments();
        const totalBilleteras = await Billetera.countDocuments();
        const totalPublicaciones = await Publicacion.countDocuments();

        res.status(200).json({
            totalUsuarios,
            totalAportes,
            totalReferralCodes,
            totalWithdrawals,
            totalBilleteras,
            totalPublicaciones
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener datos de resumen', error: error.message });
    }
};

module.exports = {
    getSummaryData
};
