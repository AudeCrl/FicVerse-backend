const { User } = require('../models/users');

const checkAuth = async (req, res, next) => {
    //Récupération du token
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ result: false, error: 'Missing token in Authorization header' });
    }

    try {
        //Recherche de l'utilisateur
        const user = await User.findOne({ token });

        if (!user) {
            return res.status(401).json({ result: false, error: 'Invalid token or user not found' });
        }

        //Ajout de l'utilisateur trouvé au req
        req.user = user;

        //Passage au code à éxécuter suivant
        next();

    } catch (error) {
        console.error(('Authentication error:', error));
        res.status(500).json({ result: false, error: 'Server authentication error' });        
    }
};

module.exports = { checkAuth }