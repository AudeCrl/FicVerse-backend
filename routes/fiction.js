var express = require('express');
var router = express.Router();

const { checkBody } = require('../modules/checkBody');
const { User } = require('../models/users');
const Fiction = require('../models/fictions');
const Fandom = require('../models/fandoms');
const UserFictionTags = require('../models/userfictiontags');
const Tag = require('../models/tags');


// GET /fiction -> Retourne toutes les fictions du user
router.get('/', async (req, res) => {
    try {
        const token = req.headers.authorization.split(" ")[1];
        if (!token) return res.status(401).json({ result: false, error: 'Missing token' });
        
        const user = await User.findOne({ token });
        if (!user) return res.status(401).json({ result: false, error: 'Invalid token' });
        
        const userId = user._id;

        const fictions = await Fiction.aggregate([
            // 1. Filtrer par userId
            { $match: { userId: userId } },

            // 2. Trier par date de dernière lecture
            { $sort: { lastReadAt: -1 } },

            // 3. Joindre le fandom pour récupérer son nom
            {
                $lookup: {
                    from: 'fandoms',
                    localField: 'fandomId',
                    foreignField: '_id',
                    as: 'fandomInfo'
                }
            },

            // 4. Projection finale (sans les tags - ils sont fetchés séparément)
            {
                $project: {
                    _id: 1,
                    userId: 1,
                    title: 1,
                    link: 1,
                    summary: 1,
                    personalNotes: 1,
                    author: 1,
                    fandomId: 1,
                    fandomName: { $arrayElemAt: ['$fandomInfo.name', 0] },
                    numberOfWords: 1,
                    numberOfChapters: 1,
                    readingStatus: 1,
                    storyStatus: 1,
                    lang: '$lang.name',
                    lastReadAt: 1,
                    image: 1,
                    rate: 1,
                    lastChapterRead: 1,
                    createdAt: 1,
                    updatedAt: 1,
                }
            }
        ]);

        return res.json({ result: true, fictions });

    } catch (error) {
        console.error('Error fetching all fictions:', error);
        return res.status(500).json({ result: false, error: 'Internal error' });
    }
});

// GET /fiction/author -> Retourne la liste unique des auteurs
router.get('/author', async (req, res) => {
    try {
        const token = req.headers.authorization.split(" ")[1];
        if (!token) return res.status(401).json({ result: false, error: 'Missing token' });

        const user = await User.findOne({ token });
        if (!user) return res.status(401).json({ result: false, error: 'Invalid token' });

        const userId = user._id;

        // Agrégation pour extraire les auteurs uniques, triés alphabétiquement
        const authorList = await Fiction.aggregate([
            // 1. Filtrer par userId
            { $match: { userId: userId } },

            // 2. Filtrer uniquement les fictions avec auteur non vide
            { $match: { author: { $exists: true, $ne: "" } } },

            // 3. Suppression des doublons : regroupe les documents par auteur pour ne garder qu'un exemplaire unique de chaque auteur
            {
                $group: {
                    _id: "$author", // Clé de groupement
                    name: { $first: "$author" }   // Valeur d'affichage (garde la 1ère occurrence)
                }
            },

            // 4. Trier alphabétiquement
            { $sort: { name: 1 } },

            // 5. Projection : seulement le nom. Pas besoin d'envoyer l'id
            { $project: { _id: 0, name: 1 } }
        ]);

        return res.json({
            result: true,
            authorList: authorList.map(a => a.name)
        });

    } catch (error) {
        console.error('Error fetching authors:', error);
        return res.status(500).json({ result: false, error: 'Internal error' });
    }
});

