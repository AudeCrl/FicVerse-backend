const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema({
    name: { type: String, trim: true, required: true },
    usageCount: { type: Number, default: 0 },
    color: { type: Number, required: true }, // je mets required: true car j'estime qu'il faudra une couleur obligatoirement par tag. Me corriger si ce n'est pas bon.
  },
  { timestamps: true }
);

/*
L'index sur name ordonne à MongoDB de créer une table des matières triée (un B-tree) pour accéder très vite aux documents selon leur name.
Ça rend instantané les requêtes du type : db.tags.find({ name: "romance" })
Même si on a des milliers de tags.
*/

// unique: true me permet d'éviter les doublons incohérents (“romance” / “Romance ” / “Romance❤️”).
tagSchema.index({ name: 1 }, { unique: true });

const Tag = mongoose.model('Tag', tagSchema);

module.exports = { Tag };
