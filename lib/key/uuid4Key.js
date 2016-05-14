var util      = require('util');
var uuid      = require('node-uuid');
var Promise   = require("bluebird");
var Key       = require("./key.js");
var KeyError  = require("../error/keyError.js");
var DataTypes = require("../dataType.js").types;


module.exports = UUID4Key;

/**
 * UUID4Key
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
function UUID4Key(options) {
    Key.call(this, options);
}
UUID4Key.dataType = DataTypes.STRING;

util.inherits(UUID4Key, Key);
UUID4Key.prototype.super = Key.prototype;

/**
 * setid
 *
 * @param {string} id
 * @return {undefined}
 */
UUID4Key.prototype.setId = function(id) {
    if (typeof id !== 'string' && id !== undefined) {
        throw new KeyError('Expected `id` to be a string, but got: ' + typeof id);
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
 * @param {Instance} instance
 *
 */
UUID4Key.prototype.generate = function(instance) {
    this.setId(uuid.v4());
    return Promise.resolve(this);
}

/**
 * clone
 *
 * @return {UUID4Key}
 */
UUID4Key.prototype.clone = function() {
    var clone = new UUID4Key(this.getOptions());
    return clone;
}

/**
 * parse
 *
 * @param {string}  key - whole key of document
 *
 */
UUID4Key.prototype.parse = function(key) {
    this.super.parse.call(this, key);
    var regx = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (this.getId().match(regx) === null) {
        throw new KeyError('Failed to parse uuidv4 from key string ' + this.getId());
    }
}

/**
 * inspect
 *
 * @return {string}
 */
Object.defineProperty(UUID4Key.prototype, 'inspect', {
    writable: true,
    value: function() {
        return '[object UUID4Key: "' + this.toString() + '" ]';
    }
});
