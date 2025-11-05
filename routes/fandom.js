var express = require('express');
var router = express.Router();

const { User } = require('../models/users');
const Fandom = require('../models/fandoms');

// GET /fandom -> liste des fandoms du user, triés par position asc
router.get('/', async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    if (!token) return res.status(401).json({ result: false, error: 'Missing token' });

    const user = await User.findOne({ token });
    if (!user) return res.status(401).json({ result: false, error: 'Invalid or expired token' });

    const fandoms = await Fandom
      .find({ userId: user._id })
      .sort({ position: 1 }) // tri par position
      .lean();

    return res.json({ result: true, fandoms });

  } catch (error) {
    console.error('GET /fandom failed:', error);
    return res.status(500).json({ result: false, error: 'Internal server error' });
  }
});

// POST /fandom -> crée un nouveau fandom (user-scope) avec position = nb+1
router.post('/', async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    if (!token) return res.status(401).json({ result: false, error: 'Missing token' });

    const user = await User.findOne({ token });
    if (!user) return res.status(401).json({ result: false, error: 'Invalid or expired token' });

    const fandomLabel = String(req.body.name || '').trim();   // S jamais le back reçoit un name vide, on a la sécurité || ""
    if (!fandomLabel) return res.json({ result: false, error: 'Missing name' });

    // dédoublonnage simple: même nom exact (casse ignorée) pour ce user
    const existing = await Fandom.findOne({ userId: user._id, name: { $regex: `^${fandomLabel}$`, $options: 'i' } });
    if (existing) {
      return res.json({ result: true, created: false, fandom: existing });
    }

    const positionFandom = (await Fandom.countDocuments({ userId: user._id })) + 1;
    const newfandom = await new Fandom({ userId: user._id, name: fandomLabel, position: positionFandom }).save();

    return res.json({ result: true, created: true, fandom: newfandom })
    ;
  } catch (error) {
    console.error('POST /fandom failed:', error);
    return res.status(500).json({ result: false, error: 'Internal server error' });
  }
});

module.exports = router;
