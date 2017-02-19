var express = require('express');
var router = express.Router();
var __ = require('underscore');
var stormpath = require('express-stormpath');
var async = require('async');
var PhoneNumber = require('../../models/PhoneNumber');
var client = require('../../util/twilioClient');

//get list of numbers
router.get('/', function(req, res, next) {
	console.log('checkkkkkkkkkkkkkkkkkkkk', JSON.stringify(req.session.phoneNumbers));
	const data = {
		title: 'Dashboard',
		numbers: req.session.phoneNumbers
	}
	res.render('dashboard', data);
});

router.get('/export', (req, res) => { res.render('export')});

router.get('/reports', (req, res) => {
	var phoneNumbers = req.session.phoneNumbers;

	for(var key in phoneNumbers) {
		if(phoneNumbers.hasOwnProperty(key)) {
			client.accounts(req.user.customData.accountSid).messages.list(function(err, data) {
				var messages = data.messages;

				//conversation are msg pertaining to this number
				messages = __.filter(messages, function(msg) {
					return ((msg.from == key && msg.status == 'delivered') || (msg.to == key && msg.status == 'received'));
				});

				console.log(messages.length);
			});
		}
	}

	res.render('reports', {numbers: phoneNumbers})
});

module.exports = router;
