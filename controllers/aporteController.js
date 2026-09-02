const Aporte = require('../models/aporteModel');

// Obtener el estado de verificación y aporte de un usuario específico
const obtenerEstadoAporteUsuario = async (req, res) => {
    const { usuarioId } = req.params;
    if (!usuarioId) {
        return res.status(400).json({ error: 'ID de usuario requerido' });
    }

    try {
        // 1. Verificar si tiene algún aporte aprobado
        const aporteAprobado = await Aporte.findOne({ usuarioId, aporte: true }).sort({ updatedAt: -1 }).lean();
        if (aporteAprobado) {
            return res.status(200).json({
                verificado: true,
                estado: 'verificado',
                mensaje: 'Usuario verificado con aporte activo',
                aporte: aporteAprobado
            });
        }

        // 2. Verificar si tiene un aporte pendiente de validación
        const aportePendiente = await Aporte.findOne({ usuarioId, aporte: false }).sort({ updatedAt: -1 }).lean();
        if (aportePendiente) {
            return res.status(200).json({
                verificado: false,
                estado: 'pendiente',
                mensaje: 'Aporte en proceso de validación administrativa',
                aporte: aportePendiente
            });
        }

        // 3. Sin aporte
        return res.status(200).json({
            verificado: false,
            estado: 'sin_aporte',
            mensaje: 'No se ha registrado aporte para este usuario',
            aporte: null
        });
    } catch (error) {
        console.error('Error al obtener estado de aporte:', error);
        res.status(500).json({ error: 'Error al consultar estado de verificación' });
    }
};

// Crear o actualizar solicitud de aporte
const crearAporte = async (req, res) => {
    const { usuarioId, notas, monto } = req.body;

    if (!usuarioId) {
        return res.status(400).json({ error: 'El ID del usuario es requerido' });
    }

    try {
        // Verificar si ya está aprobado
        const yaAprobado = await Aporte.findOne({ usuarioId, aporte: true });
        if (yaAprobado) {
            return res.status(200).json({
                message: 'El usuario ya cuenta con un aporte verificado',
                verificado: true,
                aporte: yaAprobado
            });
        }

        // Buscar si ya tiene un aporte pendiente para evitar duplicados
        let aporteDoc = await Aporte.findOne({ usuarioId, aporte: false });
        if (aporteDoc) {
            aporteDoc.updatedAt = new Date();
            if (notas) aporteDoc.notas = notas;
            if (monto) aporteDoc.monto = monto;
            await aporteDoc.save();
            return res.status(200).json({
                message: 'Solicitud de aporte actualizada',
                verificado: false,
                aporte: aporteDoc
            });
        }

        const nuevoAporte = new Aporte({
            usuarioId,
            aporte: false,
            monto: monto || 0,
            notas: notas || 'Solicitud de co-inversión / aporte inicial'
        });
        await nuevoAporte.save();
        res.status(201).json({
            message: 'Solicitud de aporte registrada exitosamente',
            verificado: false,
            aporte: nuevoAporte
        });
    } catch (err) {
        console.error('Error al crear aporte:', err);
        res.status(500).json({ message: 'Error al crear el aporte' });
    }
};

// Obtener todos los aportes
const obtenerAportes = async (req, res) => {
    try {
        const aportes = await Aporte.find();
        res.status(200).json(aportes);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener los aportes' });
    }
};

// Obtener un aporte por ID
const obtenerAportePorId = async (req, res) => {
    const { id } = req.params;

    try {
        const aporte = await Aporte.findById(id);
        if (!aporte) {
            return res.status(404).json({ error: 'Aporte no encontrado' });
        }
        res.status(200).json(aporte);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener el aporte' });
    }
};

