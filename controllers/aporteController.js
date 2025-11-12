const Aporte = require('../models/aporteModel');

// Crear un nuevo aporte
const crearAporte = async (req, res) => {
    const { usuarioId } = req.body;

    if (!usuarioId) {
        return res.status(400).json({ error: 'El ID del usuario es requerido' });
    }

    try {
        const { usuarioId, aporte } = req.body;
        const nuevoAporte = new Aporte({ usuarioId, aporte });
        await nuevoAporte.save();
        res.status(201).json(nuevoAporte);
    } catch (err) {
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
        const aporteActualizado = await Aporte.findByIdAndUpdate(id, { usuarioId, aporte }, { new: true });
        if (!aporteActualizado) {
            return res.status(404).json({ error: 'Aporte no encontrado' });
        }
        res.status(200).json(aporteActualizado);
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar el aporte' });
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
        res.status(204).json();
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
            sortBy = 'fecha_creacion',
            sortOrder = 'desc'
        } = req.query;

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Construir filtro de búsqueda
        let filtro = {};
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            filtro = {
                $or: [
                    { usuarioId: searchRegex },
                    { aporte: searchRegex }
                ]
            };
        }

        // Construir ordenamiento
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Obtener aportes con paginación y popular información de usuario
        const aportes = await Aporte.find(filtro)
            .select('usuarioId aporte fecha_creacion')
            .sort(sort)
            .skip(skip)
            .limit(limitNum)
            .lean();

        // Obtener los IDs de usuarios únicos
        const usuarioIds = [...new Set(aportes.map(aporte => aporte.usuarioId))];
        
        // Obtener información de usuarios en una sola consulta
        const Usuario = require('../models/usuario'); // Asegúrate de importar el modelo
        const usuarios = await Usuario.find({ _id: { $in: usuarioIds } })
            .select('nombre_completo nombre_usuario padre_id nivel')
            .lean();

        // Crear un mapa de usuarios para acceso rápido
        const usuariosMap = {};
        usuarios.forEach(usuario => {
            usuariosMap[usuario._id.toString()] = usuario;
        });

        // Obtener información de los padres si existen
        const padreIds = [...new Set(usuarios.filter(u => u.padre_id).map(u => u.padre_id))];
        const padres = await Usuario.find({ _id: { $in: padreIds } })
            .select('nombre_completo _id')
            .lean();

        const padresMap = {};
        padres.forEach(padre => {
            padresMap[padre._id.toString()] = padre;
        });

        // Combinar aportes con información de usuarios
        const aportesConUsuarios = aportes.map(aporte => {
            const usuario = usuariosMap[aporte.usuarioId];
            let usuarioInfo = null;
            
            if (usuario) {
                usuarioInfo = {
                    nombre_completo: usuario.nombre_completo,
                    nombre_usuario: usuario.nombre_usuario,
                    nivel: usuario.nivel,
                    padre: usuario.padre_id ? {
                        id: usuario.padre_id,
                        nombre: padresMap[usuario.padre_id]?.nombre_completo || 'No disponible'
                    } : null
                };
            }

            return {
                ...aporte,
                usuario: usuarioInfo
            };
        });

        // Obtener total de documentos para la paginación
        const total = await Aporte.countDocuments(filtro);

        // Calcular información de paginación
        const totalPages = Math.ceil(total / limitNum);
        const hasNext = pageNum < totalPages;
        const hasPrev = pageNum > 1;

        res.status(200).json({
            aportes: aportesConUsuarios,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalItems: total,
                itemsPerPage: limitNum,
                hasNext,
                hasPrev,
                nextPage: hasNext ? pageNum + 1 : null,
                prevPage: hasPrev ? pageNum - 1 : null
            }
        });
    } catch (error) {
        console.error('Error al obtener aportes paginados:', error);
        res.status(500).json({ 
            message: 'Error en el servidor', 
            error: error.message 
        });
    }
};

