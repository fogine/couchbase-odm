var util = require('util');

/**
 * ValidationError
 *
 * @constructor
 * @extends Error
 *
 * @param {string} message
 * */
function ValidationError(message) {

    Error.call(this);
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.message = message;
}

util.inherits(ValidationError, Error);
exports = module.exports = ValidationError;
