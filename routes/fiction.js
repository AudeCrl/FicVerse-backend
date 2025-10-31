var express = require('express');
var router = express.Router();

const { checkBody } = require('../modules/checkBody');
const { User } = require('../models/users');
const Fiction = require('../models/fictions');
const Fandom = require('../models/fandoms');
const UserFictionTags = require('../models/userfictiontags');

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
            personalNote: personalNotes || '',
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

// GET /fiction -> RETRIEVE ALL FICTIONS
router.get('/:readingStatus', async (req, res) => {
    try {
        if (!checkBody(req.body, ['token'])) {
            return res.json({ result: false, error: 'Missing or empty fields in request body' });
        }
        
        const { token } = req.body;
        const { readingStatus } = req.params;

        const allowedStatuses = ["to-read", "reading", "finished"];
        if (!allowedStatuses.includes(readingStatus)) {
            return res.json({ result: false, error: 'Invalid readingStatus parameter' });
        }

        const user = await User.findOne({ token });
        if (!user) {
            return res.status(401).json({ result: false, error: 'Invalid or expired token' });
        }
        
        const userId = user._id;

        const pipeline = [
            { $match: { userId: userId } },
            
            { $sort: { position: 1 } },
            
            {
                $lookup: {
                    from: 'fictions',
                    let: { fandomId: '$_id', userId: userId, readingStatus: readingStatus },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$fandomId', '$$fandomId'] },
                                        { $eq: ['$userId', '$$userId'] },
                                        { $eq: ['$readingStatus', '$$readingStatus'] },
                                    ]
                                }
                            }
                        },
                        { $sort: { lastReadAt: -1 } }, 
                        
                        {
                            $lookup: {
                                from: 'userfictiontags',
                                localField: '_id',
                                foreignField: 'fictionId',
                                as: 'tagLinks',
                            }
                        },
                        { $unwind: { path: '$tagLinks', preserveNullAndEmptyArrays: true } },

                        {
                            $lookup: {
                                from: 'tags',
                                localField: 'tagLinks.tags', 
                                foreignField: '_id',
                                as: 'tags',
                            }
                        },
                        
                        {
                            $project: {
                                __v: 0,
                                tagLinks: 0, 
                                personalNote: 0,
                                language: '$lang.name',
                                lang: 0, 
                                personalNotes: '$personalNote',
                            }
                        }
                    ],
                    as: 'fictions',
                }
            },
            
            {
                $match: { 'fictions': { $ne: [] } }
            },
            
            {
                $project: {
                    __v: 0,
                }
            }
        ];

        const fandoms = await Fandom.aggregate(pipeline);

        return res.json({ result: true, fandoms });

    } catch (error) {
        console.error(`Error while fetching fictions for status ${req.params.readingStatus}:`, error);
        return res.status(500).json({ result: false, error: 'Internal server error' });
    }
});

module.exports = router;
