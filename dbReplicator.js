var fs = require('fs');
var PouchDB = require('pouchdb');
var replicationStream = require('pouchdb-replication-stream');

PouchDB.plugin(replicationStream.plugin);
PouchDB.adapter('writableStream', replicationStream.adapters.writableStream);

var suttaDb = new PouchDB('./database/suttaDatabase.db');
var userDb = new PouchDB('./database/userDatabase.db');
var miscDb = new PouchDB('./database/miscellaneous.db');


var option = process.argv[2];

if(option == "dump"){
    var suttaDump = fs.createWriteStream('./database/dbDumps/suttas.txt');
    var userDump = fs.createWriteStream('./database/dbDumps/user.txt');
    var miscDump = fs.createWriteStream('./database/dbDumps/misc.txt');

    suttaDb.dump(suttaDump).then(function (res) {console.log(res);});
    userDb.dump(userDump).then(function (res) {console.log(res);});
    miscDb.dump(miscDump).then(function (res) {console.log(res);});
}
else if(option == "load"){
    var suttaDump = fs.createReadStream('./database/dbDumps/suttas.txt');
    var userDump = fs.createReadStream('./database/dbDumps/user.txt');
    var miscDump = fs.createReadStream('./database/dbDumps/misc.txt');

    suttaDb.load(suttaDump).then(function (res) {console.log(res);});
    userDb.load(userDump).then(function (res) {console.log(res);});
    miscDb.load(miscDump).then(function (res) {console.log(res);});
}
