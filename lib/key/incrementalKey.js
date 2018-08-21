const util      = require('util');
const Promise   = require("bluebird");
const Key       = require("./key.js");
const KeyError  = require("../error/keyError.js");

module.exports = IncrementalKey;

/**
 *
 * IncrementalKey
 *
 * @constructor
 * @extends Key
 *
 * @param {Object}         options
 * @param {string|integer} options.id
 * @param {string}         options.prefix
 * @param {string}         options.postfix=""
 * @param {string}         options.delimiter="_"
 */
function IncrementalKey(options) {
    Key.call(this, options);
}

IncrementalKey.dataType = 'integer';

util.inherits(IncrementalKey, Key);
IncrementalKey.prototype.super = Key.prototype;

/**
 * @param {string} id
 * @return {undefined}
 */
IncrementalKey.prototype.setId = function(id) {
    if (id !== undefined) {
        let regx = /^[0-9]+$/;
        if ((id + '').match(regx) === null) {
            throw new KeyError('Failed to set `id`. The value must be an integer (or a string with integer value), got: ' + id);
        }
    }

    this.super.setId.call(this, id);
}

/**
 * generates new key
 * This method is called before inserting new document to a bucket
 * The method must return a prosime
 *
 * @this IncrementalKey
 * @param {Instance} instance
 *
 * @function
 * @return {Promise<IncrementalKey>}
 */
IncrementalKey.prototype.generate = Promise.method(function(instance) {
    let counterKey = this.prefix + this.delimiter + 'counter';

    let storageAdapter = instance.getStorageAdapter();

    return storageAdapter.counter(counterKey, 1, {initial: 1})
    .bind(this)
    .then(function(res) {
        this.setId(res.value);
        return this;
    });
});

/**
 * @return {string}
 */
Object.defineProperty(IncrementalKey.prototype, 'inspect', {
    writable: true,
    value: function() {
        return '[object IncrementalKey: "' + this.toString() + '" ]';
    }
});
