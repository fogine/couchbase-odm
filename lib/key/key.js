var KeyError = require("../error/keyError.js");

module.exports = Key;


/**
 *
 * Key
 *
 * @constructor
 * @abstract
 *
 * @param {Object}         options
 * @param {string|integer} options.id
 * @param {string}         options.prefix
 * @param {string}         options.postfix=""
 * @param {string}         options.delimiter="_"
 */
function Key(options) {

    if (this.constructor === Key) {
        throw new Error("Can not initiate an Abstract class");
    }

    this.prefix        = options.prefix;
    this.postfix       = options.postfix;
    this.delimiter     = options.delimiter;
    this.caseSensitive = options.caseSensitive;
    this.$isGenerated  = false;

    this.setId(options.id);
}


/**
 * generate
 *
 * generates new key
 * This method is called before inserting new document to a bucket
 * The method must return a prosime
 *
 * @param {Instance} instance
 *
 * @throws {Error}
 * @abstract
 */
Key.prototype.generate = function(instance) {
    throw new Error("Calling unimplemented abstract method `Key.generate()`");
}

/**
 * setId
 *
 * @param {string} id
 *
 * @return {undefined}
 */
Key.prototype.setId = function(id) {
    this.id = id;

    this.$isGenerated = id ? true : false;

    if (this.caseSensitive === false && typeof this.id == 'string') {
        this.id = this.id.toLowerCase();
    }
}

/**
 * isGenerated
 *
 * @return {boolean}
 */
Key.prototype.isGenerated = function() {
    return this.$isGenerated;
}

/**
 * getId
 *
 * @param {string}
 *
 */
Key.prototype.getId = function() {
    return this.id;
}

/**
 * parse
 *
 * @param {string} key - whole key of a document
 *
 * @return {Key}
 */
Key.prototype.parse = function(key) {
    var prePart = this.prefix + this.delimiter;
    var postPart = this.delimiter + this.postfix;
    var till = undefined;
    if (this.postfix.length) {
        till = -postPart.length;
    }

    this.setId(key.slice(prePart.length, till));
    //todo check id consistency
    return this;
}

/**
 * @typedef KeyOptionsObject
 * @type Object
 * @property {mixed} id - dynamic part of a key
 * @property {string} prefix - static string value preceding **`id`** value
 * @property {string} postfix - static string value which comes after **`id`** value
 * @property {string} delimiter - the key string `User_username_happiecat` - has the **`_`** character as delimiter value
 * @property {boolean} caseSensitive - determines whether **`id`** value is case sensitive or not
 */

/**
 * getOptions
 *
 * @return {KeyOptionsObject}
 */
Key.prototype.getOptions = function() {
    var clone = {
        id: this.id,
        prefix: this.prefix,
        postfix: this.postfix,
        delimiter: this.delimiter,
        caseSensitive: this.caseSensitive
    };

    return clone;
}

/**
 * clone
 *
 * @return {Key}
 */
Key.prototype.clone = function() {
    var clone = new this.constructor(this.getOptions());
    return clone;
}

/**
 * toString
 *
 * returns the key
 *
 * @return {string}
 */
Key.prototype.toString = function() {
    var id = (this.caseSensitive === false ? this.id.toLowerCase() : this.id);
    var key =  this.prefix + this.delimiter + id;
    if (this.postfix) {
        key += this.delimiter + this.postfix;
    }
    return key;
}
