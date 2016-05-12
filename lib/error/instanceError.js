var util          = require('util');
var DocumentError = require('./documentError.js');

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
    DocumentError.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.message = message;
}

util.inherits(InstanceError, DocumentError);
exports = module.exports = InstanceError;
