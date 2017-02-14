var express = require('express');
var router = express.Router();

router.use('/dashboard', require('./dashboard'));
router.use('/number', require('./number'));
router.use('/messages', require('./messages'));
router.use('/calls', require('./calls'));
router.use(require('./credits'));
router.use(require('./report'));

module.exports = router;

