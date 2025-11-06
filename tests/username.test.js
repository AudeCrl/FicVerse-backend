const request = require('supertest');
const app = require('../app');

const { User } = require('../models/users');
const uid2 = require('uid2');
const bcrypt = require('bcrypt');

const mongoose = require('mongoose');

//Donnée pour le test
let testUserA;
let testUserB;
let tokenA;
let usernameA;

describe('PATCH /user/username - Mise à jour du nom d\'utilisateur', () => {

    //Creation des utilisateurs de test
    beforeAll(async () => {
        //Création de l'utilisateur A
        tokenA = uid2(32);
        usernameA = 'TestUserA';
        const hashedPassword = bcrypt.hashSync('azerty123', 10);

        testUserA = new User({
            email: 'testA@example.com',
            username: usernameA,
            passwordHash: hashedPassword,
            token: tokenA,
        });
        await testUserA.save();

        //Création de l'utilisateur B (pour la cas "déjà pris")
        testUserB = new User({
            email: 'testB@example.com',
            username: 'TestUserB',
            passwordHash: hashedPassword,
            token: uid2(32),
        });
        await testUserB.save();
    });

    //Suppression des utilisateurs apreès les tests
    afterAll(async () => {
        await User.deleteMany({ username: { $in: [usernameA, 'TestUserB', 'NewUsername']}});
        await mongoose.connection.close();
    });

    //Scénario 1 : Succès du changement de nom d'utilisateur
    test('Mettre à jour le nom d\'utilisateur avec succès et retourner le nouveau nom', async () => {
        const newUsername = 'NewUsername';

        const response = await request(app)
            .patch('/user/username')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ username: newUsername });
        
        expect(response.statusCode).toBe(200);
        expect(response.body.result).toBe(true);
        expect({ username: newUsername });

        const updatedUser = await User.findOne({ token: tokenA });
        expect(updatedUser.username).toBe(newUsername);
    });

    //Scénario 2 : Nom d'utilisateur vide
    test('Erreur si le nom d\'utilisateur est vide', async () => {
        const response = await request(app)
            .patch('/user/username')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ username: '' });

        expect(response.body.result).toBe(false);
        expect(response.body.error).toBe('New username cannot be empty');

        const userAfterTest = await User.findOne({ token: tokenA });
        expect(userAfterTest.username).toBe('NewUsername');
    });

    //Scénario 3 : Nom d'utilisateur déjà pris
    test('Erreur si le nouveau nom d\'utilisateur est déjà pris', async () => {
        const usernamePris = 'TestUserB';

        const response = await request(app)
            .patch('/user/username')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ username: usernamePris})

        expect(response.body.result).toBe(false);
        expect(response.body.error).toBe('This username is already taken');
    });

    //Scénario 4 : Erreur authentification
    test('Erreur si le token est manquant ou invalide', async () => {
        //Test sans token
        let response = await request(app)
            .patch('/user/username')
            .send({ username: 'InvalidTokenAttempt' });

        expect(response.statusCode).toBe(401);
        expect(response.body.error).toBe('Missing token in Authorization header');
        
        //Test avec token invalid
        response = await request(app)
            .patch('/user/username')
            .set('Authorization', `Bearer invalidToken`)
            .send({ username: 'InvalidTokenAttenmp' })

        expect(response.statusCode).toBe(404);
        expect(response.body.error).toBe('User not found or token invalid');
    })
})