// Obtener solo aportes NO VALIDADOS con paginación y filtros
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

        // Importar modelo de Usuario
        const Usuario = require('../models/usuario');
        const mongoose = require('mongoose');

        let filtro = { 
            $or: [
                { aporte: false },
                { aporte: { $exists: false } },
                { aporte: null }
            ]
        };

        let usuarioIdsFromSearch = [];

        // Si hay búsqueda, buscar solo en usuarios
        if (search && search.trim() !== '') {
            const searchValue = search.trim();
            
            console.log(`🔍 Buscando usuarios con término: "${searchValue}"`);

            // Buscar usuarios que coincidan con la búsqueda
            const usuariosEncontrados = await Usuario.find({
                $or: [
                    { nombre_completo: { $regex: searchValue, $options: 'i' } },
                    { nombre_usuario: { $regex: searchValue, $options: 'i' } },
                    { dni: { $regex: searchValue, $options: 'i' } }
                ]
            }).select('_id').lean();

            usuarioIdsFromSearch = usuariosEncontrados.map(usuario => usuario._id.toString());
            
            console.log(`🔍 Usuarios encontrados: ${usuarioIdsFromSearch.length}`);

            // Si encontramos usuarios, filtrar por sus IDs
            if (usuarioIdsFromSearch.length > 0) {
                console.log(`🔍 IDs de usuarios encontrados: ${usuarioIdsFromSearch.join(', ')}`);
                filtro = {
                    $and: [
                        { 
                            $or: [
                                { aporte: false },
                                { aporte: { $exists: false } },
                                { aporte: null }
                            ]
                        },
                        { usuarioId: { $in: usuarioIdsFromSearch } }
                    ]
                };
            } else {
                // Si no encontramos usuarios, no mostrar nada
                console.log('🔍 No se encontraron usuarios, retornando vacío');
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

        console.log('🔍 Filtro final aplicado:', JSON.stringify(filtro, null, 2));

        // Construir ordenamiento
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Obtener aportes NO VALIDADOS con paginación
        const aportes = await Aporte.find(filtro)
            .select('usuarioId aporte fecha_creacion')
            .sort(sort)
            .skip(skip)
            .limit(limitNum)
            .lean();

        console.log(`📊 Aportes NO VALIDADOS encontrados: ${aportes.length} para búsqueda: "${search}"`);

        // Obtener total de documentos NO VALIDADOS para la paginación
        const total = await Aporte.countDocuments(filtro);
        console.log(`📈 Total de aportes no validados: ${total}`);

        // Si no hay aportes, retornar vacío
        if (aportes.length === 0) {
            return res.status(200).json({
                aportes: [],
                pagination: {
                    currentPage: pageNum,
                    totalPages: 0,
                    totalItems: total,
                    itemsPerPage: limitNum,
                    hasNext: false,
                    hasPrev: false,
                    nextPage: null,
                    prevPage: null
                }
            });
        }

        // Obtener los IDs de usuarios únicos de los aportes
        const usuarioIdsFromAportes = [...new Set(aportes.map(aporte => aporte.usuarioId))];
        
        console.log(`👥 IDs de usuarios a buscar: ${usuarioIdsFromAportes.length}`);
        
        // Obtener información completa de usuarios
        const usuarios = await Usuario.find({ _id: { $in: usuarioIdsFromAportes } })
            .select('nombre_completo nombre_usuario padre_id nivel dni')
            .lean();

        // Crear un mapa de usuarios para acceso rápido
        const usuariosMap = {};
        usuarios.forEach(usuario => {
            usuariosMap[usuario._id.toString()] = usuario;
        });

        console.log(`✅ Usuarios encontrados: ${usuarios.length}`);

        // Obtener información de los padres si existen
        const padreIds = [...new Set(usuarios.filter(u => u.padre_id).map(u => u.padre_id))];
        const padres = padreIds.length > 0 ? await Usuario.find({ _id: { $in: padreIds } })
            .select('nombre_completo _id')
            .lean() : [];

        const padresMap = {};
        padres.forEach(padre => {
            padresMap[padre._id.toString()] = padre;
        });

        // Combinar aportes con información de usuarios
        const aportesConUsuarios = aportes.map(aporte => {
            const usuario = usuariosMap[aporte.usuarioId];
            let usuarioInfo = null;
            
            if (usuario) {
                usuarioInfo = {
                    nombre_completo: usuario.nombre_completo,
                    nombre_usuario: usuario.nombre_usuario,
                    nivel: usuario.nivel,
                    dni: usuario.dni,
                    padre: usuario.padre_id ? {
                        id: usuario.padre_id,
                        nombre: padresMap[usuario.padre_id]?.nombre_completo || 'No disponible'
                    } : null
                };
            } else {
                usuarioInfo = {
                    nombre_completo: 'Usuario no encontrado',
                    nombre_usuario: '---',
                    nivel: 'N/A',
                    dni: 'N/A',
                    padre: null
                };
            }

            return {
                ...aporte,
                usuario: usuarioInfo
            };
        });

        // Calcular información de paginación
        const totalPages = Math.ceil(total / limitNum);
        const hasNext = pageNum < totalPages;
        const hasPrev = pageNum > 1;

        res.status(200).json({
            aportes: aportesConUsuarios,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalItems: total,
                itemsPerPage: limitNum,
                hasNext,
                hasPrev,
                nextPage: hasNext ? pageNum + 1 : null,
                prevPage: hasPrev ? pageNum - 1 : null
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
    obtenerAportes,
    obtenerAportePorId,
    actualizarAporte,
    obtenerAportesPaginados,
    obtenerAportesNoValidados,
    eliminarAporte
};
