
var client = require('./twilioClient');
var async = require('async');
var constants  = require('./constants');

/* Handlerbars helpers */
var helpers = 
{
  format: function (dollar) {
    return (dollar/100).toFixed(2);   
  },
  isSelected: function(smsUrl, type) {
    
    switch(type) {
      case "default":          
        console.log('in default, smsUrl is ' + smsUrl);
        if(smsUrl === constants.smsNoResponse) 
          return 'checked';        
      break;

      case "phone":
        console.log('in phone, smsUrl is ' + smsUrl);
        if(smsUrl && smsUrl.indexOf('/forward') > 0)          
          return 'checked';        
      break;

      case "email":
        if(smsUrl && smsUrl.indexOf('@') > 0) {                      
            return 'checked';
        } else {
          return '';
        }
      break;
    }     
  },
  getPhoneValue: function(url) {
    if(!url) return;
    if(url === constants.smsNoResponse) return;
    if(url.indexOf('@') > -1) return '';
    return url.substr(url.lastIndexOf('/')+1, url.length);
  },
  getEmailValue: function(url) {
    if(!url) return;
    if(url.indexOf('@') > -1)
      return url.substr(url.lastIndexOf('/')+1, url.length);  
    else 
      return ''
  }
};

module.exports = helpers;