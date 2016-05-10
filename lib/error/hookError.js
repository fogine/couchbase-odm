var util = require('util');

/**
 * HookError
 *
 * @constructor
 * @extends Error
 *
 * @param {string} message
 * */
function HookError(message) {

    Error.call(this);
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.message = message;
}

util.inherits(HookError, Error);
exports = module.exports = HookError;
