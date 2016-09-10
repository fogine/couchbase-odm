var util     = require('util');
var Promise  = require("bluebird");
var Key      = require("./key.js");
var _        = require('lodash');
var KeyError = require("../error/keyError.js");


module.exports = RefDocKey;

/**
 *
 * RefDocKey
 *
 * @constructor
 * @private
 * @extends Key
 *
 * @throws KeyError
 *
 * @param {Object}         options
 * @param {string|integer} options.id
 * @param {string}         options.prefix
 * @param {string}         options.postfix=""
 * @param {string}         options.delimiter="_"
 * @param {Array}          options.ref=[] - array of document's properties from refDoc definition object
 */
function RefDocKey(options) {
    Key.call(this, options);

    /**
     * Array ref
     * properties which make up index (= refDoc key)
     * = property names from schema definition
     * eg.: username, email etc.
     */
    this.setRef(options.ref || []);
}

util.inherits(RefDocKey, Key);
RefDocKey.prototype.super = Key.prototype;

/**
 * setRef
 *
 * @throws {KeyError}
 * @param Array ref
 *
 */
RefDocKey.prototype.setRef = function(ref) {
    if (!Array.isArray(ref) || !ref.length) {//TODO check this in schema validation function
        throw new KeyError("RefDocKey - index reference type/s must be non-empty Array");
    }

    this.ref = ref;
}

/**
 * setId
 *
 * @param string|Array id
 *
 */
RefDocKey.prototype.setId = function(id) {
    if (id instanceof Array) {
        id = id.join(this.delimiter);
    }

    this.super.setId.call(this, id);
}

/**
 * generate
 *
 * generates new key
 * This method is called before inserting new document to a bucket
 * The method must return a prosime
 *
 * @param Instance instance
 * @return Promise<>
 *
 */
RefDocKey.prototype.generate = function(instance) {

    return Promise.resolve(instance).bind(this).then(function(instance) {
        var id = "";

        var instanceData = instance.getData();

        for (var i = 0, len = this.ref.length; i < len; i++) {
            var propertyPath = this.ref[i];

            var propValue = _.get(instanceData, propertyPath);
            if (propValue === null || propValue === undefined || propValue === "") {
                return Promise.reject(new KeyError("RefDocKey - Failed to get index value from data of Instance"));
            }

            if (id !== "") {
                id += this.delimiter;
            }
            id += (this.caseSensitive === false ? propValue.toLowerCase() : propValue);
        }
        this.setId(id);
        return this;
    });
}

/**
 * toString
 *
 * returns the key
 *
 * @return string
 */
RefDocKey.prototype.toString = function() {
    var key = this.prefix + this.delimiter + this.ref.join(this.delimiter) + this.delimiter + this.id;
    if (this.postfix) {
        key += this.delimiter + this.postfix;
    }
    return key;
}

/**
 * inspect
 *
 * @return string
 */
Object.defineProperty(RefDocKey.prototype, 'inspect', {
    writable: true,
    value: function() {
        return '[object RefDocKey: "' + this.toString() + '" ]';
    }
});
