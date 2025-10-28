var express = require('express');
var router = express.Router();

const User = require('../models/users');
const { checkBody } = require('../modules/checkBody');
const uid2 = require('uid2');
const bcrypt = require('bcrypt');


router.post('/signup', (req, res) => { // création d'un nouveau compte user
  
  const { email, username, password } = req.body;

  if (!checkBody(req.body, ['email', 'username', 'password'])) {  // On vérifie que les champs sont bien remplis
    res.json({ result: false, error: 'Missing or empty fields' });
    return;
  }

  // On vérifie que le user n'est pas déjà enregistré. Si non, on en créé un nouveau
  User.findOne({ email: req.body.email }).then(data => {
    if (data === null) {
      const hash = bcrypt.hashSync(password, 10);

      const newUser = new User({
        email,      // suite à la destructuration au début de la route avec const { email, username, password } = req.body;
        username,
        password: hash,
        token: uid2(32),
      });

      newUser.save().then(data => {
        res.json({ result: true, user: data });
      });
    } else {
      // Si le user existe déjà dans la BDD
      res.json({ result: false, error: 'User already exists' });
    }
  });
});


router.post('/signin', (req, res) => { // on se connecte
  if (!checkBody(req.body, ['email', 'password'])) { // on vérifie que les champs sont bien remplis
    res.json({ result: false, error: 'Missing or empty fields' });
    return;
  }

  User.findOne({ email: req.body.email }).then(data => { // on regarde si le user existe déjà
    if (data && bcrypt.compareSync(req.body.password, data.password)) {
      res.json({ result: true, token: data.token, email: data.email, username: data.username });
    } else {
      res.json({ result: false, error: 'User not found or wrong password' });
    }
  });
});

module.exports = router;