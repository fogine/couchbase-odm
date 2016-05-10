var util = require('util');

/**
 * KeyError
 *
 * @constructor
 * @extends Error
 *
 * @param {string} message
 * */
function KeyError(message) {

    Error.call(this);
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.message = message;
}

util.inherits(KeyError, Error);
exports = module.exports = KeyError;
