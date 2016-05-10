var KeyError = require("../error/keyError.js");

module.exports = Key;


/**
 *
 * Key
 *
 * @constructor
 * @abstract
 *
 * @param {Object} options
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
 * getOptions
 *
 * @return {Object}
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
