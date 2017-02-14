var express = require('express');
var router = express.Router();
var stormpath = require('express-stormpath');
var __ = require('underscore');

var async = require('async');

// var smsApplicationSid = 'AP879ede80ca39c61ebafb32fd8ecb270c'       
// var voiceApplicationSid = 'AP879ede80ca39c61ebafb32fd8ecb270c'      
// var smsApplicationSid = 'AP010d6ec59e50384dc9b243801cff1577'       
// var voiceApplicationSid = 'AP010d6ec59e50384dc9b243801cff1577'      

//require the Twilio module and create a REST client 
var client = require('../../util/twilioClient');

var PhoneNumber = require('../../models/PhoneNumber');
var Price = require('../../models/Pricing');

var constants = require('../../util/constants');

//get the form to edit number friendlyName
router.get('/:phoneNumber([\+][0-9]{11})', function(req, res) {
	var phoneNumber = req.params.phoneNumber;	
	var num = req.session.phoneNumbers[phoneNumber];

	// for(var x in num) {
	// 	console.log(x + ': ' + num[x]);
	// }	
	
	res.render('number', {number: num});
});

//display the search form
router.get('/find', function (req, res) { 	
	res.render('find', {find_active: 'active'})
});

//update phone number friendly name
router.post('/update', function(req, res, next) {
	var sid = req.body.sid;
	var friendlyName = req.body.friendlyName;
	client.accounts(req.user.customData.accountSid).incomingPhoneNumbers(sid).update({    
			friendlyName: friendlyName,               
		}, function(err, number) { 
			if(err) {
				console.log(err);
				next(err);
			} else {
				req.session.phoneNumbers[number.phone_number] = new PhoneNumber(number);
				res.redirect('/private/dashboard');
			}
	});		
});

//update number forwarding sms
router.post('/updateforwarding', function(req, res, next) {

	var method = req.body.optradio;
	var sid = req.body.sid;

	console.log('method is ' + method);

	if(method === 'default') {
		console.log('update default method');

		client.accounts(req.user.customData.accountSid).incomingPhoneNumbers(sid).update({			
			smsUrl: constants.smsNoResponse
		}, function(err, number) {
			if(err) console.log(err);
			req.session.phoneNumbers[number.phone_number].smsUrl = constants.smsNoResponse;
			res.redirect('/private/dashboard');	
		});

	} else if (method === 'phone') {
		console.log('update forward to phone');		
		client.accounts(req.user.customData.accountSid).incomingPhoneNumbers(sid).update({					
			smsUrl: req.protocol + '://' + req.get('host') + '/forward/' + req.body.phone
			// smsUrl: 'https://tungtpms.herokuapp.com/forward/' + req.body.phone              			
		}, function(err, number) { 
			if(err) {
				console.log(err);								
				next(err);
			} else {
				//update the phonenumbers session variable
				console.log('update the session ' + req.session.phoneNumbers);
				req.session.phoneNumbers[number.phone_number].smsUrl = number.smsUrl;
				res.redirect('/private/dashboard');	
			}
		});	

	} else if (method === 'email') {
		console.log('update forward to email');
		client.accounts(req.user.customData.accountSid).incomingPhoneNumbers(sid).update({					
			smsUrl: 'https://tungtpms.herokuapp.com/forwardToEmail/' + req.body.email              			
		}, function(err, number) { 
			if(err) { 
				console.log(err);								
				next(err);
			} else {
				//update the session 
				console.log('update the session');
				req.session.phoneNumbers[number.phone_number].smsUrl = number.smsUrl;
				res.redirect('/private/dashboard');	
			}
		});	
	} else {
		console.log('nothing to change for forwarding');
		next();
	}
});

//buy a new number 
router.post('/create', function(req, res, next) {
	console.log('in creating new number, current session info is ' + req.session.phoneNumbers);

	//first check if enough credit
	//take credit - $2
	var current = Number(req.user.customData.credits);
	if(current < Price.phonenumbers) {
		//not enough credit to buy new number
		console.log('not enough credit to buy new number, send back custom status 2000');
		
 		res.setHeader('Content-Type', 'application/json');
		res.send(JSON.stringify({reason: 999}));
		
	} else {

			//now purchase from Twilio
			var phoneNumber = req.body.phoneNumber;
			var friendlyName = req.body.friendlyName;

			client.accounts(req.user.customData.accountSid).incomingPhoneNumbers.create({ 		
				phoneNumber: phoneNumber,  
				friendlyName: friendlyName,  
				smsMethod: 'POST',       
				smsUrl: constants.smsNoResponse,      
				voiceMethod: 'POST',
				voiceUrl: 'http://twimlets.com/voicemail'

			}, function(err, number) {
				if(err) {
					res.send('Could not buy new phone number');
					next(err);
				} else {
					req.session.phoneNumbers[number.phoneNumber] = new PhoneNumber(number); 
					res.redirect('/private/dashboard');	

					//update balance
					require('./accounting')(req, next);
				}				
			});
	}	
});

//For testing only
// router.post('/create', stormpath.getUser, function(req, res) {
// 	var phoneNumber = req.body.phoneNumber;
// 	console.log('in create, phoneNumber is ' + phoneNumber);
// 	console.log('sleeping');
// 	setTimeout(() => {		
// 		res.sendStatus(500);
// 	}, 5000);	
// });


router.post('/delete', function(req, res) {
	var phoneNumber = req.body.phoneNumber;
	var sid = req.session.phoneNumbers[phoneNumber].sid;	

	console.log('deleting ' + phoneNumber);	

	client.accounts(req.user.customData.accountSid).incomingPhoneNumbers(sid).delete(function(err, number) {

		if(err) {
			console.log('could not delete from Twilio ' + err);
			next(err);
		}
		else {
			console.log('succesfully deleted from Twilio');
			
			//delete from global list
			delete req.session.phoneNumbers[phoneNumber];

			res.redirect('/private/dashboard');			
		}	
	});
});

//list available phone numbers
router.post('/find', function(req, res, next) {
	var areacode = req.body.areacode;	
	client.accounts(req.user.customData.accountSid).availablePhoneNumbers('US').local.get({ 
			areaCode: areacode,         
			excludeAllAddressRequired: "false", 
			excludeLocalAddressRequired: "false", 
			excludeForeignAddressRequired: "false" 
		}, function(err, data) { 
			if(err) next(err);
			res.render('find', {numbers: data.available_phone_numbers, find_active: 'active'}); 
		});
}); 

// send SMS
router.post('/send', (req, res, next) => {
	console.log('sending msg');
	var sid = req.body.sid; 
	var to = req.body.to;
	var from = req.body.from;
	var body = req.body.body;	

	client.accounts(req.user.customData.accountSid).messages.create({
		from: from,
		to: to,
		body: body
		}, function(err, message) {
			// console.log(message);
			res.redirect('/private/messages/'+from);			
	});

	require('./accounting')(req, next);
});

module.exports = router;