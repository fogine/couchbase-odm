var util = require('util');

/**
 * ModelError
 *
 * @constructor
 * @extends Error
 *
 * @param {string} message
 * */
function ModelError(message) {

    Error.call(this);
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.message = message;
}

util.inherits(ModelError, Error);
exports = module.exports = ModelError;
