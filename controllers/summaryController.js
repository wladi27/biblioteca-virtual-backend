const Usuario = require('../models/usuario');
const Aporte = require('../models/aporteModel');
const ReferralCode = require('../models/ReferralCode');
const Withdrawal = require('../models/Withdrawal');
const Billetera = require('../models/billetera');
const Publicacion = require('../models/publicacionModel');
const Transaccion = require('../models/transaccion');

// Resumen general optimizado en paralelo
const getSummaryData = async (req, res) => {
    try {
        const [
            totalUsuarios,
            totalAportes,
            totalReferralCodes,
            totalWithdrawals,
            totalBilleteras,
            totalPublicaciones
        ] = await Promise.all([
            Usuario.countDocuments(),
            Aporte.countDocuments({ aporte: true }),
            ReferralCode.countDocuments(),
            Transaccion.countDocuments({ tipo: 'retiro' }),
            Billetera.countDocuments(),
            Publicacion.countDocuments()
        ]);

        res.status(200).json({
            totalUsuarios,
            totalAportes,
            totalReferralCodes,
            totalWithdrawals,
            totalBilleteras,
            totalPublicaciones
        });
    } catch (error) {
        console.error('Error en getSummaryData:', error);
        res.status(500).json({ message: 'Error al obtener datos de resumen', error: error.message });
    }
};

// Endpoint Único Consolidado para el Dashboard de Administración
// Reduce múltiples peticiones HTTP a una sola respuesta instantánea
const getAdminDashboardOverview = async (req, res) => {
    try {
        const [
            totalUsuarios,
            totalAportesValidados,
            totalAportesPendientes,
            totalReferralCodes,
            totalWithdrawals,
            totalBilleteras,
            totalPublicaciones,
            ultimosRetiros
        ] = await Promise.all([
            Usuario.countDocuments(),
            Aporte.countDocuments({ aporte: true }),
            Aporte.countDocuments({
                $or: [
                    { aporte: false },
                    { aporte: { $exists: false } },
                    { aporte: null }
                ]
            }),
            ReferralCode.countDocuments(),
            Transaccion.countDocuments({ tipo: 'retiro' }),
            Billetera.countDocuments(),
            Publicacion.countDocuments(),
            Transaccion.find({ tipo: 'retiro' })
                .sort({ fecha: -1 })
                .limit(10)
                .lean()
        ]);

        res.status(200).json({
            metricas: {
                totalUsuarios,
                totalAportes: totalAportesValidados,
                totalAportesPendientes,
                totalReferralCodes,
                totalWithdrawals,
                totalBilleteras,
                totalPublicaciones
            },
            retiros: ultimosRetiros,
            paginacion: {
                totalRetiros: totalWithdrawals,
                hasMore: totalWithdrawals > 10,
                limit: 10,
                skip: 0
            }
        });
    } catch (error) {
        console.error('Error en getAdminDashboardOverview:', error);
        res.status(500).json({ message: 'Error al obtener resumen de administración', error: error.message });
    }
};

module.exports = {
    getSummaryData,
    getAdminDashboardOverview
};
