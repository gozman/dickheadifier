var express = require('express');
var exphbs = require('express-handlebars');
var jimp = require('jimp');

require('dotenv').config();

const cognitiveServices = require('cognitive-services');

var app = express();
var request = require('superagent');

app.set('views', './views');
app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

app.get('/', function(req, res) {
  res.render('home');
});

app.get('/go', function(req, res) {
  var srcUrl = req.query.srcUrl;

  const face = cognitiveServices.face({
    API_KEY: process.env['FACE_API_KEY']
  });

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
          res.send(500);
        }

        var faces = response.body;

        jimp.read('http://i.imgur.com/LhgKb7n.png', function(err, dick) {
          jimp.read(srcUrl, function(err, img) {
            for(var i=0; i<faces.length; i++) {
              if(faces[i].faceAttributes.gender == 'male') {

                console.log(faces[i]);

                dick.resize(faces[i].faceRectangle.width*1.25, faces[i].faceRectangle.height*1.8);
                img.composite(dick, faces[i].faceRectangle.left-faces[i].faceRectangle.width/3, faces[i].faceRectangle.top-faces[i].faceRectangle.height/3);
                img.write(i + '.jpg', function() {console.log("wrote dick!")});
              }
            }

            img.write( 'output.jpg', function() {
              console.log('done!');
            } );
          });
        });

        res.redirect("/");
    });
});

app.listen(3000);
