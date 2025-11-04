var express = require('express');
var router = express.Router();
const { User } = require('../models/users');
const Tag = require('../models/tags');

// GET /tags -> tous les tags du user connecté
router.get("/", async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    if (!token) return res.status(401).json({ result: false, error: "Missing token" });

    const user = await User.findOne({ token });
    if (!user) return res.status(401).json({ result: false, error: "Invalid or expired token" });

    const tags = await Tag.find({ userId: user._id }) // On cherche dans la collection Tag le user ayant cet id. 
      .sort({ usageCount: -1, name: 1 })              // Ce sort est un tri sur les résultats : usageCount: -1 → tri décroissant (du plus utilisé au moins utilisé), name: 1 → si deux tags ont le même usageCount, on les trie par ordre alphabétique (croissant).
      .lean();                                        // lean est intéressant quand il y aura des centaines de tags, ça permet de dire const tags = des simples objets JS plutôt que des documents mongoose enrichis. Meilleure performance.

    return res.json({ result: true, tags });

  } catch (error) {
    console.error("GET /tags failed:", error);
    return res.status(500).json({ result: false, error: "Internal server error" });
  }
});

module.exports = router;