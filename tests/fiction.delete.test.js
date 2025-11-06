/**
 * Test de la route DELETE /fiction/:id sur les critères :
 * - suppression d'une fiction
 * - drécémentation du usageCount de chaque tag associé
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app'); 

// Connexion DB (important avant les modèles)
require('../models/connection');

// Import des modèles Mongoose
const { User } = require('../models/users');
const Fiction = require('../models/fictions');
const Tag = require('../models/tags');
const UserFictionTags = require('../models/userfictiontags');
const Fandom = require('../models/fandoms');

// Permet d’éviter les erreurs Mongo Duplicate Key
const uid = () => Math.random().toString(36).slice(2, 8);

describe('DELETE /fiction/:id', () => {
    // Variables partagées entre les tests
    let user;
    let token;
    let fandom;
    let tag;
    let fiction;
    let otherFiction;
    let otherUser;

    beforeAll(async () => {

        // Création d'un utilisateur de test
        token = `test-token-delete-fiction-${uid()}`;
        user = await User.create({
            username: `jest-user-delete-fiction-${uid()}`,
            email: `jestuserdel-${uid()}@test.dev`,
            passwordHash: 'passwordHash',
            token,
        });

        // Création d'un fandom rattaché à l’utilisateur
        fandom = await Fandom.create({
            userId: user._id,
            name: 'Fandom de test Delete Fiction',
            position: 1,
        });

        // Création d'un tag rattaché à l’utilisateur, avec usageCount = 10
        tag = await Tag.create({
            userId: user._id,
            name: 'deletefiction',
            usageCount: 10,
            color: 1,
        });

        // Création de la fiction à supprimer, rattachée à l'utilisateur + fandom
        fiction = await Fiction.create({
            userId: user._id,
            fandomId: fandom._id,
            title: 'Fiction de test Delete Fiction',
            readingStatus: 'to-read',
            lastChapterRead: 0,
        });

        // Création du lien UserFictionTags qui associe cette fiction au tag
        await UserFictionTags.create({
            userId: user._id,
            fictionId: fiction._id,
            tags: [tag._id],
        });

        // Création d'un second utilisateur de test
        otherUser = await User.create({
            username: `jest-other-user-del-${uid()}`,
            email: `otheruserdel-${uid()}@test.dev`,
            passwordHash: 'passwordHash',
            token: `other-token-${uid()}`,
        });

        // Création d'une fiction appartenant à ce second utilisateur
        otherFiction = await Fiction.create({
            userId: otherUser._id,
            fandomId: fandom._id,
            title: 'Fiction de test delete second utilisateur',
            readingStatus: 'to-read',
            lastChapterRead: 0,
        });
    });

    afterAll(async () => {
        // Nettoyage de la BDD : on supprime ce qui peut rester de nos données de test.
        try {
            await UserFictionTags.deleteOne({ userId: user?._id, fictionId: fiction?._id });
            await Fiction.deleteOne({ _id: fiction?._id, userId: user?._id });
            await Tag.deleteOne({ _id: tag?._id, userId: user?._id });
            await Fandom.deleteOne({ _id: fandom?._id, userId: user?._id });
            await User.deleteOne({ _id: user?._id });
            await Fiction.deleteOne({ _id: otherFiction?._id });
            await User.deleteOne({ _id: otherUser?._id });
        } finally {
            await mongoose.connection.close();
        }
    });

    // Scénario 1 : succès !
    test('Supprimer la fiction, décrémenter les usageCount des tags liés et renvoyer { result: true }', async () => {

        // Appel de la route
        const res = await request(app)
            .delete(`/fiction/${fiction._id.toString()}`)
            .set('Authorization', `Bearer ${token}`)
            .expect('Content-Type', /json/);

        // Vérification de la réponse
        expect(res.statusCode).toBe(200);
        expect(res.body.result).toBe(true);

        // Vérification des actions en BDD
        
            // 1) La fiction doit être supprimée
        const fictionAfter = await Fiction.findById(fiction._id).lean();
        expect(fictionAfter).toBeNull();

            // 2) Le lien UserFictionTags doit être supprimé
        const linkAfter = await UserFictionTags.findOne({
            userId: user._id,
            fictionId: fiction._id,
        }).lean();
        expect(linkAfter).toBeNull();

            // 3) Le tag doit avoir son usageCount décrémenté de 1 (10 -> 9)
        const tagAfter = await Tag.findById(tag._id).lean();
        expect(tagAfter).toBeTruthy();
        expect(tagAfter.usageCount).toBe(9);
    });

    // Scénario 2 : token utilisateur manquant
    test('Renvoyer erreur 401 si token manquant', async () => {
      
        // Appel de la route sans token
        const res = await request(app)
            .delete(`/fiction/${new mongoose.Types.ObjectId().toString()}`)
            .expect('Content-Type', /json/);

        // Vérification de la réponse
        expect(res.statusCode).toBe(401);
        expect(res.body).toMatchObject({ result: false, error: 'Missing token' });
    });

    // Scénario 3 : token utilisateur invalide
    test('Renvoyer erreur 401 si token invalide', async () => {
      
        // Appel de la route avec token invalide
        const res = await request(app)
            .delete(`/fiction/${new mongoose.Types.ObjectId().toString()}`)
            .set('Authorization', `Bearer ${token}fake`)
            .expect('Content-Type', /json/);

        // Vérification de la réponse
        expect(res.statusCode).toBe(401);
        expect(res.body).toMatchObject({ result: false, error: 'Invalid token' });
    });

    // Scénario 4 : fiction inexistante
    test(`Renvoyer erreur 404 si la fiction est introuvable`, async () => {
        const fakeFictionId = new mongoose.Types.ObjectId().toString();

        // Appel de la route avec un faux id de fiction
        const res = await request(app)
            .delete(`/fiction/${fakeFictionId}`)
            .set('Authorization', `Bearer ${token}`)
            .expect('Content-Type', /json/);

        // Vérification de la réponse
        expect(res.statusCode).toBe(404);
        expect(res.body).toMatchObject({ result: false, error: 'Fiction not found' });
    });

    // Scénario 5 : la fiction existe mais appartient à un autre utilisateur
    test(`Renvoyer erreur 404 si la fiction n'appartient pas au user`, async () => {

        // Appel de la route avec token du premier utilisateur et id de fiction appartenant au second
        const res = await request(app)
            .delete(`/fiction/${otherFiction._id.toString()}`)
            .set('Authorization', `Bearer ${token}`)
            .expect('Content-Type', /json/);

        // Vérification de la réponse    
        expect(res.statusCode).toBe(404);
        expect(res.body).toMatchObject({ result: false, error: 'Fiction not found' });
    });
});
