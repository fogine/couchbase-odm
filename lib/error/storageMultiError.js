var util = require('util');

/**
 * StorageMultiError
 *
 * @constructor
 * @extends Error
 *
 * @param {Array<StorageError>} errors
 * */
function StorageMultiError(errors) {

    Error.call(this);
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.message = null;
    this.code = null;
    this.errors = errors || {}
}

util.inherits(StorageMultiError, Error);
exports = module.exports = StorageMultiError;
