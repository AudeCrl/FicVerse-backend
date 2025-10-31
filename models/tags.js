const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
    name: { type: String, trim: true, required: true },
    usageCount: { type: Number, default: 0 },
    color: { type: Number, required: true },
  },
  { timestamps: true }
);

/*
L'index sur name ordonne à MongoDB de créer une table des matières triée (un B-tree) pour accéder très vite aux documents selon leur name.
Ça rend instantané les requêtes du type : db.tags.find({ name: "romance" })
Même si on a des milliers de tags.
*/

// unique: true me permet d'éviter les doublons incohérents (“romance” / “Romance ” / “Romance❤️”).
tagSchema.index({ userId: 1, name: 1 }, { unique: true });

// Most used tags
tagSchema.index({ userId: 1, usageCount: -1 });

const Tag = mongoose.model('Tag', tagSchema);

module.exports = { Tag };
