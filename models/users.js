const mongoose = require('mongoose');

// Values allowed to customize the notation icon, theme and appearance mode.
const NOTATION_ICON_TYPES = ['heart', 'star', 'flame','diamond'];
const THEMES = ['watercolor', 'ashgreen'];
const APPEARANCE_MODES = ['light', 'dark'];

const userSchema = new mongoose.Schema({
    username: { type: String, trim: true, required: true, unique: true }, // Unique = automatic index
    email: { type: String, trim: true, required: true, unique: true }, // Unique = automatic index
    avatarURL: { type: String, trim: true },
    passwordHash: { type: String, required: true },
    token: { type: String, trim: true, unique: true }, // Unique = automatic index
    theme: { type: String, enum: THEMES, default: 'watercolor' },
    appearanceMode: { type: String, enum: APPEARANCE_MODES, default: 'light' },
    notationIcon: { type: String, enum: NOTATION_ICON_TYPES, default: 'heart' },
    lastConnectedAt: { type: Date, default: Date.now },
},
{
    timestamps: true,
});

const User = mongoose.model('User', userSchema);

module.exports = { User, NOTATION_ICON_TYPES, APPEARANCE_MODES };