// GET /fiction/:readingStatus?srt=rate&order=desc -> Get fandom with fiction by readingStatus
router.get('/status/:readingStatus', async (req, res) => {
    try {        
        const { readingStatus } = req.params;
        const { srt, order } = req.query;
        
        const authHeader = req.headers.authorization;
        const token = authHeader?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ result: false, error: 'Missing token in Authorization header' });
        }

        const allowedStatus = ['to-read', 'reading', 'finished'];
        if (!allowedStatus.includes(readingStatus)) {
            return res.json({ result: false, error: 'Invalid readingStatus parameter' });            
        }

        const user = await User.findOne({ token });
        if (!user) {
            return res.status(401).json({ result: false, error: 'Invalid or expired token' });
        }

        const userId = user._id;

        let sortType = srt;
        let sortOrder = (order?.toLowerCase() === 'asc') ? 1 : -1; //Conversion ordre en tri en number

        if (!sortType) {
            sortType = 'lastReadAt';
        }
        /*
        const allowedSortTypes = ['title', 'author', 'numberOfWords', 'lastReadAt', 'createdAt', 'rate']; // A activer quand vu avec le front //Type de tri authorisé

        // Erreur si le type de tri n'est pas authorisé
        if ( sortType && !allowedSortTypes.includes(sortType) ) {
            return res.json({ result : false, error: 'This sort type is not allowed' });
        };
        */
        
        //rate deviens rate.value car c'est un sous document
        if (sortType === 'rate') {
            sortType = 'rate.value';
        }
        
        const sort = { [sortType]: sortOrder } //Création du tri qui sera dans la pipeline
        console.log('Sort type :', sort);
        

        const pipeline = [
            //1. Filtrer les fandoms par leur userId
            { $match: { userId: userId } },

            //2.Trier les fandom par leur propriété 'position' croissant
            { $sort: { position: 1 } },

            {
                $lookup: {
                    from: 'fictions', // Effectue la jointure dans la collection 'fictions'
                    let: { fandomId: '$_id', userId: userId, readingStatus: readingStatus }, //Variable passé à la sous-pipeline
                    pipeline: [ //Filtrage des fictions
                        {
                            $match: {
                                $expr: { //Précise les conditions qui valideront la comparaison
                                    $and: [ //Précise que TOUTES les conditions doivent etre respecté
                                        { $eq: ['$fandomId', '$$fandomId'] }, //'égalité' prend 2 argument et renvoi true si la condition est respecté ($: info dans la BD, $$: infor transmise par le parent)
                                        { $eq: ['$userId', '$$userId'] },
                                        { $eq: ['$readingStatus', '$$readingStatus'] },
                                    ]
                                }
                            }
                        },
                        { $sort: sort }, //Tri créé précedement
                        {
                            $lookup: {
                                from: 'userfictiontags',
                                localField: '_id',
                                foreignField: 'fictionId',
                                as: 'tagLinks',
                            }
                        },
                        {
                            $project: {
                                tagsIdArray: {
                                    $reduce:{
                                        input: "$tagLinks.tags",
                                        initialValue: [],
                                        in: { $concatArrays: ['$$value', '$$this']}
                                    }
                                },
                                // Inclure touts les autres champs de la fiction
                                _id: 1, userId: 1, title: 1, link: 1, summary: 1, personalNotes: 1, author: 1, fandomId: 1, 
                                numberOfWords: 1, numberOfChapters: 1, readingStatus: 1, storyStatus: 1, lang: 1, 
                                lastReadAt: 1, image: 1, rate: 1, lastChapterRead: 1, createdAt: 1, updatedAt: 1, __v: 1
                            }
                        },
                        {
                            $lookup: {
                                from: 'tags',
                                localField: 'tagsIdArray',
                                foreignField: '_id',
                                as: 'tags',
                            }
                        },
                        {
                            $addFields: { //Permet d'ecraser le contenu du tableau 'tags' créé à l'étape précedente
                                tags: { //Tableau recevant le resultat du tri
                                    $sortArray: { //Permet de trié le contenu d'un tableau
                                        input: '$tags', //Le tableau ajouté pour le tri
                                        sortBy: { usageCount: -1, name: 1 } //Le type de tri voulu
                                    }
                                }
                            }
                        },
                        {
                            $project: {
                                _id: 1, 
                                userId: 1,
                                title: 1,
                                link: 1,
                                summary: 1,
                                author: 1,
                                fandomId: 1,
                                numberOfWords: 1,
                                numberOfChapters: 1,
                                readingStatus: 1,
                                storyStatus: 1,
                                lastReadAt: 1,
                                image: 1,
                                rate: 1,
                                lastChapterRead: 1,
                                createdAt: 1,
                                updatedAt: 1,
                                lang: '$lang.name', //On garde que le nom de la langue
                                personalNotes: 1,
                                tags: {
                                    $map: {
                                        input: '$tags',
                                        as: 'tag',
                                        in: {
                                            _id: '$$tag._id',
                                            name: '$$tag.name',
                                            color: '$$tag.color',
                                            usageCount: '$$tag.usageCount',
                                        }
                                    }
                                }
                            }
                        }
                    ],
                    as: 'fictions' //Stocke le resultat de la pipeline dans un tableau nommé 'fictions'
                }
            },
            {
                $match: { 'fictions': { $ne: [] } } //Garde tout ce qui n'est pas egal à [] (ne garde pas le fandoms si il ne contient pas de fiction)
            },            
        ];

        const fandoms = await Fandom.aggregate(pipeline); //Fait un aggregate sur la collection Fandom avec les parametres indiqué dans la pipeline et l'attribue à "fandoms"

        return res.json({ result: true, fandoms });

    } catch (error) {
        console.error(`Error while fetching fictions for status ${req.params.readingStatus}:`, error);
        return res.status(500).json({ result: false, error: 'Internal server error' });
    }
});


