const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const bodyParser = require('body-parser');
const stormpath = require('express-stormpath');
const async = require('async');
const session = require('express-session');
const exphbs = require('express-handlebars');

/**** Router Init ****/
const routerFrontend = require('./routes/frontend');
const routerBackend = require('./routes/private');

const __ = require('underscore');
const app = express();

/**** Twilio Init ****/
const client = require('./util/twilioClient');
const helpers = require('./util/helpers');

/**** Controllers Init ****/
// const mobileControllers = require('./controllers/mobileControllers');

/**
 * View engine setup using handerbarjs
 */
app.set('views', path.join(__dirname, 'views'));
app.engine('.hbs', exphbs({
  defaultLayout: 'default', // see view/layouts/default.hsb
  extname: '.hbs',
  helpers: helpers
}));
app.set('view engine', '.hbs');

/****** Middlewares ******/

/**
 * Static data as css, javascript, image. All in folders public
 */
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(express.static(path.join(__dirname, 'public')));

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

/**
 * Start using session
 * If Production isset redis, save cache
 */
if(app.get('env') === 'development') {
  app.use(session({
    secret: process.env.EXPRESS_SECRET,
    cookie: {secure: 'auto'},
    resave: false,
    saveUninitialized: false
  }));
}
else {
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

/**
 * Check for session here
 * If it doesn't exist, then try to reconnect to redis
 */
app.use(function (req, res, next) {
  if (!req.session) {
    return next(new Error('oh no how come theres no session'));
  }
  next();
});

/**
 * Remove session created by express-session after user log out
 */
app.post('/logout', function(req, res, next) {
  req.session.destroy(function(err) {
    if(err) console.log('err in destroying session');
    console.log('destroy session successfully');
  });

  next();
});

/**
 * Stormpath Init
 */
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
    // Note: use Promise later
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

/**
 * Route initialization. Frontend and Backend
 */

app.use('/', stormpath.getUser, routerFrontend);
app.use('/private', stormpath.loginRequired, initPhoneNumbers, routerBackend);

function initPhoneNumbers(req, res, next) {
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
};

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

//****************** error handlers ******************//
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: (app.get('env') === 'development') ? err : {}
  });
});

module.exports = app;
