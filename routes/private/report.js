var express = require('express');
var router = express.Router();
var async = require('async');
const Price = require('../../models/Pricing');

//require the Twilio module and create a REST client
const client = require('../../util/twilioClient');

router.get('/usage/sms', function(req, res) {
	console.log('in usage report');

	var new_usage = {};

	var categories = Object.keys(Price);
	// console.log('categories is ' + categories);

  async.each(categories, function(category, callback) {
    client.accounts(req.user.customData.accountSid).usage.records.get({
      category: category
    }, function(err, data) {
      if(err) {
        console.log(err);
        callback('error getting data for ' + category);
      } else {
        // console.log(data);
        data.usage_records.forEach(record => {
          new_usage[category] = record.usage;
        });
        callback();
      }
    });
  }, function(err) {
    if(err) {
      console.log(err);
    } else {
    	new_usage['totalprice'] = getTotalPrice(new_usage);
      res.render('reports', {usage: new_usage});
    }
  });
});

function getTotalPrice(usage) {
	var total = 0;
	total += Price.sms * usage.sms;
	total += Price.calls * usage.calls;
	total += Price.phonenumbers * usage.phonenumbers;

	return total;
}

module.exports = router;