// GET /fiction/language  =>  { result:true, languages:[{ name, position }] }
router.get("/lang", async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    if (!token) return res.status(401).json({ result: false, error: 'Missing token' });

    const user = await User.findOne({ token });
    if (!user) return res.status(401).json({ result: false, error: 'Invalid token' });

    const userId = user._id;

    // Agrège dans la collection des fictions du user : lang est un sous-doc { name, position }
    const rows = await Fiction.aggregate([
      { $match: { userId } },    // On ne regarde que les documents de cet utilisateur
      { $match: { lang: { $exists: true, $ne: null } } },    // On ne regarde que les fictions ayant le champ "lang"
      {
        $project: {
          name: "$lang.name",                               // récupère directement le nom
          position: { $ifNull: ["$lang.position", 9999] },  // si pas de position, met 9999
          },
      },
      { $match: { name: { $type: "string", $ne: "" } } },   // $ne veut dire "non equal to", "différent de"
      {
        $group: {                                           // pour chaque name, on garde la plus petite position rencontrée
          _id: { $toLower: "$name" },                       // on met name en minuscule via $toLower
          name: { $first: "$name" },                        // puis on garde uniquement la 1ère occurrence de ce name via $first
          position: { $min: "$position" },                  // puis on le met à la plus petite position possible via $min
        },
      },
      { $sort: { position: 1, name: 1 } },
    ]);

    res.json({ result: true, languages: rows.map(({ name, position }) => ({ name, position })) });
  } catch (error) {
    console.error("GET /fiction/language failed", error);
    res.status(500).json({ result: false, error: "Internal error" });
  }
});


