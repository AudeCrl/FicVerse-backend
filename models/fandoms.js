const mongoose = require('mongoose');

const fandomSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true }, // champ ajouté pour permettre à chaque user d'avoir son propre ordre personnalisé de fandoms. Si validé, alors mettre sur Draw.io
  name: { type: String, trim: true, required: true },
  position: Number,
  },
  { timestamps: true }
);

// Index similaire à celui de userfictiontags. Au lieu de scanner la totalité des fandoms pour retrouver ceux dont le userID contiennent mon userID. Puis les trier ensuite.
// Tandis qu'ici, Mongo saute directement à la zone du user, et lit les docs déjà triés par position. Ex : lorsqu'on fera une requête db.fandoms.find({ userId: ObjectId("Younes") }).sort({ position: 1 })
fandomSchema.index({ userId: 1, position: 1 });

const Fandom = mongoose.model('Fandom', fandomSchema);

module.exports = { Fandom };
