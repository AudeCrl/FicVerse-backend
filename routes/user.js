var express = require('express');
var router = express.Router();

const { User, THEMES, APPEARANCE_MODES, NOTATION_ICON_TYPES } = require('../models/users');
const Fiction = require('../models/fictions');
const Tag = require('../models/tags');
const Fandom = require('../models/fandoms');
const UserFictionTags = require('../models/userfictiontags');
const { checkBody } = require('../modules/checkBody');
const { checkAuth } = require('../modules/checkAuth');
const uid2 = require('uid2');
const bcrypt = require('bcrypt');
const expressFileUpload = require('express-fileupload'); // Pour gérer le fichier
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


router.post('/signup', (req, res) => { // création d'un nouveau compte user
  const { email, username, password } = req.body;
  if (!checkBody(req.body, ['email', 'username', 'password'])) {  // On vérifie que les champs sont bien remplis
    res.json({ result: false, error: 'Missing or empty fields' });
    return;
  }

  // On vérifie que le user n'est pas déjà enregistré. Si non, on en crée un nouveau
  User.findOne({ $or: [{ email }, { username }] })
    
    .then(existingUser  => {
      if (existingUser  === null) {
        const hash = bcrypt.hashSync(password, 10);
        const newUser = new User({
          email,      // suite à la destructuration au début de la route avec const { email, username, password } = req.body;
          username,
          passwordHash: hash,
          token: uid2(32),
        });

        newUser.save().then(savedUser => {
          res.json({ result: true, user: savedUser });
        });
      } else {
        // Si le user existe déjà dans la BDD
        res.json({ result: false, error: 'User already exists' });
      }
    })
    .catch(err => {
      console.error("Error during signup:", err);
      res.status(500).json({ result: false, error: "Internal server error" });
    });
});


router.post('/signin', (req, res) => { // on se connecte
  if (!checkBody(req.body, ['email', 'password'])) { // on vérifie que les champs sont bien remplis
    res.json({ result: false, error: 'Missing or empty fields' });
    return;
  }

  User.findOne({ email: req.body.email }).then(data => { // on regarde si le user existe déjà
    if (data && bcrypt.compareSync(req.body.password, data.passwordHash)) {
      res.json({ result: true, token: data.token, email: data.email, username: data.username, createdAt: data.createdAt, avatarURL: data.avatarURL, notationIcon: data.notationIcon, theme: data.theme, appearanceMode: data.appearanceMode });
    } else {
      res.json({ result: false, error: 'User not found or wrong password' });
    }
  });
});


// Route pour suppprimer un compte
router.delete('/remove', async (req, res) => {
  const { token, password } = req.body;

  if (!checkBody(req.body, ['token', 'password'])) {
    res.json({ result: false, error: 'Missing token or password' });
    return;
  }

  try {
    // 1. Vérifier que l'utilisateur existe et valider le mot de passe
    const userToDelete = await User.findOne({ token: token });

    if (!userToDelete) {
      res.json({ result: false, error: 'User not found' });
      return;
    }

    if (!bcrypt.compareSync(password, userToDelete.passwordHash)) {
      res.json({ result: false, error: 'Invalid password confirmation' });
      return;
    }

    // 2. Suppression en cascade de toutes les données liées à l'utilisateur
    const userId = userToDelete._id;

    // Supprimer dans cet ordre : on part du plus spécifique (relations) vers le plus général (entités)
    await UserFictionTags.deleteMany({ userId });  // Relations fiction-tags
    await Fiction.deleteMany({ userId });           // Fictions
    await Tag.deleteMany({ userId });               // Tags
    await Fandom.deleteMany({ userId });            // Fandoms
    await User.deleteOne({ _id: userId });          // Utilisateur

    console.log(`User ${userToDelete.username} and all related data successfully deleted`);
    res.json({ result: true, message: 'Account successfully deleted' });

  } catch (error) {
    console.error('Error during account removal:', error);
    res.status(500).json({ result: false, error: 'Internal server error during deletion' });
  }
});

// Upload de l'avatar de l'utilisateur
router.patch('/upload', async (req, res) => {
  // console.log(req.files.avatarFromFront);
  let tempFilePath = null;  

  try {
    // Authentification via le bearer token
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ result: false, error: 'Missing token in Authorization header' });
    }

    const userToUpdate = await User.findOne({ token });

    if (!userToUpdate) {
      return res.status(404).json({ result: false, error: 'User not found or token invalid' });
    }

    // Vérification et upload du fichier
    if (!req.files || !req.files.avatarFromFront) {
      return res.json({ result: false, error: 'Avatar file missing' });
    }
    const file = req.files.avatarFromFront;

    const path = require('path');
    tempFilePath = path.join('./tmp', `avatar-${file.name}`);    

    await file.mv(tempFilePath);

    const resultCloudinary = await cloudinary.uploader.upload(tempFilePath, {
      folder: 'ficverse/avatars',
    });

    userToUpdate.avatarURL = resultCloudinary.secure_url;
    const saveReply = await userToUpdate.save(); //Equivalent de User.updateOne    

    fs.unlinkSync(tempFilePath) //Suppression du fichier temporaire

    res.json({
      result: true,
      message: 'Avatar Updated successfully',
      avatarUrl: userToUpdate.avatarURL
    });
  } catch (error) {
    console.error('Error during avatar upload:', error);

    if (tempFilePath && fs.existsSync(tempFilePath)) { //Verifie si le fichier existe
      fs.unlink(tempFilePath)
    }
    res.status(500).json({ result: false, error: 'Internal server error during upload'});    
  }
});