// POST /fiction -> CREATE A FICTION
router.post('/', async (req, res) => {
    try {
        // Check required fields
        const token = req.headers.authorization.split(' ')[1];
        if (!token) return res.status(401).json({ result: false, error: 'Missing token' });
    
        if (!checkBody(req.body, ['fandomName', 'title', 'readingStatus', 'storyStatus']))
            return res.json({ result: false, error: 'Missing or empty fields' });

        const {  
            fandomName, 
            title, 
            link, 
            author,
            langName,
            summary, 
            personalNotes,
            numberOfChapters,
            numberOfWords,
            readingStatus,
            lastChapterRead,
            storyStatus,
            image,
            tags, // array of tag ids
            rate, // object { value: Number, display: Boolean }
        } = req.body;

        // Verify user's token
        const user = await User.findOne({ token });
        if (!user) return res.status(401).json({ result: false, error: 'Invalid or expired token' });
        
        const userId = user._id;
        
        // FANDOM: Check if it exists or create it
        let newFandom;
        const existingFandom = await Fandom.findOne({ userId, name: fandomName });
        if (!existingFandom) {
            // If not we have to create it in the Fandoms collection, with a position equal to nb of docs in the collection + 1
            const fandomPosition = (await Fandom.countDocuments({ userId })) + 1;
            newFandom = await new Fandom({
                userId, 
                name: fandomName, 
                position: fandomPosition,                
            }).save();            
        }
        const fandomId = existingFandom ? existingFandom._id : newFandom._id;

        // LANG: Find or assign position
        let langPosition;
        const existingLang = await Fiction.findOne({ userId, 'lang.name': langName });
        if (existingLang) {
            langPosition = existingLang.lang.position;
        } else {
            const distinctlangs = await Fiction.distinct('lang.name', { userId });
            langPosition = distinctlangs.length + 1;
        }
        const lang = { name: langName, position: langPosition };

        // Model.distinct(<champ>, <filtre>)
        // - <champ> : le champ dont on veut récupérer les valeurs uniques
        //   → ici "lang.name", car lang est un sous-document.
        // - <filtre> (optionnel) : un objet de conditions, comme pour find()
        //   -> ici { userId }, pour ne récupérer que les langues de cet utilisateur précis.
        
        // LASTREADAT: If lastChapterRead is filled in, set lastReadAt to now
        const lastReadAt = lastChapterRead > 0 ? new Date() : null;

        // Create NEW FICTION
        const newFiction = await new Fiction({
            userId,
            title,
            link: link || '',
            author: author || '',
            fandomId,
            summary: summary || '',
            personalNotes: personalNotes || '',
            numberOfChapters: numberOfChapters || 0,
            numberOfWords: numberOfWords || 0,
            readingStatus,
            storyStatus,
            lang,
            lastReadAt,
            image: image || '',
            rate: {
                value: rate?.value || 0,
                display: rate?.display ?? false,
            },
            lastChapterRead: lastChapterRead || 0,
        }).save();

        // TAGS: create a doc. in userfictiontags only if there are tags
        if (tags && tags.length > 0) {
            await UserFictionTags.create({ userId, fictionId: newFiction._id, tags });
        }

        // Everything went fine
        return res.json({ result: true, message: "Fiction created successfully", fiction: newFiction });

    } catch (error) {
        console.error('Error while fetching fictions:', error);
        return res.status(500).json({ result: false, error: 'Internal server error' });
    }
});


// GET /fiction/:id -> retourne la fiction complète avec ses tags
router.get("/:id", async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    if (!token) return res.status(401).json({ result: false, error: "Missing token" });

    const user = await User.findOne({ token });
    if (!user) return res.status(401).json({ result: false, error: "Invalid token" });

    const fictionId = req.params.id;

    const fiction = await Fiction.findOne({ _id: fictionId, userId: user._id });
    if (!fiction) return res.status(404).json({ result: false, error: "Fiction not found" });

    const fandom = await Fandom.findOne({ _id: fiction.fandomId, userId: user._id }); // On récupère le nom du fandom
    fiction.fandomName = fandom.name;  // pour être aligné avec le fetch sur le front qui fait setFandomName(data.fiction.fandomName);

    const link = await UserFictionTags.findOne({ userId: user._id, fictionId }); // On récupère les informations du document couplant cette fiction avec ce user dans UserFictionTags

    let tags = [];
    if (link && link.tags.length > 0) {   // Si on récupère ce document et que dedans le tableau d'id des tags n'est pas vide
      tags = await Tag.find({ _id: { $in: link.tags } })  // Alors on récupère les tags (et leurs champs associés) qui ont cet id. ({ _id: { $in: link.tags } }) veut dire qu'on récupère tous les _id présents dans link.tags
        .sort({ usageCount: -1, name: 1 }) // les tags sont triés par usageCount et ordre alphabétique
        .lean();
    }

    fiction.tags = tags;  // tags envoyés au front

    return res.json({ result: true, fiction });

  } catch (error) {
    console.error("GET /fiction/:id failed:", error);
    return res.status(500).json({ result: false, error: "Internal server error" });
  }
});


