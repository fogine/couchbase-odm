var util = require('util');

/**
 * ModelNotFoundError
 *
 * @constructor
 * @extends Error
 *
 * @param {string} message
 * */
function ModelNotFoundError(message) {

    Error.call(this);
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.message = message;
}

util.inherits(ModelNotFoundError, Error);
exports = module.exports = ModelNotFoundError;
