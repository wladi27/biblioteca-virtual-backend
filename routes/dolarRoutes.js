const express = require('express');
const router = express.Router();
const dolarController = require('../controllers/dolarController');

// GET the dollar value
router.get('/', dolarController.getDolarValue);

// CREATE a new dollar value
router.post('/', dolarController.createDolarValue);

// UPDATE the dollar value
router.put('/', dolarController.updateDolarValue);

// DELETE the dollar value
router.delete('/', dolarController.deleteDolarValue);

module.exports = router;