var couchbase = require('couchbase');
var util      = require('util');

var CouchbaseError = couchbase.Error;

/**
 * StorageError
 *
 * @constructor
 * @extends Error
 *
 * @param {string} message
 * @param {integer} code
 * @param {Document} doc
 * */
function StorageError(message, code, doc) {

    CouchbaseError.call(this);
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.message = message;
    this.code = code;
    this.doc = doc || null;
    this.index = null;
}

util.inherits(StorageError, CouchbaseError);

StorageError.prototype.toJSON = function toJSON() {
    var out = {
        type: "CouchbaseError",
        message: this.message,
        code: this.code
    };

    if (this.doc) {
        out.key = this.doc.getKey().toString();
    }

    return out;
};

exports = module.exports = StorageError;