// PUT /fiction/:id -> met à jour les champs de la fiction
router.put('/:id', async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    if (!token) return res.status(401).json({ result: false, error: 'Missing token' });

    const user = await User.findOne({ token });
    if (!user) return res.status(401).json({ result: false, error: 'Invalid token' });

    const fictionId = req.params.id;
    const {
      fandomName,
      title,
      link,
      author,
      langName,
      summary,
      personalNotes,
      numberOfChapters,
      numberOfWords,
      readingStatus,
      lastChapterRead,
      storyStatus,
      image,
      rate,
      tagIds, // tableau d’IDs des tags
    } = req.body;

    let fandomId;  // Fandom : créer si inexistant
    if (typeof fandomName === 'string' && fandomName.trim()) {
      const existingFandom = await Fandom.findOne({ userId: user._id, name: fandomName });
      if (existingFandom) {
        fandomId = existingFandom._id;
      } else {
        const positionFandom = (await Fandom.countDocuments({ userId: user._id })) + 1;     //Si l’utilisateur a déjà 3 fandoms, alors positionFandom = 4. On lui assigne sa future position puis on crée le nouveau fandom
        const newFandom = await new Fandom({ userId: user._id, name: fandomName, position: positionFandom }).save();
        fandomId = newFandom._id;
      }
    }

    let lang;       // Langue : créer si nouvelle
    if (typeof langName === 'string' && langName.trim()) {
      const existingLang = await Fiction.findOne({ userId: user._id, 'lang.name': langName });
      const langPosition = existingLang ? existingLang.lang.position : (await Fiction.distinct('lang.name', { userId: user._id })).length + 1; // ce await veut dire : envoie toutes les langues distinctes (sans doublons) du champ "name" dans Fiction et pour uniquement ce user
      lang = { name: langName, position: langPosition }; // et .length + 1 lui aura indiqué sa nouvelle position dans l'ordre d'affichage
    }

    const update = {};     // Construction dynamique de la mise à jour
    if (title !== undefined) update.title = title;
    if (link !== undefined) update.link = link;
    if (author !== undefined) update.author = author;
    if (summary !== undefined) update.summary = summary;
    if (personalNotes !== undefined) update.personalNotes = personalNotes;
    if (numberOfChapters !== undefined) update.numberOfChapters = numberOfChapters;
    if (numberOfWords !== undefined) update.numberOfWords = numberOfWords;
    if (readingStatus !== undefined) update.readingStatus = readingStatus;
    if (storyStatus !== undefined) update.storyStatus = storyStatus;
    if (image !== undefined) update.image = image;
    if (rate !== undefined) update.rate = { value: rate?.value || 0, display: !!rate?.display };
    if (fandomId) update.fandomId = fandomId;
    if (lang) update.lang = lang;
    if (lastChapterRead !== undefined) {
      update.lastChapterRead = lastChapterRead;
      update.lastReadAt = lastChapterRead > 0 ? new Date() : null;
    }

    const updatedFiction = await Fiction.findOneAndUpdate(
      { _id: fictionId, userId: user._id },
      { $set: update }, // $set remplace uniquement les champs indiqués dans update par leurs nouvelles valeurs
      { new: true }  // option de findOneAndUpdate : Mongoose renvoie le document mis à jour et non l'ancien document
    );

    if (!updatedFiction) return res.status(404).json({ result: false, error: 'Fiction not found' });

    // MAJ des tags si tagIds fourni
    if (Array.isArray(tagIds)) {  // si tagIds est un tableau c'est true grâce à Array.isArray(), sinon c'est false. S'il n'était pas un tableau, tagIds.map aurai un bug
      const link = await UserFictionTags.findOne({ userId: user._id, fictionId });
      const oldIds = link ? link.tags.map(id => id.toString()) : [];  // oldIds correspond au tableau d'Ids des tags avant la MAJ
      const newIds = tagIds.map(id => id.toString());  // newIds correspond au tableau d'Ids des tags après la MAJ

      const added = newIds.filter(id => !oldIds.includes(id));  // added correspond à tous les id qui n'étaient pas dans l'ancien tableau d'IDs avant la MAJ et qui sont dans le nouveau tableau après la MAJ
      const removed = oldIds.filter(id => !newIds.includes(id));  // removed correspond à tous les id qui étaient là avant la MAJ et qui ne sont plus là après la MAJ.

      await UserFictionTags.findOneAndUpdate(   // Upsert (update + insert) : si je trouve le document, je le mets à jour. S'il n'existe pas, je le crée.
        { userId: user._id, fictionId }, // Mongo cherche un document qui a userId et fictionId.
        { $set: { tags: newIds } },      // Si trouvé → il le met à jour (remplace les tags par newIds).
        { upsert: true }                 // Si non trouvé → il crée automatiquement un nouveau document avec ces valeurs.
      );

      if (added.length) {   // Mise à jour automatique de usageCount
        await Tag.updateMany({ _id: { $in: added } }, { $inc: { usageCount: 1 } }); // on incrémente de 1 usageCount pour les nouveaux IDs du document
      }

      if (removed.length) {
        await Tag.updateMany(
          { _id: { $in: removed }, usageCount: { $gt: 0 } },    // $gt veut dire "greater than" cad qu'on sélectionne uniquement les usageCount qui sont strictement supérieurs à 0, car on va les décrémenter
          { $inc: { usageCount: -1 } } // on décrémente de 1 usageCount pour les anciens IDs du document
        );
      }
    }

    return res.json({ result: true, fiction: updatedFiction });
  } catch (error) {
    console.error('PUT /fiction/:id failed:', error);
    return res.status(500).json({ result: false, error: 'Internal server error' });
  }
});

