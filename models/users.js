const mongoose = require('mongoose');

// Values allowed to customize the notation icon and appearance mode.
const NOTATION_ICON_TYPES = ['heart', 'star', 'flame','diamond'];
const APPEARANCE_MODES = ["light", "dark", "system"];

const userSchema = new mongoose.Schema({
    username: { type: String, trim: true, required: true, unique: true }, // Unique = automatic index
    email: { type: String, trim: true, required: true, unique: true }, // Unique = automatic index
    avatarURL: { type: String, trim: true },
    passwordHash: { type: String, required: true },
    token: { type: String, trim: true, unique: true }, // Unique = automatic index
    themeId: { type: mongoose.Schema.Types.ObjectId, ref: 'themes' }, // plus tard : mettre par défaut l'ObjectId du thème watercolor une fois qu'il sera créé en base
    appearanceMode: { type: String, enum: APPEARANCE_MODES, default: 'system' },
    notationIcon: { type: String, enum: NOTATION_ICON_TYPES, default: 'heart' },
    lastConnectedAt: { type: Date, default: Date.now },
},
{
    timestamps: true,
});

const User = mongoose.model('User', userSchema);

module.exports = { User, NOTATION_ICON_TYPES, APPEARANCE_MODES };