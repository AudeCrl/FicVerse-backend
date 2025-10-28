const mongoose = require('mongoose');

// Values allowed to customize the notation icon and appearance mode.
const NOTATION_ICON_TYPES = ['heart', 'star', 'flame','diamond'];
const APPEARANCE_MODES = ["light", "dark", "system"];

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    avatarURL: String,
    passwordHash: { type: String, required: true },
    token: { type: String, index: true },
    themeId: { type: mongoose.Schema.Types.ObjectId, ref: 'themes' },
    appearanceMode: { type: String, enum: APPEARANCE_MODES, default: 'system' },
    notationIcon: { type: String, enum: NOTATION_ICON_TYPES, default: 'heart' },
    createdAt: Date,
    lastConnectedAt: Date,
});

const User = mongoose.model('User', userSchema);

module.exports = { User, NOTATION_ICON_TYPES, APPEARANCE_MODES };