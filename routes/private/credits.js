var express = require('express');
var router = express.Router();
var client = require('../../util/twilioClient');

var paypal = require('paypal-rest-sdk');
var config = {
 	"mode": process.env.PP_mode,
	"client_id" : process.env.PP_client_id,
	"client_secret" : process.env.PP_client_secret
};

paypal.configure(config);

router.get('/credits', function (req, res, next) {
	console.log('in get /credits');
	require('./accounting')(req, next, (function() {res.render('credits', {pk_key: process.env.STRIPE_PK})}));
});

/* posting charge to stripe*/
router.post('/credits', function (req, res) {
	var token = req.body.token;
	var amount = req.body.amount;

	amount = amount * 100;

	console.log('token is ' + token + ' , amount is ' + amount);

	var stripe = require("stripe")(process.env.STRIPE_SK);

	var charge = stripe.charges.create({
	  amount: amount, // amount in cents, again
	  currency: "usd",
	  source: token,
	  description: "Payment to MOREPHONE.US"
	}, function(err, charge) {
	  if (err && err.type === 'StripeCardError') {
	  	console.log(err);
	    res.render('error', {error: err});
	  } else {
	  	console.log('stripe charge completed ' + charge);

	  	//now save to user custom data
	  	req.user.customData.credits = Number(req.user.customData.credits) + Number(amount);
	  	req.user.customData.save(function(error) {
	  		if(error) {
	  			console.log('failed to save credits to user custom data');
	  			res.sendStatus(500);
	  		} else {
	  			console.log('all good');
	  			res.sendStatus(200);
	  		}
	  	});

	  }

	});
});

/* Paypal */
router.get('/paypal', function(req, res) {

	var amount = req.query.amount;
	console.log('paypal amount is ' + amount);

	var host = req.get('host');
	var protocol = req.protocol;
	var base = protocol + '://' + host;

	var payment = {
	  "intent": "sale",
	  "payer": {
	    "payment_method": "paypal"
	  },
	  "experience_profile_id": "XP-HFBN-DRCS-X5HJ-F55L", //prod
	  "redirect_urls": {
	    "return_url": base + "/private/execute",
	    "cancel_url": req.headers.referer
	  },
	  "transactions": [{
	  	"item_list": {
            "items": [{
                "name": "credits",
                "sku": "item",
                "price": amount,
                "currency": "USD",
                "quantity": 1
            }]
        },
	    "amount": {
	      "total": amount,
	      "currency": "USD"
	    },
	    "description": req.user.email + " payment"
	  }]
	};

	paypal.payment.create(payment, function (error, payment) {
	  if (error) {
	    console.log(error);
	  } else {
	    if(payment.payer.payment_method === 'paypal') {
	      req.session.paymentId = payment.id;
	      var redirectUrl;
	      for(var i=0; i < payment.links.length; i++) {
	        var link = payment.links[i];
	        if (link.method === 'REDIRECT') {
	          redirectUrl = link.href;
	        }
	      }
	      res.redirect(redirectUrl);
	    }
	  }
	});
});

router.get('/execute', function(req, res) {
	var paymentId = req.session.paymentId;
	var payerId = req.query.PayerID;

	var details = { "payer_id": payerId };
	var payment = paypal.payment.execute(paymentId, details, function (error, payment) {
		if (error) {
			console.log(error);
			res.render('error', { 'error': error });
		} else {
			req.user.customData.credits = Number(req.user.customData.credits) + Number(payment.transactions[0].amount.total)*100;
			req.user.customData.save(function(error) {
				if(error)
					res.render('error', {'error': error});
				else
					res.redirect('/private/credits');
			});

		}
	});
});

// router.post('/createwebprofile', function(req, res) {

// 	var profile_name ="morephoneWP";

// 	var create_web_profile_json = {
// 	    "name": profile_name,
// 	    "presentation": {
// 	        "brand_name": "MOREPHONE",
// 	        "locale_code": "US"
// 	    },
// 	    "input_fields": {
// 	        "allow_note": true,
// 	        "no_shipping": 1,
// 	        "address_override": 1
// 	    },
// 	    "flow_config": {
// 	        "landing_page_type": "billing"
// 	    }
// 	};

// 	paypal.webProfile.create(create_web_profile_json, function (error, web_profile) {
// 	    if (error) {
// 	        throw error;
// 	    } else {
// 	        console.log("Create web_profile Response");
// 	        console.log(web_profile);
// 	    }
// 	});
// });

module.exports = router;
