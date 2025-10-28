var express = require('express');
var router = express.Router();

const { checkBody } = require('../modules/checkBody');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

module.exports = router;