// Actualizar un aporte por ID
const actualizarAporte = async (req, res) => {
    const { id } = req.params;
    const { usuarioId, aporte } = req.body;

    try {
        const updateData = { updatedAt: new Date() };
        if (aporte !== undefined) updateData.aporte = aporte;
        if (usuarioId !== undefined) updateData.usuarioId = usuarioId;

        const aporteActualizado = await Aporte.findByIdAndUpdate(id, { $set: updateData }, { new: true });
        if (!aporteActualizado) {
            return res.status(404).json({ error: 'Aporte no encontrado' });
        }

        // Si se aprobó el aporte, activar la billetera del usuario automáticamente y liquidar comisiones de referidos pendientes
        if (aporteActualizado.aporte === true && aporteActualizado.usuarioId) {
            const Billetera = require('../models/billetera');
            await Billetera.findOneAndUpdate(
                { usuario_id: aporteActualizado.usuarioId },
                { $set: { activa: true }, $setOnInsert: { saldo: 0 } },
                { upsert: true }
            );

            // Liquidar automáticamente comisiones de referidos que ahora cumplan la doble verificación
            const { procesarComisionesPendientesPorVerificacion } = require('../utils/comisionesReferidos');
            await procesarComisionesPendientesPorVerificacion(aporteActualizado.usuarioId);
        }

        res.status(200).json(aporteActualizado);
    } catch (error) {
        console.error('Error al actualizar el aporte:', error);
        res.status(500).json({ error: 'Error al actualizar el aporte' });
    }
};

// Validación masiva de aportes en lote (por IDs o por criterio de filtro)
const validarAportesEnLote = async (req, res) => {
    try {
        const { aporteIds, validarTodosFiltro, search } = req.body;
        const Usuario = require('../models/usuario');
        const Billetera = require('../models/billetera');
        const mongoose = require('mongoose');
        const { procesarComisionesPendientesPorVerificacion } = require('../utils/comisionesReferidos');

        let idsAValidar = [];

        if (validarTodosFiltro) {
            // Construir filtro idéntico a la búsqueda
            let filtro = { 
                $or: [
                    { aporte: false },
                    { aporte: { $exists: false } },
                    { aporte: null }
                ]
            };

            if (search && search.trim() !== '') {
                const searchValue = search.trim();
                const orConditions = [
                    { nombre_completo: { $regex: searchValue, $options: 'i' } },
                    { nombre_usuario: { $regex: searchValue, $options: 'i' } },
                    { dni: { $regex: searchValue, $options: 'i' } },
                    { correo_electronico: { $regex: searchValue, $options: 'i' } },
                    { linea_llamadas: { $regex: searchValue, $options: 'i' } },
                    { linea_whatsapp: { $regex: searchValue, $options: 'i' } }
                ];

                if (mongoose.Types.ObjectId.isValid(searchValue)) {
                    orConditions.push({ _id: new mongoose.Types.ObjectId(searchValue) });
                }

                const usuariosEncontrados = await Usuario.find({ $or: orConditions }).select('_id').lean();
                const userIds = usuariosEncontrados.map(u => u._id.toString());
                
                const aporteOr = [{ usuarioId: { $in: userIds } }];
                if (mongoose.Types.ObjectId.isValid(searchValue)) {
                    aporteOr.push({ _id: new mongoose.Types.ObjectId(searchValue) });
                    aporteOr.push({ usuarioId: searchValue });
                }

                filtro = {
                    $and: [
                        { $or: [{ aporte: false }, { aporte: { $exists: false } }, { aporte: null }] },
                        { $or: aporteOr }
                    ]
                };
            }

            const aportesPendientes = await Aporte.find(filtro).select('_id usuarioId').lean();
            idsAValidar = aportesPendientes.map(a => a._id);
        } else if (Array.isArray(aporteIds) && aporteIds.length > 0) {
            idsAValidar = aporteIds;
        } else {
            return res.status(400).json({ error: 'Debe especificar los aportes a validar' });
        }

        if (idsAValidar.length === 0) {
            return res.status(200).json({
                success: true,
                mensaje: 'No hay aportes pendientes para validar con el criterio seleccionado',
                validados: 0
            });
        }

        // Actualizar todos los aportes a validados (aporte: true)
        const updateRes = await Aporte.updateMany(
            { _id: { $in: idsAValidar } },
            { $set: { aporte: true, updatedAt: new Date() } }
        );

        // Obtener los IDs de los usuarios para activar sus billeteras
        const aportesValidados = await Aporte.find({ _id: { $in: idsAValidar } }).select('usuarioId').lean();
        const userIds = [...new Set(aportesValidados.map(a => a.usuarioId).filter(Boolean))];

        if (userIds.length > 0) {
            // Asegurar billetera activa para cada usuario
            await Billetera.updateMany(
                { usuario_id: { $in: userIds } },
                { $set: { activa: true } }
            );

            // Crear billeteras para los que aún no tengan
            const existingWallets = await Billetera.find({ usuario_id: { $in: userIds } }).select('usuario_id').lean();
            const existingSet = new Set(existingWallets.map(w => w.usuario_id.toString()));
            const missingWallets = userIds
                .filter(uId => !existingSet.has(uId.toString()))
                .map(uId => ({ usuario_id: uId, activa: true, saldo: 0 }));

            if (missingWallets.length > 0) {
                await Billetera.insertMany(missingWallets, { ordered: false });
            }

            // Liquidar automáticamente comisiones de referidos para cada usuario validado
            for (const uId of userIds) {
                await procesarComisionesPendientesPorVerificacion(uId);
            }
        }

        res.status(200).json({
            success: true,
            mensaje: `✅ ${updateRes.modifiedCount} aportes validados exitosamente y cuentas verificadas`,
            validados: updateRes.modifiedCount,
            totalAfectados: idsAValidar.length
        });
    } catch (error) {
        console.error('Error en validarAportesEnLote:', error);
        res.status(500).json({ error: 'Error en el servidor al validar en lote', message: error.message });
    }
};

