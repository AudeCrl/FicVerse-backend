var express = require("express");
var router = express.Router();

const { User } = require("../models/users");
const Fandom = require("../models/fandoms");
const Fiction = require("../models/fictions");

// GET /fandom/user -> Get user's fandoms
router.get("/user", async (req, res) => {
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

    const fandoms = await Fandom.find({ userId: user._id }).sort({
      position: 1,
    });

    return res.json({ result: true, fandoms });
  } catch (error) {
    console.error("Error fetching user fandoms:", error);
    return res
      .status(500)
      .json({ result: false, error: "Internal server error" });
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

// GET /fandom -> Get all fandoms for the user
router.get("/", async (req, res) => {
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

    const fandoms = await Fandom.find({ userId: user._id }).sort({
      position: 1,
    });

    return res.json({ result: true, fandoms });
  } catch (error) {
    console.error("Error fetching fandoms:", error);
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

module.exports = router;
