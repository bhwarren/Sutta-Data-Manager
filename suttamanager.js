var express = require('express');
var bodyParser = require("body-parser");
var deepCopy = require("deep-copy");
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
var userDb = new PouchDB('./database/userDatabase.db');
var miscDb = new PouchDB('./database/miscellaneous.db');

var validDbFields = [
    {'fieldName': 'title' , 'fieldType':'value'},
    {'fieldName': 'summary' , 'fieldType':'value'},
    {'fieldName': 'tags' , 'fieldType':'array'},
    {'fieldName': 'parallels' , 'fieldType':'array'},
    {'fieldName': 'translations' , 'fieldType':'array'},
    {'fieldName': 'questions' , 'fieldType':'value'},
    {'fieldName': 'notes' , 'fieldType':'value'},
];

var validUserFields = [
    {'fieldName': '_id', 'fieldType': 'value'},
    {'fieldName': 'lastSutta', 'fieldType': 'value'}
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

app.get('/', function(req, res){
    res.sendFile(__dirname + '/public/views/index.html');
});

app.get('/lastEdited', function(req, res){
    var resp = "";
    userDb.get("bhwarren").then(function(doc){
        resp = doc.lastSutta;
    }).catch(function(err){
        resp = err;
    }).then(function(){
        res.send(resp);
    });
});

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


app.get('/recentEdits', function(req, res){
    miscDb.get('recentEdits').then(function(doc){
        res.send(doc.edits);
    }).catch(function(err){
        res.send(err.toString());
    });
});

app.get('/getAllTags', function(req, res){
    miscDb.get('allSuttaTags').then(function(doc){
        res.send(doc.suttaTags);
    }).catch(function(err){
        if(err.message == "missing"){
            miscDb.put({"_id": "allSuttaTags", "suttaTags": []});
        }
        res.send(err.toString());
    });
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

    userDb.get("bhwarren").then(function (doc) {
        doc.lastSutta = id;
        return userDb.put(doc);
    }).catch(function (err) {
        var newDoc = {"_id": "bhwarren", "lastSutta": id};
        return userDb.put(newDoc);
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
    suttaDb.search(query).then(function (searchResult) {
        res.send(searchResult);
    });
});


function prettifyDoc(document){
    var doc = deepCopy(document);
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
        if(newValue != undefined){
            var oldValue = document[field];
            document[field] = newValue;

            logChange(document, field);
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

function logChange(document, field){
    miscDb.get('recentEdits').then(function (doc) {

        var found = false;
        var lastIndex = -1;
        for(var i=0; i < doc.edits.length; i++){
            if(doc.edits[i].fullname == prettifyDoc(document).fullname){
                found = true;
                lastIndex = i;
            }
        }

        i = lastIndex;
        var isTimedOut = false;
        if(doc.edits[i]){
            var currFieldIndex = doc.edits[i].fields.indexOf(field);
            if(currFieldIndex == -1){
                doc.edits[i].fields.push(field);
            }

            var timeoutMillis = 2*60*60*1000; //2 hours
            isTimedOut = -(doc.edits[i].time - (new Date().getTime())) > timeoutMillis;

        }

        var isSameEdit = found ? !isTimedOut : false;


        if(isSameEdit){
            doc.edits[i].time = Date.now();

            var edit = doc.edits.splice(i, 1)[0];
            doc.edits.push(edit);
        }
        else{
            doc.edits.push({
                "fields": [field],
                "fullname": prettifyDoc(document).fullname,
                "_id": document._id,
                "title": document.title,
                "time": Date.now()
            });
        }

        var maxEntries = 50;
        if(doc.edits.length > maxEntries){
            var numToDelete = doc.edits.length - maxEntries;
            doc.edits.splice(0, numToDelete);
        }

        return miscDb.put(doc);
    }).catch(function (err) {
        console.log(err);
    });
}



var port = 4444;
app.listen(port, function () {
  console.log('Example app listening on port '+port+'!');
});
