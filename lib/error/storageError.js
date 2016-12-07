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
exports = module.exports = StorageError;
