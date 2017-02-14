var PhoneNumber = function (num) {
	this.sid = num.sid;
	this.phoneNumber = num.phone_number;
	this.friendlyName = num.friendly_name;
	this.smsUrl = num.sms_url;
	this.smsApplicationSid = num.sms_application_sid;
};

module.exports = PhoneNumber;