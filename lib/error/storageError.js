var util = require('util');

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

    Error.call(this);
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.message = message;
    this.code = code;
    this.doc = doc || null;
    this.index = null;
}

util.inherits(StorageError, Error);
exports = module.exports = StorageError;
