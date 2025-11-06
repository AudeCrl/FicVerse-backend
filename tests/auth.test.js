process.env.NODE_ENV = 'test'; // sécurité qui empêche la connexion à la DB dans const app = require('../app'); même si jest.mock('../models/connection' le fait déjà

jest.mock('../models/connection', () => ({  // placé avant const app = require('../app'); pour empêcher la connexion à la DB
  connectDB: jest.fn(),
  mongoose: { connection: { close: jest.fn() } },
}), { virtual: true }); // ce module n’existe pas physiquement, le créer en mémoire

jest.mock('../models/users', () => ({   // simulation du modèle User avec une méthode findOne donc User.findOne est mocké aussi
  User: {
    findOne: jest.fn(),
  },
}), { virtual: true });

const request = require('supertest'); // Permet de faire de vraies requêtes HTTP (POST, GET, etc.) sur mon app Express sans lancer de serveur.
const app = require('../app');
const { User } = require('../models/users');
const bcrypt = require('bcrypt');

afterEach(() => jest.clearAllMocks());  // Reset des mocks entre tests

describe('POST /user/signin', () => {   // Regroupe tous les tests relatifs à la route POST /user/signin.

  test('erreur si email est vide', async () => {  // Test : erreur si email vide
    const res = await request(app)  // Envoie une requête POST simulée à /user/signin avec un body JSON.
      .post('/user/signin')
      .send({ email: '', password: 'azerty123' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ result: false, error: 'Missing or empty fields' });  // toEqual pour comparer objet ou tableau. toBe pour comparer boolean, number, string.
  });

  test('erreur si mot de passe est vide', async () => {  // Test : erreur si mot de passe vide
    const res = await request(app)
      .post('/user/signin')
      .send({ email: 'user@test.com', password: '' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ result: false, error: 'Missing or empty fields' });
  });

  test('erreur si utilisateur introuvable', async () => {
    User.findOne.mockResolvedValue(null);   // Configure le mock pour simuler qu’aucun utilisateur n’a été trouvé (renvoie null).
    const res = await request(app)
      .post('/user/signin')
      .send({ email: 'unknown@test.com', password: '123456' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ result: false, error: 'User not found or wrong password' });
  });

  test('erreur si mauvais mot de passe', async () => {
    const mockUser = { email: 'test@test.com', passwordHash: bcrypt.hashSync('correctPassword', 10) };
    User.findOne.mockResolvedValue(mockUser);   // Le mock renvoie un utilisateur existant, mais avec un mot de passe différent. Contrôle via une comparaison des mdp et renvoie de la réponse false
    const res = await request(app)
      .post('/user/signin')
      .send({ email: 'test@test.com', password: 'wrongPassword' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ result: false, error: 'User not found or wrong password' });
  });

  test('succès: renvoie données + token', async () => {
    const mockUser = {
      email: 'user@test.com',
      username: 'User',
      token: 'abc123',
      createdAt: '2025-01-01T00:00:00Z',
      avatarURL: 'https://example.com/avatar.png',
      notationIcon: 'heart',
      passwordHash: bcrypt.hashSync('mypassword', 10),
    };
    User.findOne.mockResolvedValue(mockUser);   // Le mock renvoie un utilisateur dont le mot de passe hashé correspond à celui envoyé

    const res = await request(app)
      .post('/user/signin')
      .send({ email: 'user@test.com', password: 'mypassword' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({  // result: true + les infos utilisateur.
      result: true,
      token: mockUser.token,
      email: mockUser.email,
      username: mockUser.username,
      createdAt: mockUser.createdAt,
      avatarURL: mockUser.avatarURL,
      notationIcon: mockUser.notationIcon,
    });
  });
});