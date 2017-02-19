var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res) {
	const data = {
		layout: false,
		title: 'Virtual Phone Managment System',
		user: req.user
	}
	res.render('pages/home', data);
});

/********** Twilio app **********/

//forward to phone
router.post('/forward/:number', function(req, res) {
	var body = req.body.Body;
	body = body.substr(0, 1600);

	res.render('forward', {number: req.params.number, friendlyName: '', content: body, layout: false});
});

router.get('/forwardToEmail', function(req, res) {
	res.render('pages/forwardToEmail');
});

//forward to email
router.post('/forwardToEmail/:to', function(req, res, next) {

	var to = req.params.to;
	console.log('to is ' + to);

	var body = req.body.Body;

	console.log('body is ' + body);

	if(body) {
		body = body.substr(0, 1600);
	}

	var from = req.body.From;

	console.log('from is ' + from);

	res.header("Content-Type", "text/xml");
	res.render('forwardToEmail', {layout: false});

	var sendgrid = require("sendgrid")(process.env.SENDGRID);
	var email = new sendgrid.Email();

	var payload   = {
	  to      : to,
	  from    : from,
	  subject : 'MOREPHONE.US SMS forward',
	  text    : body
	};

	sendgrid.send(payload, function(err, json) {
		if(err) console.log(err);
		console.log(json);
	});

});


module.exports = router;
