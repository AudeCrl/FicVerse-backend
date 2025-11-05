var express = require("express");
var router = express.Router();
const { User } = require("../models/users");
const Tag = require("../models/tags");
const UserFictionTags = require("../models/userfictiontags");

// GET /tag -> tous les tags du user connecté
router.get("/", async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    if (!token)
      return res.status(401).json({ result: false, error: "Missing token" });

    const user = await User.findOne({ token });
    if (!user)
      return res
        .status(401)
        .json({ result: false, error: "Invalid or expired token" });

    const tags = await Tag.find({ userId: user._id }) // On cherche dans la collection Tag le user ayant cet id.
      .sort({ usageCount: -1, name: 1 }) // Ce sort est un tri sur les résultats : usageCount: -1 → tri décroissant (du plus utilisé au moins utilisé), name: 1 → si deux tags ont le même usageCount, on les trie par ordre alphabétique (croissant).
      .lean(); // lean est intéressant quand il y aura des centaines de tags, ça permet de dire const tags = des simples objets JS plutôt que des documents mongoose enrichis. Meilleure performance.

    return res.json({ result: true, tags });
  } catch (error) {
    console.error("GET /tags failed:", error);
    return res
      .status(500)
      .json({ result: false, error: "Internal server error" });
  }
});

// GET /tag/all -> tous les tags de l'utilisateur (pour le formulaire d'ajout)
router.get("/all", async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    if (!token)
      return res.status(401).json({ result: false, error: "Missing token" });

    const user = await User.findOne({ token });
    if (!user)
      return res
        .status(401)
        .json({ result: false, error: "Invalid or expired token" });

    // Retourner tous les tags de l'utilisateur
    const tags = await Tag.find({ userId: user._id })
      .sort({ usageCount: -1, name: 1 })
      .lean();

    return res.json({ result: true, tags });
  } catch (error) {
    console.error("GET /tag/all failed:", error);
    return res
      .status(500)
      .json({ result: false, error: "Internal server error" });
  }
});

// POST /tag -> créer un tag orphelin
router.post("/", async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    if (!token)
      return res.status(401).json({ result: false, error: "Missing token" });

    const user = await User.findOne({ token });
    if (!user)
      return res.status(401).json({ result: false, error: "Invalid token" });

    const tagName = req.body.name;
    if (!tagName || typeof tagName !== "string" || !tagName.trim()) {
      return res.status(400).json({ result: false, error: "Missing tag name" });
    }

    const name = tagName.trim().toLowerCase();

    // Vérifie si le tag existe déjà
    let tag = await Tag.findOne({ userId: user._id, name });

    if (!tag) {
      // Si le tag n'existe pas, on le crée
      tag = await new Tag({
        userId: user._id,
        name,
        usageCount: 0,
        color: 1,
      }).save();
    }

    return res.json({ result: true, tag });
    
  } catch (error) {
    console.error("POST /tags failed:", error);
    return res
      .status(500)
      .json({ result: false, error: "Internal server error" });
  }
});

// GET /tag/:id/usage-count -> compter le nombre de fanfictions utilisant ce tag
router.get("/:id/usage-count", async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    if (!token)
      return res.status(401).json({ result: false, error: "Missing token" });

    const user = await User.findOne({ token });
    if (!user)
      return res
        .status(401)
        .json({ result: false, error: "Invalid or expired token" });

    const tagId = req.params.id;

    // Vérifier que le tag appartient à l'utilisateur
    const tag = await Tag.findOne({ _id: tagId, userId: user._id });
    if (!tag)
      return res.status(404).json({ result: false, error: "Tag not found" });

    // Compter les fictions utilisant ce tag
    const usageCount = await UserFictionTags.countDocuments({
      userId: user._id,
      tags: tagId,
    });

    return res.json({ result: true, usageCount, tagName: tag.name });
  } catch (error) {
    console.error("GET /tag/:id/usage-count failed:", error);
    return res
      .status(500)
      .json({ result: false, error: "Internal server error" });
  }
});

// DELETE /tag/:id -> supprimer un tag avec options
// query params:
//   - detach=true : détache le tag de toutes les fictions avant suppression
//   - force=true : supprime même s'il est encore utilisé (sans détacher)
router.delete("/:id", async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    if (!token)
      return res.status(401).json({ result: false, error: "Missing token" });

    const user = await User.findOne({ token });
    if (!user)
      return res
        .status(401)
        .json({ result: false, error: "Invalid or expired token" });

    const tagId = req.params.id;
    const detach = req.query.detach === "true";
    const force = req.query.force === "true";

    // Vérifier que le tag appartient à l'utilisateur
    const tag = await Tag.findOne({ _id: tagId, userId: user._id });
    if (!tag)
      return res.status(404).json({ result: false, error: "Tag not found" });

    // Compter les fictions utilisant ce tag
    const usageCount = await UserFictionTags.countDocuments({
      userId: user._id,
      tags: tagId,
    });

    // Si le tag est utilisé et qu'on n'a pas detach ou force, retourner une erreur
    if (usageCount > 0 && !detach && !force) {
      return res.json({
        result: false,
        error: "Tag is still in use",
        usageCount,
        tagName: tag.name,
        requiresConfirmation: true,
      });
    }

    // Si detach=true, retirer le tag de toutes les fictions
    if (detach && usageCount > 0) {
      // Récupérer toutes les liaisons contenant ce tag
      const links = await UserFictionTags.find({
        userId: user._id,
        tags: tagId,
      });

      // Pour chaque liaison, retirer le tag et mettre à jour usageCount
      for (const link of links) {
        link.tags = link.tags.filter((id) => id.toString() !== tagId);
        await link.save();
      }

      // Mettre à jour usageCount du tag à 0
      tag.usageCount = 0;
      await tag.save();
    }

    // Supprimer le tag
    await Tag.findByIdAndDelete(tagId);

    return res.json({
      result: true,
      message: "Tag deleted successfully",
      wasDetached: detach,
      detachedFromCount: detach ? usageCount : 0,
    });
  } catch (error) {
    console.error("DELETE /tag/:id failed:", error);
    return res
      .status(500)
      .json({ result: false, error: "Internal server error" });
  }
});

module.exports = router;
