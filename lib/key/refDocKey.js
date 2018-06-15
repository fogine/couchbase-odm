const util     = require('util');
const Promise  = require("bluebird");
const Key      = require("./key.js");
const _        = require('lodash');
const KeyError = require("../error/keyError.js");


module.exports = RefDocKey;

/**
 *
 * RefDocKey
 *
 * @constructor
 * @extends Key
 *
 * @throws KeyError
 *
 * @param {Object}         options
 * @param {string|integer} options.id
 * @param {string}         options.prefix
 * @param {string}         options.postfix=""
 * @param {string}         options.delimiter="_"
 * @param {Boolean}        options.caseSensitive=true
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
    this._setRef(options.ref || []);
}

util.inherits(RefDocKey, Key);
RefDocKey.prototype.super = Key.prototype;

/**
 * @throws {KeyError}
 * @private
 * @param Array ref
 *
 */
RefDocKey.prototype._setRef = function(ref) {
    if (!Array.isArray(ref) || !ref.length) {//TODO check this in schema validation function
        throw new KeyError("RefDocKey - index reference type/s must be non-empty Array");
    }

    this.ref = ref;
};

/**
 * @param string|Array id
 *
 */
RefDocKey.prototype.setId = function(id) {
    if (id instanceof Array) {
        id = id.join(this.delimiter);
    }

    this.super.setId.call(this, id);
};

/**
 * @typedef RefDocKeyOptionsObject
 * @type Object
 * @property {mixed} id - dynamic part of a key
 * @property {string} prefix - static string value preceding **`id`** value
 * @property {string} postfix - static string value which comes after **`id`** value
 * @property {string} delimiter - the key string `User_username_happiecat` - has the **`_`** character as delimiter value
 * @property {boolean} caseSensitive - determines whether **`id`** value is case sensitive or not
 * @property {Array} ref - array of document's properties from refDoc definition object
 */

/**
 * @return {RefDocKeyOptionsObject}
 */
RefDocKey.prototype.getOptions = function() {
    let options = this.super.getOptions.call(this);
    options.ref = _.cloneDeep(this.ref);
    return options;
};

/**
 * generates new key
 * This method is called before inserting new document to a bucket
 * The method must return a prosime
 *
 * @param Instance instance
 * @function
 * @return Promise<RefDocKey>
 */
RefDocKey.prototype.generate = Promise.method(function(instance) {

    let id = "";
    let instanceData = instance.getData();

    for (let i = 0, len = this.ref.length; i < len; i++) {
        let propertyPath = this.ref[i];

        let propValue = _.get(instanceData, propertyPath);
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


/**
 * @param {string} key - whole key of a document
 *
 * @return {RefDocKey} - self
 */
RefDocKey.prototype.parse = function(key) {
    if (typeof key !== 'string') {
        throw new Error('Expected `key` to be a string but got ' + typeof key);
    }
    let prePart = this.prefix + this.delimiter + this.ref.join(this.delimiter) + this.delimiter;
    let postPart = this.delimiter + this.postfix;
    let till = undefined;
    if (this.postfix.length) {
        till = -postPart.length;
    }

    this.setId(key.slice(prePart.length, till));
    return this;
};

/**
 * returns the key
 *
 * @return string
 */
RefDocKey.prototype.toString = function() {
    let key = this.prefix + this.delimiter + this.ref.join(this.delimiter) + this.delimiter + this.id;
    if (this.postfix) {
        key += this.delimiter + this.postfix;
    }
    return key;
};

/**
 * @return string
 */
Object.defineProperty(RefDocKey.prototype, 'inspect', {
    writable: true,
    value: function() {
        return '[object RefDocKey: "' + this.toString() + '" ]';
    }
});
