// routes/publicacionRoutes.js
const express = require('express');
const multer = require('multer');
const path = require('path'); // Asegúrate de importar el módulo 'path'
const {
    crearPublicacion,
    obtenerPublicaciones,
    obtenerPublicacionPorId,
    actualizarPublicacion,
    eliminarPublicacion
} = require('../controllers/publicacionController');

const router = express.Router();

// Configuración de multer para manejar la carga de archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Carpeta donde se guardarán los archivos
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Agregar timestamp al nombre del archivo
    }
});

const upload = multer({ storage });

// Rutas para las publicaciones
router.post('/', upload.single('file'), crearPublicacion);
router.get('/', obtenerPublicaciones);
router.get('/:id', obtenerPublicacionPorId);
router.put('/:id', upload.single('file'), actualizarPublicacion);
router.delete('/:id', eliminarPublicacion);

module.exports = router;