// Eliminar un aporte por ID
const eliminarAporte = async (req, res) => {
    const { id } = req.params;

    try {
        const aporteEliminado = await Aporte.findByIdAndDelete(id);
        if (!aporteEliminado) {
            return res.status(404).json({ error: 'Aporte no encontrado' });
        }
        res.status(200).json({ message: 'Aporte eliminado exitosamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar el aporte' });
    }
};

// Obtener aportes con paginación y filtros
const obtenerAportesPaginados = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            search = '',
            sortBy = 'updatedAt',
            sortOrder = 'desc'
        } = req.query;

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        const Usuario = require('../models/usuario');
        const mongoose = require('mongoose');

        let filtro = { aporte: true };

        if (search && search.trim() !== '') {
            const searchValue = search.trim();
            const orConditions = [
                { nombre_completo: { $regex: searchValue, $options: 'i' } },
                { nombre_usuario: { $regex: searchValue, $options: 'i' } },
                { dni: { $regex: searchValue, $options: 'i' } },
                { correo_electronico: { $regex: searchValue, $options: 'i' } },
                { linea_llamadas: { $regex: searchValue, $options: 'i' } },
                { linea_whatsapp: { $regex: searchValue, $options: 'i' } }
            ];

            if (mongoose.Types.ObjectId.isValid(searchValue)) {
                orConditions.push({ _id: new mongoose.Types.ObjectId(searchValue) });
            }

            const usuariosEncontrados = await Usuario.find({ $or: orConditions }).select('_id').lean();
            const userIds = usuariosEncontrados.map(u => u._id.toString());

            const aporteOr = [{ usuarioId: { $in: userIds } }];
            if (mongoose.Types.ObjectId.isValid(searchValue)) {
                aporteOr.push({ _id: new mongoose.Types.ObjectId(searchValue) });
                aporteOr.push({ usuarioId: searchValue });
            }

            filtro = {
                $and: [
                    { aporte: true },
                    { $or: aporteOr }
                ]
            };
        }

        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        const [aportes, total] = await Promise.all([
            Aporte.find(filtro)
                .sort(sort)
                .skip(skip)
                .limit(limitNum)
                .lean(),
            Aporte.countDocuments(filtro)
        ]);

        const usuarioIds = [...new Set(aportes.map(aporte => aporte.usuarioId).filter(Boolean))];
        const usuarios = await Usuario.find({ _id: { $in: usuarioIds } })
            .select('nombre_completo nombre_usuario padre_id nivel dni correo_electronico linea_llamadas linea_whatsapp banco cuenta_numero')
            .lean();

        const usuariosMap = {};
        usuarios.forEach(usuario => {
            usuariosMap[usuario._id.toString()] = usuario;
        });

        const padreIds = [...new Set(usuarios.filter(u => u.padre_id).map(u => u.padre_id))];
        const padres = padreIds.length > 0 ? await Usuario.find({ _id: { $in: padreIds } }).select('nombre_completo _id').lean() : [];
        const padresMap = {};
        padres.forEach(padre => {
            padresMap[padre._id.toString()] = padre;
        });

        const aportesConUsuarios = aportes.map(aporte => {
            const usuario = usuariosMap[aporte.usuarioId];
            return {
                ...aporte,
                usuario: usuario ? {
                    nombre_completo: usuario.nombre_completo,
                    nombre_usuario: usuario.nombre_usuario,
                    nivel: usuario.nivel,
                    dni: usuario.dni,
                    correo_electronico: usuario.correo_electronico,
                    linea_llamadas: usuario.linea_llamadas,
                    linea_whatsapp: usuario.linea_whatsapp,
                    banco: usuario.banco,
                    cuenta_numero: usuario.cuenta_numero,
                    padre: usuario.padre_id ? {
                        id: usuario.padre_id,
                        nombre: padresMap[usuario.padre_id]?.nombre_completo || 'No disponible'
                    } : null
                } : {
                    nombre_completo: 'Usuario no encontrado',
                    nombre_usuario: '---',
                    nivel: 'N/A',
                    dni: 'N/A',
                    padre: null
                }
            };
        });

        const totalPages = Math.ceil(total / limitNum);
        res.status(200).json({
            aportes: aportesConUsuarios,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalItems: total,
                itemsPerPage: limitNum,
                hasNext: pageNum < totalPages,
                hasPrev: pageNum > 1,
                nextPage: pageNum < totalPages ? pageNum + 1 : null,
                prevPage: pageNum > 1 ? pageNum - 1 : null
            }
        });
    } catch (error) {
        console.error('Error al obtener aportes paginados:', error);
        res.status(500).json({ message: 'Error en el servidor', error: error.message });
    }
};