router.patch('/username', checkAuth, async (req, res) => {
  try {
    const token = req.user.token;
    
    // Récupération des infos du front
    const newUsername = req.body.username.trim();

    if (!newUsername || newUsername.length === 0) {
      return res.json({ result: false, error: 'New username cannot be empty' });
    }

    const existingUser = await User.findOne({ username: newUsername });
    if (existingUser && existingUser.token !== token) {
      return res.json({ result: false, error: 'This username is already taken'});
    }

    const updatedUser = await User.findOneAndUpdate(
      { token },
      { username: newUsername },
      { new: true } // renvoie le document mis à jour plutôt que l'ancien document
    );

    if (!updatedUser) {
      return res.status(404).json({ result: false, error: 'User not found or token invalid' });
    }

    res.json({ result: true, message: 'Username updated successfully', username: updatedUser.username });

  } catch (error) {
    console.error('Error updating username:', error);
    res.status(500).json({ result: false, error: 'Internal server error during username update'});
    
  }
});

router.patch('/email', async (req, res) => {
  try {
    // Authentification via le bearer token
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ result: false, error: 'Missing token in Authorization header' });
    }

    const userToUpdate = await User.findOne({ token });

    if (!userToUpdate) {
      return res.status(404).json({ result: false, error: 'User not found or token invalid' });
    }
    
    // Récupération des infos du front
    const newEmail = req.body.email.trim();

    if (!newEmail || newEmail.length === 0) {
      return res.json({ result: false, error: 'New email cannot be empty' });
    }

    const existingUser = await User.findOne({ email: newEmail });
    if (existingUser && existingUser.token !== token) {
      return res.json({ result: false, error: 'This email is already use'});
    }

    const updatedUser = await User.findOneAndUpdate(
      { token },
      { email: newEmail },
      { new: true } // renvoie le document mis à jour plutôt que l'ancien document
    );

    if (!updatedUser) {
      return res.status(404).json({ result: false, error: 'User not found or token invalid' });
    }

    res.json({ result: true, message: 'Email updated successfully', email: updatedUser.email });

  } catch (error) {
    console.error('Error updating email:', error);
    res.status(500).json({ result: false, error: 'Internal server error during email update'});
    
  }
})

// Route pour pour modifier uniquement le theme
router.patch('/theme', checkAuth, async (req, res) => {
  try {
    const token = req.user.token;

    // Récupération des infos du front
    const newTheme = req.body.theme;

    if (!newTheme) {
      return res.json({ result: false, error: 'Theme name is empty' });
    }

    // Validation du thème
    if (!THEMES.includes(newTheme)) {
      return res.json({ result: false, error: `Invalid theme. Must be one of: ${THEMES.join(', ')}` });
    }

    const updatedUser = await User.findOneAndUpdate(
      { token },
      { theme: newTheme },
      { new: true } // renvoie le document mis à jour plutôt que l'ancien document
    );

    res.json({ result: true, message: 'Theme updated successfully', theme: updatedUser.theme });

  } catch (error) {
    console.error('Error updating theme:', error);
    res.status(500).json({ result: false, error: 'Internal server error during theme update'});

  }
})

// Route pour modifier le mode d'apparence (light/dark)
router.patch('/appearance-mode', checkAuth, async (req, res) => {
  try {
    const token = req.user.token;

    // Récupération des infos du front
    const newAppearanceMode = req.body.appearanceMode;

    if (!newAppearanceMode) {
      return res.json({ result: false, error: 'Appearance mode is empty' });
    }

    // Validation du mode d'apparence
    if (!APPEARANCE_MODES.includes(newAppearanceMode)) {
      return res.json({ result: false, error: `Invalid appearance mode. Must be one of: ${APPEARANCE_MODES.join(', ')}` });
    }

    const updatedUser = await User.findOneAndUpdate(
      { token },
      { appearanceMode: newAppearanceMode },
      { new: true }
    );

    res.json({ result: true, message: 'Appearance mode updated successfully', appearanceMode: updatedUser.appearanceMode });

  } catch (error) {
    console.error('Error updating appearance mode:', error);
    res.status(500).json({ result: false, error: 'Internal server error during appearance mode update'});
  }
})

// Route pour modifier l'icône de notation
router.patch('/notation-icon', checkAuth, async (req, res) => {
  try {
    const token = req.user.token;

    // Récupération des infos du front
    const newNotationIcon = req.body.notationIcon;

    if (!newNotationIcon) {
      return res.json({ result: false, error: 'Notation icon is empty' });
    }

    // Validation de l'icône de notation
    if (!NOTATION_ICON_TYPES.includes(newNotationIcon)) {
      return res.json({ result: false, error: `Invalid notation icon. Must be one of: ${NOTATION_ICON_TYPES.join(', ')}` });
    }

    const updatedUser = await User.findOneAndUpdate(
      { token },
      { notationIcon: newNotationIcon },
      { new: true }
    );

    res.json({ result: true, message: 'Notation icon updated successfully', notationIcon: updatedUser.notationIcon });

  } catch (error) {
    console.error('Error updating notation icon:', error);
    res.status(500).json({ result: false, error: 'Internal server error during notation icon update'});
  }
})

module.exports = router;