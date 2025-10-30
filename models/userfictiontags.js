const mongoose = require('mongoose');

const userFictionTagsSchema = new mongoose.Schema({
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
    fictionId:  { type: mongoose.Schema.Types.ObjectId, ref: 'fictions', required: true },
    tags:       [{ type: mongoose.Schema.Types.ObjectId, ref: 'tags', required: true }],
  },
  { timestamps: true }
);

/* 
If I don't put the unicity couple, I will have this :
{ userId: "U1", fictionId: "F1", tags: [T1, T2] }
{ userId: "U1", fictionId: "F1", tags: [T3] }
{ userId: "U1", fictionId: "F1", tags: [T4, T5] }

Instead of this :
  {
  userId: "U1",
  fictionId: "F1",
  tags: [T1, T2, T3, T4, T5]
}
*/

//  Unicité : une seule ligne par couple (userId, fictionId)
userFictionTagsSchema.index({ userId: 1, fictionId: 1 }, { unique: true });

// Filtrer rapidement les fictions d’un user par tag.
userFictionTagsSchema.index({ userId: 1, tags: 1 });

/* 
Si je n'avais pas mis en place cet index, MongoDB aurait parcouru toutes les documents pour vérifier d'abord le userId == le userId demandé.
Puis scanner tous les tags == le tag demandé.
Alors qu'avec cet index, MongoDB va directement récupérer l'information dans le userID concerné ET dans le tag concerné.
Ex : { userId: U1, tags: [T1, T2, T70] }.
Si je fais une requête pour chercher { userId: U1, tags: T70 }
MongoDB va directement aller jusqu'à userId = U1 et aller directement à tags = T70.
*/

const UserFictionTag = mongoose.model('UserFictionTag', userFictionTagsSchema);

module.exports = { UserFictionTag };

