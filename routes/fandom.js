var express = require("express");
var router = express.Router();

const { User } = require("../models/users");
const Fandom = require("../models/fandoms");
const Fiction = require("../models/fictions");

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

    return res.json({ result: true, fandoms });

  } catch (error) {
    console.error('GET /fandom failed:', error);
    return res.status(500).json({ result: false, error: 'Internal server error' });
  }
});

// GET /fandom/:id/usage-count -> Count how many fictions use this fandom
router.get("/:id/usage-count", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        result: false,
        error: "Missing token in Authorization header",
      });
    }

    const user = await User.findOne({ token });
    if (!user) {
      return res
        .status(401)
        .json({ result: false, error: "Invalid or expired token" });
    }

    const fandomId = req.params.id;

    // Check if fandom exists and belongs to user
    const fandom = await Fandom.findOne({
      _id: fandomId,
      userId: user._id,
    });

    if (!fandom) {
      return res.status(404).json({ result: false, error: "Fandom not found" });
    }

    // Count fictions using this fandom
    const usageCount = await Fiction.countDocuments({
      fandomId: fandomId,
      userId: user._id,
    });

    return res.json({
      result: true,
      usageCount,
      fandomName: fandom.name,
    });
  } catch (error) {
    console.error("Error counting fandom usage:", error);
    return res
      .status(500)
      .json({ result: false, error: "Internal server error" });
  }
});

// DELETE /fandom/:id -> Delete a fandom
// Query params:
// - detach=true: Remove fandom from all fictions before deleting
// - force=true: Delete even if used
router.delete("/:id", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        result: false,
        error: "Missing token in Authorization header",
      });
    }

    const user = await User.findOne({ token });
    if (!user) {
      return res
        .status(401)
        .json({ result: false, error: "Invalid or expired token" });
    }

    const fandomId = req.params.id;
    const { detach, force } = req.query;

    // Check if fandom exists and belongs to user
    const fandom = await Fandom.findOne({
      _id: fandomId,
      userId: user._id,
    });

    if (!fandom) {
      return res.status(404).json({ result: false, error: "Fandom not found" });
    }

    // Count fictions using this fandom
    const usageCount = await Fiction.countDocuments({
      fandomId: fandomId,
      userId: user._id,
    });

    // If fandom is used and no override is provided
    if (usageCount > 0 && !detach && !force) {
      return res.status(400).json({
        result: false,
        error: "Fandom is still in use",
        usageCount,
        requiresConfirmation: true,
      });
    }

    // If detach=true, remove fandom from all fictions
    if (detach && usageCount > 0) {
      await Fiction.updateMany(
        { fandomId: fandomId, userId: user._id },
        { $unset: { fandomId: "" } }
      );
    }

    // Delete the fandom
    await Fandom.deleteOne({ _id: fandomId, userId: user._id });

    return res.json({
      result: true,
      message: "Fandom deleted successfully",
      wasDetached: detach && usageCount > 0,
      detachedFromCount: detach ? usageCount : 0,
    });
  } catch (error) {
    console.error("Error deleting fandom:", error);
    return res
      .status(500)
      .json({ result: false, error: "Internal server error" });
  }
});

// POST /fandom -> crée un nouveau fandom (user-scope) avec position = nb+1
router.post('/', async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    if (!token) return res.status(401).json({ result: false, error: 'Missing token' });

    const user = await User.findOne({ token });
    if (!user) return res.status(401).json({ result: false, error: 'Invalid or expired token' });

    const fandomLabel = String(req.body.name || '').trim();   // Si jamais le back reçoit un name vide, on a la sécurité || ""
    if (!fandomLabel) return res.json({ result: false, error: 'Missing name' });

    // dédoublonnage simple: même nom exact (casse ignorée) pour ce user
    const existing = await Fandom.findOne({ userId: user._id, name: { $regex: `^${fandomLabel}$`, $options: 'i' } });
    if (existing) {
      return res.json({ result: true, created: false, fandom: existing });
    }

    const positionFandom = (await Fandom.countDocuments({ userId: user._id })) + 1;
    const newfandom = await new Fandom({ userId: user._id, name: fandomLabel, position: positionFandom }).save();
    return res.json({ result: true, created: true, fandom: newfandom });
    
  } catch (error) {
    console.error('POST /fandom failed:', error);
    return res.status(500).json({ result: false, error: 'Internal server error' });
  }
});

module.exports = router;
