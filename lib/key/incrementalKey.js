var util      = require('util');
var Promise   = require("bluebird");
var DataTypes = require("../dataType.js").types;
var Key       = require("./key.js");
var KeyError  = require("../error/keyError.js");

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

IncrementalKey.dataType = DataTypes.INT;

util.inherits(IncrementalKey, Key);
IncrementalKey.prototype.super = Key.prototype;

/**
 * generate
 *
 * generates new key
 * This method is called before inserting new document to a bucket
 * The method must return a prosime
 *
 * @this IncrementalKey
 * @param {Instance} instance
 *
 * @return {Promise<this>}
 *
 */
IncrementalKey.prototype.generate = function(instance) {
    var counterKey = this.prefix + this.delimiter + 'counter';

    var storageAdapter = instance.getStorageAdapter();

    return storageAdapter.counter(counterKey, 1, {initial: 1})
    .bind(this)
    .then(function(res) {
        this.setId(res.value);
        return this;
    });
}

/**
 * parse
 *
 * @throws {KeyError}
 *
 * @param {string}  key - whole key of document
 *
 */
IncrementalKey.prototype.parse = function(key) {
    this.super.parse.call(this, key);
    if (/[^0-9]/.exec(this.getId()) !== null) {
        throw new KeyError('Failed to parse integer id from key string');
    }
}

/**
 * inspect
 *
 * @return {string}
 */
Object.defineProperty(IncrementalKey.prototype, 'inspect', {
    writable: true,
    value: function() {
        return '[object IncrementalKey: "' + this.toString() + '" ]';
    }
});