// DELETE /fiction/:id -> DELETE A FICTION and update tag usageCount
router.delete("/:id", async (req, res) => {
  try {
    // Check required fields
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ result: false, error: 'Missing token' });

    // Check user's token
    const user = await User.findOne({ token });
    if (!user) return res.status(401).json({ result: false, error: 'Invalid token' });

    const { _id: userId } = user;
    const fictionId = req.params.id;

    // Check if the fiction exists and is owned by the user
    const fiction = await Fiction.findOne({ _id: fictionId, userId });
    if (!fiction) return res.status(404).json({ result: false, error: 'Fiction not found' });

    // Get associated tags (UserFictionTags collection)
    const tagLink = await UserFictionTags.findOne({ userId, fictionId });

    // Decrement usageCount on each tag used in the fiction
    if (tagLink && tagLink.tags.length > 0) {
      await Tag.updateMany(
        { _id: { $in: tagLink.tags } },
        { $inc: { usageCount: -1 } }
      );
    }

    // Delete fiction
    await Fiction.deleteOne({ _id: fictionId, userId });

    // Delete the link in UserFictionTags
    await UserFictionTags.deleteOne({ fictionId, userId });

    return res.json({ result: true, message: "Fiction deleted successfully" });

  } catch (error) {
    console.error("DELETE /fiction/:id failed:", error);
    return res.status(500).json({ result: false, error: "Internal server error" });
  }
});

module.exports = router;
