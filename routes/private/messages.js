var express = require('express');
var router = express.Router();

//Twilio credential
const client = require('../../util/twilioClient');

var __ = require('underscore');

//get list of sms
router.get('/:number([\+][0-9]{11})', function(req, res) {
	var number = req.params.number;
	console.log('query sms for ' + number);

	client.accounts(req.user.customData.accountSid).messages.list(function(err, data) {
		var messages = data.messages;

		//conversation are msg pertaining to this number
		messages = __.filter(messages, function(msg) {
			return ((msg.from == number && msg.status === 'delivered') || (msg.to == number && msg.status === 'received'));
		});

		res.render('messages', {messages: messages});
	});
});

//delete the message
router.post('/delete', function(req, res) {
	var msgid = req.body.sid;
	console.log('inside delete for ' + msgid);
	client.accounts(req.user.customData.accountSid).messages(msgid).delete(function(err) {
		if(err) {
			console.log(err);
			res.sendStatus(500);
		} else {
			console.log('message deleted successfully');
			res.sendStatus(200);
		}
	});
});

module.exports = router;
