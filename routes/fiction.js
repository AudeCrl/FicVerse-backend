var express = require('express');
var router = express.Router();

const { checkBody } = require('../modules/checkBody');
const { User } = require('../models/users');
const Fiction = require('../models/fictions');
const Fandom = require('../models/fandoms');
const UserFictionTags = require('../models/userfictiontags');
const Tag = require('../models/tags');

// POST /fiction -> CREATE A FICTION
router.post('/', async (req, res) => {
    try {
        // Check required fields
        if (!checkBody(req.body, ['token', 'fandomName', 'title', 'readingStatus', 'storyStatus']))
            return res.json({ result: false, error: 'Missing or empty fields' });

        const { 
            token, 
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


// GET /fictions/:id -> retourne la fiction complète avec ses tags
router.get("/:id", async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    if (!token) return res.status(401).json({ result: false, error: "Missing token" });

    const user = await User.findOne({ token });
    if (!user) return res.status(401).json({ result: false, error: "Invalid token" });

    const fictionId = req.params.id;

    // On cherche la fiction correspondant au user
    const fiction = await Fiction.findOne({ _id: fictionId, userId: user._id }).lean();
    if (!fiction) return res.status(404).json({ result: false, error: "Fiction not found" });

    // On récupère les tags associés à cette fiction
    const link = await UserFictionTags.findOne({ userId: user._id, fictionId }).lean();

    let tags = [];
    if (link && link.tags.length > 0) {
      tags = await Tag.find({ _id: { $in: link.tags } })
        .sort({ usageCount: -1, name: 1 })
        .lean();
    }

    // On attache les tags au résultat final
    fiction.tags = tags;

    return res.json({ result: true, fiction });
  } catch (error) {
    console.error("GET /fictions/:id failed:", error);
    return res.status(500).json({ result: false, error: "Internal server error" });
  }
});


// PUT /fictions/:id/tags -> remplace la liste des tags d’une fiction et met à jour usageCount
router.put("/:id/tags", async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    if (!token) return res.status(401).json({ result: false, error: "Missing token" });

    const user = await User.findOne({ token });
    if (!user) return res.status(401).json({ result: false, error: "Invalid token" });

    const fictionId = req.params.id;
    const tagIds = Array.isArray(req.body.tagIds) ? req.body.tagIds : [];

    const link = await UserFictionTags.findOne({ userId: user._id, fictionId });
    const oldTagIds = link ? link.tags.map(id => id.toString()) : [];

    const newTagIds = tagIds.map(id => id.toString());

    // Calcul du diff simple
    const added = newTagIds.filter(id => !oldTagIds.includes(id));
    const removed = oldTagIds.filter(id => !newTagIds.includes(id));

    // Upsert de la liaison
    await UserFictionTags.findOneAndUpdate(
      { userId: user._id, fictionId },
      { $set: { tags: newTagIds } },
      { upsert: true }
    );

    // Mise à jour usageCount
    if (added.length > 0) {
      await Tag.updateMany({ _id: { $in: added } }, { $inc: { usageCount: 1 } });
    }
    if (removed.length > 0) {
      await Tag.updateMany(
        { _id: { $in: removed }, usageCount: { $gt: 0 } },
        { $inc: { usageCount: -1 } }
      );
    }

    return res.json({ result: true });
  } catch (error) {
    console.error("PUT /fictions/:id/tags failed:", error);
    return res.status(500).json({ result: false, error: "Internal server error" });
  }
});

module.exports = router;
