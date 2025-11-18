```js
/*
Route GET /
Quand l'utilisateur ouvre ManageFictionScreen pour créer/modifier une fiction, les suggestions d'authors et languages seront basées sur ses fictions les plus récentes en premier.


Paramètre	        Signification	                Exemple
from	            Collection à joindre	        'fandoms'
localField	        Clé étrangère dans Fiction	    'fandomId' (ObjectId)
foreignField	    Clé primaire dans Fandom	    '_id' (ObjectId)
as	                Nom du champ ajouté	            'fandomInfo' (tableau)

Important : as crée un tableau

fandomName: { $arrayElemAt: ['$fandomInfo.name', 0] },
D'habitude pas de propriété sur un tableau, mais ici c'est une spcéficité de MongoDB.

*/