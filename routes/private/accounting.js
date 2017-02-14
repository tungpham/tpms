var async = require('async');
var Price = require('../../models/Pricing');
var client = require('../../util/twilioClient');

function adjustBalance(req, next, cb) {		

	var new_usage = {};
	
	var categories = Object.keys(Price);

	console.log('categories is ' + categories);

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
      console.log('new_usage ' + JSON.stringify(new_usage));                

      var last_usage = req.user.customData.last_usage;
      console.log('last_usage ' + JSON.stringify(last_usage));
						
			//get delta
			var delta = calculateDelta(last_usage, new_usage);				

			var current_credits = req.user.customData.credits;
			console.log('current credit is ' + current_credits);

			req.user.customData.credits = current_credits - delta;
			req.user.customData.last_usage = new_usage;

			req.user.customData.save(function(err) {
				if(err) {
					console.log('failed to save customData');
					next(err);
				} else {				
					if(cb)	
						cb();
				}
			});								
    }
  });    	
}

function calculateDelta(last_usage, new_usage) {

	if(!last_usage)
		return 0;

	var delta = {};
	
	Object.keys(Price).forEach(function(key) {
		delta[key] = new_usage[key] - last_usage[key];
	});

	console.log('delta is ' + JSON.stringify(delta));	

	//now apply pricing
	var total = 0;
	total += Price.sms * delta.sms;
	total += Price.calls * delta.calls; 
	total += Price.phonenumbers * delta.phonenumbers; 
	
	console.log('total is ' + total);
	
	return total;
}

module.exports = adjustBalance;