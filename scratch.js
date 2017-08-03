var PouchDB = require('pouchdb');
PouchDB.plugin(require('pouchdb-quick-search'));

var miscDb = new PouchDB('./database/miscellaneous.db');
var suttaDb = new PouchDB('./database/suttaDatabase.db');

const flatten = function(arr, result = []) {
  for (let i = 0, length = arr.length; i < length; i++) {
    const value = arr[i];
    if (Array.isArray(value)) {
      flatten(value, result);
    } else {
      result.push(value);
    }
  }
  return result;
};

suttaDb.allDocs({
                  include_docs: true,
                  attachments: true,
            }).then(function (result) {

                result = result.rows.map(function(item){ return item.doc.tags;});
                result = flatten(result);

                tags = Array.from(new Set(result));
                miscDb.get("allSuttaTags").then(function(doc){
                    doc.suttaTags = tags;
                    miscDb.put(doc);
                });

            }).catch(function (err) {
                  console.log(err);
            });
