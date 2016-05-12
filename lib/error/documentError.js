var util = require('util');

/**
 * DocumentError
 *
 * @constructor
 * @extends Error
 *
 * @param {string} message
 * */
function DocumentError(message) {

    Error.call(this);
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.message = message;
}

util.inherits(DocumentError, Error);
exports = module.exports = DocumentError;
