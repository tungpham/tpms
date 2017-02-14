var express = require('express');
var router = express.Router();

var __ = require('underscore');

//Twilio credential
var client = require('../../util/twilioClient');

router.get('/:phoneNumber([\+][0-9]{11})', function(req, res) {
	var phoneNumber = req.params.phoneNumber;
	client.accounts(req.user.customData.accountSid).calls.list(function(err, data) {
		res.render('voices', {voices: __.filter(data.calls, function(call) {
			return call.from == phoneNumber || call.to == phoneNumber;
		})});
	});
});

//this response with the resource in ajax call
router.get('/recording/:sid', function(req, res) {
	var sid = req.params.sid;
	console.log('in get recording for sid ' + sid);
	client.accounts(req.user.customData.accountSid).recordings.get({callSid: sid}, function(err, data) { 
		if(err) console.log(err);
		data.recordings.forEach(function(recording) { 
			console.log(recording.uri);
			console.log('sleep 5 sec before sending back data');
			setTimeout(() => {		
				res.send('https://api.twilio.com'+recording.uri.replace('json', 'wav'));
			}, 5000);		 		
	 		// res.send('https://api.twilio.com'+recording.uri.replace('json', 'wav')); 
		}); 
	});
	//res.send('https://api.twilio.com/2010-04-01/Accounts/AC0f2bbfbfcb3f016f9f93ff92a2560c73/Recordings/REc0755fbc8978eee1b68e1bfe084f654e.wav');
});

module.exports = router;