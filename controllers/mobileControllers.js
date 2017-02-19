const twilioClient = require('../util/twilioClient');
const PhoneNumber = require('../models/PhoneNumber');
const mobileControllers = {
  initPhoneNumbers: function(req, res, next) {
    console.log('Init phoneNumbers');
    if(!req.session) {
      console.log('no session created yet on req');
      next();
    }
    if(req.session.phoneNumbers) {
      console.log('phoneNumbers already in session');
      next();
    }

    const phoneNumbers = {};
    twilioClient.accounts(req.user.customData.accountSid).incomingPhoneNumbers.list(function(err, data) {
      if(err) {
        console.log(err);
        next(err);
      } else {
        data.incoming_phone_numbers.forEach(function(num) {
          phoneNumbers[num.phone_number] = new PhoneNumber(num);
        });
        req.session.phoneNumbers = phoneNumbers;
        next();
      }
    });
  }
}

module.exports = mobileControllers;
