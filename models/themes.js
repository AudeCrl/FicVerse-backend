const mongoose = require('mongoose');

const themeSchema = new mongoose.Schema({
    name: { type: String, trim: true, required: true },
    image: { type: String, trim: true },
    active: Boolean,
  },
  { timestamps: true }
);

themeSchema.index({ name: 1 }, { unique: true });

const Theme = mongoose.model('Theme', themeSchema);

module.exports = { Theme };