// Obtener solo aportes NO VALIDADOS con paginación y búsqueda multi-criterio
const obtenerAportesNoValidados = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            search = '',
            sortBy = 'fecha_creacion',
            sortOrder = 'desc'
        } = req.query;

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        const Usuario = require('../models/usuario');
        const mongoose = require('mongoose');

        let filtro = { 
            $or: [
                { aporte: false },
                { aporte: { $exists: false } },
                { aporte: null }
            ]
        };

        if (search && search.trim() !== '') {
            const searchValue = search.trim();
            const orConditions = [
                { nombre_completo: { $regex: searchValue, $options: 'i' } },
                { nombre_usuario: { $regex: searchValue, $options: 'i' } },
                { dni: { $regex: searchValue, $options: 'i' } },
                { correo_electronico: { $regex: searchValue, $options: 'i' } },
                { linea_llamadas: { $regex: searchValue, $options: 'i' } },
                { linea_whatsapp: { $regex: searchValue, $options: 'i' } }
            ];

            if (mongoose.Types.ObjectId.isValid(searchValue)) {
                orConditions.push({ _id: new mongoose.Types.ObjectId(searchValue) });
            }

            const usuariosEncontrados = await Usuario.find({ $or: orConditions }).select('_id').lean();
            const userIds = usuariosEncontrados.map(u => u._id.toString());

            const aporteOr = [];
            if (userIds.length > 0) {
                aporteOr.push({ usuarioId: { $in: userIds } });
            }

            if (mongoose.Types.ObjectId.isValid(searchValue)) {
                aporteOr.push({ _id: new mongoose.Types.ObjectId(searchValue) });
                aporteOr.push({ usuarioId: searchValue });
            } else if (userIds.length === 0) {
                // También permitir buscar si el campo usuarioId almacena strings directos
                aporteOr.push({ usuarioId: { $regex: searchValue, $options: 'i' } });
            }

            if (aporteOr.length > 0) {
                filtro = {
                    $and: [
                        { $or: [{ aporte: false }, { aporte: { $exists: false } }, { aporte: null }] },
                        { $or: aporteOr }
                    ]
                };
            } else {
                return res.status(200).json({
                    aportes: [],
                    pagination: {
                        currentPage: pageNum,
                        totalPages: 0,
                        totalItems: 0,
                        itemsPerPage: limitNum,
                        hasNext: false,
                        hasPrev: false,
                        nextPage: null,
                        prevPage: null
                    }
                });
            }
        }

        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        const [aportes, total] = await Promise.all([
            Aporte.find(filtro)
                .sort(sort)
                .skip(skip)
                .limit(limitNum)
                .lean(),
            Aporte.countDocuments(filtro)
        ]);

        if (aportes.length === 0) {
            return res.status(200).json({
                aportes: [],
                pagination: {
                    currentPage: pageNum,
                    totalPages: 0,
                    totalItems: 0,
                    itemsPerPage: limitNum,
                    hasNext: false,
                    hasPrev: false,
                    nextPage: null,
                    prevPage: null
                }
            });
        }

        const usuarioIdsFromAportes = [...new Set(aportes.map(a => a.usuarioId).filter(Boolean))];
        const usuarios = await Usuario.find({ _id: { $in: usuarioIdsFromAportes } })
            .select('nombre_completo nombre_usuario padre_id nivel dni correo_electronico linea_llamadas linea_whatsapp banco cuenta_numero')
            .lean();

        const usuariosMap = {};
        usuarios.forEach(u => {
            usuariosMap[u._id.toString()] = u;
        });

        const padreIds = [...new Set(usuarios.filter(u => u.padre_id).map(u => u.padre_id))];
        const padres = padreIds.length > 0 ? await Usuario.find({ _id: { $in: padreIds } }).select('nombre_completo _id').lean() : [];
        const padresMap = {};
        padres.forEach(p => {
            padresMap[p._id.toString()] = p;
        });

        const aportesConUsuarios = aportes.map(aporte => {
            const usuario = usuariosMap[aporte.usuarioId];
            return {
                ...aporte,
                usuario: usuario ? {
                    nombre_completo: usuario.nombre_completo,
                    nombre_usuario: usuario.nombre_usuario,
                    nivel: usuario.nivel,
                    dni: usuario.dni,
                    correo_electronico: usuario.correo_electronico,
                    linea_llamadas: usuario.linea_llamadas,
                    linea_whatsapp: usuario.linea_whatsapp,
                    banco: usuario.banco,
                    cuenta_numero: usuario.cuenta_numero,
                    padre: usuario.padre_id ? {
                        id: usuario.padre_id,
                        nombre: padresMap[usuario.padre_id]?.nombre_completo || 'No disponible'
                    } : null
                } : {
                    nombre_completo: 'Usuario no registrado',
                    nombre_usuario: '---',
                    nivel: 'N/A',
                    dni: 'N/A',
                    padre: null
                }
            };
        });

        const totalPages = Math.ceil(total / limitNum);
        res.status(200).json({
            aportes: aportesConUsuarios,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalItems: total,
                itemsPerPage: limitNum,
                hasNext: pageNum < totalPages,
                hasPrev: pageNum > 1,
                nextPage: pageNum < totalPages ? pageNum + 1 : null,
                prevPage: pageNum > 1 ? pageNum - 1 : null
            }
        });
    } catch (error) {
        console.error('Error al obtener aportes no validados:', error);
        res.status(500).json({ 
            message: 'Error en el servidor', 
            error: error.message 
        });
    }
};

module.exports = {
    crearAporte,
    obtenerEstadoAporteUsuario,
    obtenerAportes,
    obtenerAportePorId,
    actualizarAporte,
    validarAportesEnLote,
    obtenerAportesPaginados,
    obtenerAportesNoValidados,
    eliminarAporte
};
