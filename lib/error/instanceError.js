var util          = require('util');
var DocumentError = require('./documentError.js');

exports = module.exports = InstanceError;

/**
 * InstanceError
 *
 * @constructor
 * @extends DocumentError
 *
 * @param {string} message
 * */
function InstanceError(message) {

    DocumentError.call(this);
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.message = message;
}

util.inherits(InstanceError, DocumentError);
