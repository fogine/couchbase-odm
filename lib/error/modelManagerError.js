var util = require('util');

/**
 * ModelManagerError
 *
 * @constructor
 * @extends Error
 *
 * @param {string} message
 * */
function ModelManagerError(message) {

    Error.call(this);
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.message = message;
}

util.inherits(ModelManagerError, Error);
exports = module.exports = ModelManagerError;
