//Twilio credential
var accountSid = process.env.TWILIO_ACCOUNT_SID;
var authToken = process.env.TWILIO_AUTH_TOKEN;

//require the Twilio module and create a REST client 
var client = require('twilio')(accountSid, authToken); 

module.exports = client;