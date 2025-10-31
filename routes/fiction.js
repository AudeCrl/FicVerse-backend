var express = require('express');
var router = express.Router();

const { checkBody } = require('../modules/checkBody');
const User = require('../models/users');
const Fiction = require('../models/fictions');
const Fandom = require('../models/fandoms');

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
            languageName,
            summary, 
            personalNotes,
            numberOfChapters,
            numberOfWords,
            readingStatus,
            lastChapterRead,
            storyStatus,
            image,
            tags,
            rate,
        } = req.body;

        // Verify user's token
        const user = await User.findOne({ token });
        if (!user) return res.status(401).json({ result: false, error: 'Invalid or expired token' });
        
        const userId = user._id;
        
        // Check if fandom exists
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

        // Figure out the language position
        let languagePosition;
        const existingFictionWithSameLanguage = await Fiction.findOne({ userId, 'language.name': languageName });
        if (existingFictionWithSameLanguage) {
            languagePosition = existingFictionWithSameLanguage.language.position;
        } else {
            const distinctLanguages = await Fiction.distinct('language.name', { userId });
            languagePosition = distinctLanguages.length + 1;
        }
        const language = { name: languageName, position: languagePosition };

        // Model.distinct(<champ>, <filtre>)
        // - <champ> : le champ dont tu veux récupérer les valeurs uniques
        //   → ici "language.name", car language est un sous-document.
        // - <filtre> (optionnel) : un objet de conditions, comme pour find()
        //   -> ici { userId }, pour ne récupérer que les langues de cet utilisateur précis.
        
        // Reste à faire :
        // - lastReadAt: (lastChapterRead > 0 ? new Date() : null)
        // - Créer le document userFictionTags seulement s’il y a des tags
        // if (tags && tags.length > 0) {
        //     await UserFictionTag.create({ userId, fictionId, tags });
        // }
        // - lastReadAt → mis à jour uniquement quand lastChapterRead change.
        // - rate.display → false par défaut si non envoyé.
        // - image → éventuellement une image par défaut côté front si vide.


        //return res.status(401).json({ result: false, error: 'Invalid or expired token' });


    } catch (error) {
        console.error('Error while fetching fictions:', error);
        return res.status(500).json({ result: false, error: 'Internal server error' });
    }
});

// GET /fiction -> RETRIEVE ALL FICTIONS
router.get('/', async (req, res) => {
    try {
    } catch (error) {
        console.error('Error while fetching fictions:', error);
        return res.status(500).json({ result: false, error: 'Internal server error' });
    }
});

module.exports = router;
