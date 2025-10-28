var express = require('express');
var router = express.Router();

const { checkBody } = require('../modules/checkBody');

// POST /fiction -> CREATE A FICTION
router.post('/', async (req, res) => {
    try {
    } catch (error) {
        console.error('Error while fetching fictions:', error);
        return res.status(500).json({ result: false, error: 'Internal server error' });
    }
});

// GET /fiction -> RETRIEVE ALL FICTIONS
router.get('/', async (req, res) => {
    try {
    } catch (error) {
        console.error('Error while fetching fictions:', error);
        return res.status(500).json({ result: false, error: 'Internal server error' });
    }
});

module.exports = router;
