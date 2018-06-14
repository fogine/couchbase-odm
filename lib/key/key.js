var _       = require('lodash');
var Promise = require('bluebird');

module.exports = Key;


/**
 *
 * Key
 *
 * @constructor
 * @abstract
 *
 * @throws {Error}
 *
 * @param {Object}         options
 * @param {string|integer} options.id
 * @param {string}         options.prefix
 * @param {string}         options.postfix=""
 * @param {string}         options.delimiter="_"
 * @param {Boolean}        options.caseSensitive=true
 */
function Key(options) {

    if (this.constructor === Key) {
        throw new Error("Can not initiate an Abstract class");
    }

    options = _.assign({
        caseSensitive: true
    }, options);

    this.prefix        = options.prefix;
    this.postfix       = options.postfix;
    this.delimiter     = options.delimiter;
    this.caseSensitive = options.caseSensitive;
    this.$isGenerated  = false;

    this.setId(options.id);
}


/**
 * generates an id for the key
 * This method is called before inserting new document to a bucket
 * The method must return a Prosime
 * Unless overriden this method always return rejected Promise with an Error
 *
 *
 * @param {Instance} instance
 *
 * @return {Promise<Error>}
 * @abstract
 */
Key.prototype.generate = function(instance) {
    return Promise.reject(new Error("Calling unimplemented abstract method `Key.generate()`"));
};

/**
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
};

/**
 * @return {boolean}
 */
Key.prototype.isGenerated = function() {
    return this.$isGenerated;
};

/**
 * @param {string}
 *
 */
Key.prototype.getId = function() {
    return this.id;
};

/**
 * @param {string} key - whole key of a document
 *
 * @return {Key}
 */
Key.prototype.parse = function(key) {
    if (typeof key !== 'string') {
        throw new Error('Expected `key` to be a string but got ' + typeof key);
    }
    var prePart = this.prefix + this.delimiter;
    var postPart = this.delimiter + this.postfix;
    var till = undefined;
    if (this.postfix.length) {
        till = -postPart.length;
    }

    this.setId(key.slice(prePart.length, till));
    //todo check id consistency
    return this;
};

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
};

/**
 * @return {Key}
 */
Key.prototype.clone = function() {
    var clone = new this.constructor(this.getOptions());
    return clone;
};

/**
 * returns the key
 *
 * @return {string}
 */
Key.prototype.toString = function() {
    var id = (this.caseSensitive === false ? this.id && this.id.toLowerCase() : this.id);
    var key =  this.prefix + this.delimiter + id;
    if (this.postfix) {
        key += this.delimiter + this.postfix;
    }
    return key;
};
