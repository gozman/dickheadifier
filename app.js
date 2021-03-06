var express = require('express');
var exphbs = require('express-handlebars');
var jimp = require('jimp');
const bodyParser = require('body-parser');
const SmoochCore = require('smooch-core');

require('dotenv').config();

var app = express();
var request = require('superagent');
var upload = require('superagent');

app.use(bodyParser.json());
app.set('views', './views');
app.set('port', (process.env.PORT || 5000));
app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

app.get('/', function(req, res) {
  res.render('home');
});

app.post('/start', function(req, res) {
  var appUserId = req.body.appUser._id;

  var smooch = new SmoochCore({
      keyId: process.env['SMOOCH_KEY'],
      secret: process.env['SMOOCH_SECRET'],
      scope: 'app'
  });

  smooch.appUsers.sendMessage(appUserId, {
    type: 'text',
    text: "Hi, I'm Dickhead bot. Send me an image and I'll add some dick to it.",
    role: 'appMaker'
  }).then(() => {
    res.sendStatus(200);
  });

  return;
})

app.post('/smooch', function(req, res) {
  var srcUrl = req.body.messages[0].mediaUrl;
  var appUserId = req.body.appUser._id;
  var smooch = new SmoochCore({
      keyId: process.env['SMOOCH_KEY'],
      secret: process.env['SMOOCH_SECRET'],
      scope: 'app'
  });

  if(!srcUrl) {
    //No image was sent...
    smooch.appUsers.sendMessage(appUserId, {
      type: 'text',
      text: "Send me an image, and I'll add some dick to it if I can",
      role: 'appMaker'
    }).then(() => {
      res.sendStatus(200);
    });

    return;
  } else {
    smooch.appUsers.sendMessage(appUserId, {
      type: 'text',
      text: "Hmmm, let me take a look...",
      role: 'appMaker'
    }).then(() => {});
  }

  const parameters = {
    returnFaceId: "true",
    returnFaceLandmarks: "false"
  };
  const body = {
      "url": srcUrl
  };

  request
    .post('https://westus.api.cognitive.microsoft.com/face/v1.0/detect?returnFaceId=true&returnFaceLandmarks=false&returnFaceAttributes=age,gender,facialHair')
    .set('Content-Type', 'application/json')
    .set('Ocp-Apim-Subscription-Key', process.env['FACE_API_KEY'])
    .send(body)
    .end(function(err, response) {
        if(err) {
          console.log(err);
          res.sendStatus(500);

          return;
        }

        var faces = response.body;
        if(faces.length) {
          smooch.appUsers.sendMessage(appUserId, {
            type: 'text',
            text: "Found some faces, give me a sec to make some magic happen",
            role: 'appMaker'
          }).then(() => {});
        } else {
          smooch.appUsers.sendMessage(appUserId, {
            type: 'text',
            text: "Didn't find any faces",
            role: 'appMaker'
          }).then(() => {res.sendStatus(200)});

          return;
        }

        let operations = [];
        let dicks = [];
        for(var j=1; j<8; j++) {
          operations.push(new Promise((resolve, reject) => {
            jimp.read('./public/dicks/d' + j + '.png', (err, dick) => {
              if(err) {
                reject(err);
              } else {
                dicks.push(dick);
                resolve();
              }
            });
          }));
        }

        Promise.all(operations).then(() => {
          jimp.read(srcUrl, function(err, img) {
            for(var i=faces.length-1; i>=0; i--) {
              if(faces[i].faceAttributes.gender == 'male' && faces[i].faceAttributes.age > 21 ) {

                console.log(faces[i]);

                dicks[i % 7].resize(faces[i].faceRectangle.width*2, faces[i].faceRectangle.height*2);
                img.composite(dicks[i % 7], faces[i].faceRectangle.left-faces[i].faceRectangle.width/3, faces[i].faceRectangle.top-faces[i].faceRectangle.height/3);
              }
            }


            if(img.bitmap.width > 1500) {
                img.scale(1500/img.bitmap.width);
            }

            if(img.bitmap.height > 1500) {
              img.scale(1500/img.bitmap.height);
            }

            img.getBuffer(jimp.MIME_JPEG, function(err, imgBuffer) {
              upload
                .post('https://api.smooch.io/v1/appusers/' + appUserId + '/images')
                .set('Authorization', smooch.authHeaders.Authorization)
                .set('content-type', 'multipart/form-data')
                .attach('source', imgBuffer, {filename: 'upload.jpg'})
                .field('role', 'appMaker')
                .field('name', 'DickheadBot')
                .end(function(err, response) {
                  if(err) {
                    console.log(err);
                    smooch.appUsers.sendMessage(appUserId, {
                      type: 'text',
                      text: "Something went wrong, try another image maybe?",
                      role: 'appMaker'
                    }).then(() => {res.sendStatus(500);});

                    return;
                  }

                  res.sendStatus(200);
                });
            });
          });
        });
    });

});


app.listen(app.get('port'), function() {
    console.log('App is running, server is listening on port ', app.get('port'));
});
