const mongoose = require('mongoose');

const themeSchema = new mongoose.Schema({
    name: { type: String, trim: true, required: true },
    image: { type: String, trim: true, required: false },  // je dois mettre une image obligatoirement ou pas ?
  },
  { timestamps: true }
);

themeSchema.index({ name: 1 }, { unique: true });

const Theme = mongoose.model('Theme', themeSchema);

module.exports = { Theme };
