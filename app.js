
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var bodyParser = require('body-parser');

var stormpath = require('express-stormpath');
var async = require('async');

//session 
var session = require('express-session');

var exphbs = require('express-handlebars');

//routes
var public = require('./routes/public')
var private = require('./routes/private');

var __ = require('underscore');

var app = express();

//Twilio
var client = require('./util/twilioClient'); 

var PhoneNumber = require('./models/PhoneNumber');

var helpers = require('./util/helpers');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.engine('.hbs', exphbs({
  defaultLayout: 'single', 
  extname: '.hbs', 
  helpers: helpers
}));
app.set('view engine', '.hbs');

/****** Middlewares ******/

//static shit
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(express.static(path.join(__dirname, 'public')));

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

//public route, declare before session because we don't want to use session here. 
//but somehow stormpath.getUser doesn't work because there's no cookie on the req object
// app.use('/', stormpath.getUser, public);

//start using session 
if(app.get('env') === 'development') {
  app.use(session({
    secret: process.env.EXPRESS_SECRET,
    cookie: {secure: 'auto'},
    resave: false,
    saveUninitialized: false
  }));
} 
else {
  //production
  var redis = require("redis");
  var redisClient = redis.createClient({
    url: process.env.REDISCLOUD_URL
  });
  redisClient.on("error", function (err) {
      console.log("redisClient " + err);
  });
  var RedisStore = require('connect-redis')(session);
  app.use(session({  
    store: new RedisStore({
      client: redisClient,

    }),
    secret: process.env.EXPRESS_SECRET,
    cookie: {secure: 'auto'},
    resave: false,
    saveUninitialized: false,
  }));  
}

//check for session here, if it doesn't exist, then try to reconnect to redis
app.use(function (req, res, next) {
  if (!req.session) {
    return next(new Error('oh no how come theres no session')); // handle error 
  } 
  next(); //otherwise moving on  
});

// our custom code to remove session created by express-session after user log out
app.post('/logout', function(req, res, next) {
  req.session.destroy(function(err) {
    if(err) console.log('err in destroying session');
    console.log('destroy session successfully');
  });

  next();
});

//stormpath init
app.use(stormpath.init(app, {
  website: true,
  api: true,
  expand: {
    apiKeys: true,
    customData: true
  },
  web: {
    login: {
      nextUri: '/private/dashboard'
    },
    logout: {
      nextUri: '/'
    }
  },
  postRegistrationHandler: function(account, req, res, next) {
    async.parallel([
      // Set the user's default settings.
      function(cb) {        
        account.customData.credits = 0;   
        cb();
      },
      // Create an API key for this user.
      function(cb) {
        account.createApiKey(function(err, key) {
          if (err) return cb(err);
          cb();
        });
      },
      //create subaccount on twilio
      function(cb) {
        client.accounts.create({
          friendlyName: account.email
        }, function(err, twilioAccount) {
          if(err) {
            console.log('cannot create subaccount on twilio');
            return cb(err);
          }
          account.customData.accountSid = twilioAccount.sid;
          account.customData.save(function(error) {
            if(error) return cb(error);
            
            cb();
          })          
        });
      }
    ], function(err) {
      if (err) return next(err);
      next();
    });
  },
  postLoginHandler: function(account, req, res, next) {
    initPhoneNumbers(req, res, next);
  }
}));


//init phoneNumbers in session
function initPhoneNumbers(req, res, next) {
  console.log('initPhoneNumbers ');

  if(req.session) {
    console.log('session exist');
    if(!req.session.phoneNumbers) {
      console.log('no phoneNumbers in session yet');
      var phoneNumbers = {};

      client.accounts(req.user.customData.accountSid).incomingPhoneNumbers.list(function(err, data) {
        if(err) {
          console.log(err);
          next(err);
        } else {
          data.incoming_phone_numbers.forEach(function(num) {
            phoneNumbers[num.phone_number] = new PhoneNumber(num);  
          });
          req.session.phoneNumbers = phoneNumbers;
          console.log('init phoneNumbers to session ' + req.session.phoneNumbers);
          next();
        }
      });

    } 
    else {
      console.log('phoneNumbers already in session');
      // console.log(req.session.phoneNumbers);
      next();
    }
  }
  else {
    console.log('no session created yet on req');
    next();
  }
};

app.use('/', stormpath.getUser, public);

//routes to be protected by stormpath
app.use('/private', stormpath.loginRequired, initPhoneNumbers, private);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

//****************** error handlers ******************//

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

module.exports = app;
