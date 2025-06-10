const express = require('express');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');
const {
    crearPublicacion,
    obtenerPublicaciones,
    obtenerPublicacionPorId,
    actualizarPublicacion,
    eliminarPublicacion
} = require('../controllers/publicacionController');

const router = express.Router();

// Configuración de multer-storage-cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'publicaciones',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'mp4', 'webp', 'webm', 'ogg'], // Agrega webm y ogg
    public_id: (req, file) => Date.now() + '-' + file.originalname.replace(/\s/g, ''),
    resource_type: 'auto', // IMPORTANTE: permite subir imágenes, videos y pdf
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
});

// Rutas para las publicaciones
router.post('/', upload.single('file'), crearPublicacion);
router.get('/', obtenerPublicaciones);
router.get('/:id', obtenerPublicacionPorId);
router.put('/:id', upload.single('file'), actualizarPublicacion);
router.delete('/:id', eliminarPublicacion);

module.exports = router;