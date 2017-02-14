var express = require('express');
var bodyParser = require("body-parser");
var PouchDB = require('pouchdb');
PouchDB.plugin(require('pouchdb-quick-search'));

var collectionInfo = require('./public/js/collectionInfo.json');

var request = require('request');
var cheerio = require('cheerio');


var app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));

var suttaDb = new PouchDB('./database/suttaDatabase.db');

var validDbFields = [
    {'fieldName': 'title' , 'fieldType':'value'},
    {'fieldName': 'summary' , 'fieldType':'value'},
    {'fieldName': 'tags' , 'fieldType':'array'},
    {'fieldName': 'parallels' , 'fieldType':'array'},
    {'fieldName': 'translations' , 'fieldType':'array'}
];

//sutta summaries
var designDoc = {
    _id: '_design/all_suttas_index',
    views: {
        'all_suttas_index': {
            map: function(doc) {
                emit(doc._id, doc.summary);
            }.toString()
        }
    }
};

//     suttaDb.put(designDoc);
// suttaDb.get('_design/all_suttas_index').then(function (doc) {
//     suttaDb.remove(doc);
// }).then(function(){
// }).catch(function (err) {
//     console.log(err);
// });


//serve static content
app.use('/static', express.static(__dirname + '/public'));

app.get('/suttatext', function(req, res){
    request(req.query.url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var $ = cheerio.load(body);
            res.send($('#text').html());
        }
    });
});

app.get('/suttaInfo', function(req, res){
    var id = req.query.id;
    var responseStr = "";

    suttaDb.get(id).then(function(doc){
        doc = prettifyDoc(doc);
        responseStr = JSON.stringify(doc);
    }).catch(function(err){
        responseStr = "id doesn't exist";
    }).then(function(){
        res.send(responseStr);
    });
});

app.get('/', function(req, res){
    res.sendFile(__dirname + '/public/views/index.html');
});

app.post('/', function (req, res) {
    console.log(JSON.stringify(req.body));
    var id = req.body.id;
    if(!id){
        res.send("Please specify a text to update");
        return;
    }

    suttaDb.get(id).then(function (doc) {
        var updatedDoc = updateFields(req.body, doc, false);
        res.send("document updated");
        return suttaDb.put(updatedDoc);
    }).catch(function (err) {
        var newDoc = {"_id":id};
        newDoc = updateFields(req.body, newDoc, true);
        res.send("new document saved");
        return suttaDb.put(newDoc);
    });
});


app.post('/searchDB', function(req, res){
    var value = req.body.value;
    var category = req.body.category;

    var query = {
      query: value,
      fields: [category],
      include_docs: true,
      highlighting: true
    };
    console.log(JSON.stringify(query));
    suttaDb.search(query).then(function (searchResult) {
        console.log('result: ' + JSON.stringify(searchResult));
        res.send(searchResult);
    });
});


function prettifyDoc(doc){
    var [collectionId, textNum] = doc._id.split(":");
    doc.collection = collectionInfo[collectionId].fullname;
    doc.fullname = doc.collection + " " + textNum;
    doc.collectionId = collectionId;
    doc.textNum = parseInt(textNum, 10);
    doc._rev = undefined;
    return doc;
}

function updateFields(reqBody, document){
    validDbFields.forEach(function(key) {
        var field = key.fieldName;
        var type = key.fieldType;

        var newValue = reqBody[field];
        //if user posted a new value
        if(newValue){
            document[field] = newValue;
        }
        else if( !document[field] ){
            //initialize default values
            if(type == "value"){
                document[field] = "";
            }
            else if(type == "array"){
                document[field] = [];
            }
        }

    });
    return document;
}


var port = 4444;
app.listen(port, function () {
  console.log('Example app listening on port '+port+'!');
});
