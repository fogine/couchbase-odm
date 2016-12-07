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
 * setId
 *
 * @throws KeyError
 *
 * @param {string} id
 * @return {undefined}
 */
UUID4Key.prototype.setId = function(id) {
    if (id !== undefined) {
        var regx = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if ((id + '').match(regx) === null) {
            throw new KeyError('Failed to set `id`. The value is not in format of uuidv4, got: ' + id);
        }
    }

    this.super.setId.call(this, id);
};

/**
 * generate
 *
 * generates new key
 * This method is called before inserting new document to a bucket
 * The method must return a prosime
 *
 * @param {Instance} instance
 *
 * @function
 * @return Promise<UUID4Key>
 */
UUID4Key.prototype.generate = Promise.method(function(instance) {
    this.setId(uuid.v4());
    return this;
});

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
