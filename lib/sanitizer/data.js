/**
 * @module Data Sanitizer
 * @private
 */

var _      = require('lodash');
var moment = require('moment');

var DataType        = require("../dataType");
var Instance        = require("../instance.js");
var ValidationError = require("../error/validationError.js");

var DataTypes  = DataType.types;
var sanitizers = {};

module.exports.sanitize = sanitize;
module.exports.sanitizers = sanitizers;

/**
 * @param {mixed}  val
 * @param {Object} [opt]
 * @param {sting}  [opt.propPath] - full path of property being sanitized
 * @function
 * @return {integer|float}
 */
sanitizers[DataTypes.NUMBER] = sanitizers[DataTypes.FLOAT] = function(val, opt) {

    opt = opt || {};

    if (typeof val === 'number') {
        return val;
    }

    var containsNonDigit = /[^0-9.]$/.exec(val.toString()) !== null;
    val = Number.parseFloat(val);

    if (Number.isNaN(val) || containsNonDigit) {
        throw new ValidationError((opt.propPath || 'Object data') + " value is not of type integer or float");
    }
    return val;
}

/**
 * @param {mixed}  val
 * @param {Object} [opt]
 * @param {sting}  [opt.propPath] - full path of property being sanitized
 * @function
 * @return {integer}
 */
sanitizers[DataTypes.INT] = function(val, opt) {

    opt = opt || {};

    var containsNonDigit = /[^0-9]/.exec(val.toString()) !== null;
    val = (typeof val !== 'number' && Number.parseInt(val) ) || val;

    if (Number.isNaN(val) || Math.floor(val) !== val || containsNonDigit) {
        throw new ValidationError((opt.propPath || 'Object data') + " value is not an integer number");
    }
    return val;
}

/**
 * @param {mixed}  val
 * @param {Object} [opt]
 * @param {sting}  [opt.propPath] - full path of property being sanitized
 * @function
 * @return {string}
 */
sanitizers[DataTypes.STRING] = function(val, opt) {

    opt = opt || {};

    if (!_.isString(val)) {
        throw new ValidationError((opt.propPath || 'Object data') + " value is not of type `string`");
    }
    return val.toString();
}

/**
 * @param {mixed}  val
 * @param {Object} [opt]
 * @param {sting}  [opt.propPath] - full path of property being sanitized
 * @function
 * @return {boolean|integer}
 */
sanitizers[DataTypes.BOOLEAN] = function(val, opt) {

    opt = opt || {};

    var err = new ValidationError((opt.propPath || 'Object data') + " value is not of type Boolean");
    var type = typeof val;
    if (   type !== 'boolean'
        && type !== 'number'
        || (type === 'number' && val !== 1 && val !== 0)
    ) {
        throw err;
    }

    if (val === 1) val = true;
    if (val === 0) val = false;

    return val;
}

/**
 * @param {mixed}  val
 * @param {Object} [opt]
 * @param {sting}  [opt.propPath] - full path of property being sanitized
 * @function
 * @return {Date}
 */
sanitizers[DataTypes.DATE] = function(val, opt) {

    opt = opt || {};

    var err = new ValidationError((opt.propPath || 'Object data') + " value is not valid date/date-time value");

    if (val === null) {//new Date(null) returns "Wed Dec 31 1969 19:00:00 GMT-0500 (EST)"
        throw err;
    }

    val = new Date(val);

    if ( Object.prototype.toString.call(val) !== "[object Date]" || isNaN(val.getTime())) {
        throw err;
    }

    return moment.utc(val).format();
}

/**
 * @param {mixed}   val
 * @param {Object}  opt
 * @param {Object}  opt.schema
 * @param {array}   opt.schema.enum
 * @param {integer} [opt.schema.type]
 * @param {mixed}   [opt.schema.default]
 * @param {boolean} [opt.schema.allowEmptyValue]
 * @param {sting}   [opt.propPath] - full path of property being sanitized
 *
 * @function
 * @return {mixed} `val`
 */
sanitizers[DataTypes.ENUM] = function(val, opt) {

    opt = opt || {};

    if (opt.schema.enum.indexOf(val) == -1) {
        throw new ValidationError((opt.propPath || 'Object data') + " value is not a value of enumerated type");
    }

    return val;
}

/**
 * @param {mixed}          val
 * @param {Object}         opt
 * @param {Model}          opt.model
 * @param {boolean|Object} opt.associations - whether associations should be sanitized recursively
 * @param {boolean}        opt.includeUnlisted
 * @param {boolean}        opt.skipInternalProperties
 * @param {Object}         opt.schema
 * @param {integer}        opt.schema.type
 * @param {array}          [opt.schema.enum]
 * @param {mixed}          [opt.schema.default]
 * @param {boolean}        [opt.schema.allowEmptyValue]
 * @param {sting}          [opt.propPath] - full path of property being sanitized
 *
 * @function
 * @return {Instance}
 */
sanitizers[DataType.Complex.toString()] = function(val, opt) {

    opt = opt || {};

    var refModel = opt.schema.type.getModel(opt.model.$modelManager);

    if (!(val instanceof refModel.Instance)) {
        throw new ValidationError((opt.propPath || 'Object data') + " value is not instance of `" + refModel.name + '`');
    }

    if (   opt.associations === true
        || (_.isPlainObject(opt.associations)
            && opt.associations[opt.schema.type.options.relation.toLowerCase()] === true
            )
    ) {
        val.sanitize({
            skipInternalProperties: true,
            includeUnlisted: opt.includeUnlisted,
            associations: opt.associations
        });
    }

    return val;
}

/**
 * @param {mixed}        val
 * @param {Object}       opt
 * @param {Model}        opt.model
 * @param {boolean}      opt.includeUnlisted
 * @param {boolean}      opt.skipInternalProperties
 * @param {Object}       opt.schema
 * @param {Object}       opt.schema.schema
 * @param {integer}      opt.schema.schema.type
 * @param {sting}        [opt.propPath] - full path of property being sanitized
 *
 * @function
 * @return {array}
 */
sanitizers[DataTypes.ARRAY] = function(val, opt) {

    opt = opt || {};

    if (_.isPlainObject(opt.schema.schema) && opt.schema.schema.type) {
        var type = opt.schema.schema.type;

        if (!(val instanceof Array)) {
            throw new ValidationError((opt.propPath || 'Object data')+ " value is not of type Array");
        }

        for (var y = 0, len = val.length; y < len; y++) {
            val[y] = this[type](val[y], {
                propPath: opt.propPath,
                schema: opt.schema.schema,
                model: opt.model,
                includeUnlisted: opt.includeUnlisted,
                skipInternalProperties: opt.skipInternalProperties
            });
        }
    }

    return val;

}

/**
 *
 * recursive validates data against defined schema &
 * attempts to convert the data to defined type & sets default values
 *
 * @param {mixed}        data
 * @param {Object}       opt
 * @param {sting}        opt.propPath - full path of property being sanitized
 * @param {Model}        opt.model
 * @param {boolean}      opt.includeUnlisted
 * @param {boolean}      opt.skipInternalProperties
 * @param {boolean}      opt.schema.allowEmptyValue
 * @param {Object}       opt.schema
 * @param {integer}      [opt.schema.type]
 * @param {array}        [opt.schema.enum]
 * @param {mixed}        [opt.schema.default]
 *
 * @function
 * @return {Object}
 */
sanitizers[DataTypes.HASH_TABLE] = function(data, opt) {

    opt = opt || {};

    var err = new ValidationError((opt.propPath || 'Object data') + " value is not of type Object (Hash table)");
    var internalProps = opt.model.$getInternalProperties();

    data = inspectEmptyValue(opt.model.name + ' data', data, opt.schema);

    if (_.isNil(data)) {
        return data;
    } else if (!_.isPlainObject(data)) {
        throw err;
    }

    if (_.isPlainObject(opt.schema.schema)) {
        var keys = Object.keys(opt.schema.schema);

        for (var i = 0, len = keys.length; i < len; i++) {
            var name = keys[i];
            var val = data[name];

            var type = opt.schema.schema[name].type;
            var typeStr = type.toString();

            var path = opt.propPath ? opt.propPath + '.' + name : name;

            //skip validation of internal properties
            if (   opt.skipInternalProperties === true
                && internalProps[name]
                && internalProps[name] === opt.schema.schema[name]
            ) {
                continue;
            }


            var emptyCandidate = inspectEmptyValue(path, val, opt.schema.schema[name]);

            if (_.isNil(emptyCandidate)) {
                continue;
            };
            val = emptyCandidate;

            //sanitize data value
            data[name] = sanitizers[typeStr].apply(sanitizers, [
                    val,
                    _.assign({}, opt, {
                        propPath: path,
                        schema: opt.schema.schema[name]
                    })
            ]);
        }

        //exclude unexpected data
        if (opt.includeUnlisted !== true) {
            var forbiddenKeys = _.difference(Object.keys(data), keys);
            for (var y = 0, len2 = forbiddenKeys.length; y < len2; y++) {
                delete data[forbiddenKeys[y]];
            }
        }

        //sanitizer should always mutate existing data object, instead of returning
        //a new one with valid data only.
        //it's because we want to preserve setters/getter which are setup on the
        //original data object
        return data;
    }

    return data;

}

/**
 * inspectEmptyValue
 *
 * @param {sting}   property - full path of property being sanitized
 * @param {mixed}   val
 * @param {Object}  schema
 * @param {boolean} [schema.allowEmptyValue]
 *
 * @throws {ValidationError} if property can not be `null` or `undefined` (=allowEmptyValue=false)
 * @return {mixed}
 */
function inspectEmptyValue(property, val, schema) {

    if ((!schema || schema.allowEmptyValue !== true) && _.isNil(val)) {
        throw new ValidationError((property || 'Object value') + " value can NOT be empty (undefined or null)");
    }

    return val;
}

/**
 * sanitizeData
 *
 * recursive validates data against defined schema &
 * attempts to convert the data to defined type & sets default values
 *
 * @param {Object}         [schema]
 * @param {integer}        [schema.type]
 * @param {array}          [schema.enum]
 * @param {mixed}          [schema.default]
 * @param {Object}         [schema.schema]
 * @param {boolean}        [schema.allowEmptyValue=false]
 * @param {Object}         data
 * @param {Object}         [options]
 * @param {boolean}        [options.includeUnlisted=false]
 * @param {boolean}        [options.skipInternalProperties=true]
 * @param {boolean|Object} [options.associations=false]
 * @param {Boolean}        [options.associations.embedded] if true, object's associations of `EMBEDDED` type are recursively sanitized
 * @param {Boolean}        [options.associations.reference] if true, object's associations of `REFERENCE` type are recursively sanitized
 *
 * @this {Model}
 * @throws {ValidationError}
 * @exports Sanitizer:sanitizeData
 * @return {Object}
 */
function sanitize(schema, data, options) {

    var defaults = {
        includeUnlisted: false,
        skipInternalProperties: true,
        associations: false
    };

    options = _.assign(defaults, options);

    var emptyCandidate = data;
    if (schema.type !== DataTypes.HASH_TABLE) {
        emptyCandidate = inspectEmptyValue(this.name + ' data', data, schema);
        if (_.isNil(emptyCandidate)) {
            return data;
        }
    }

    //sanitize data value
    return sanitizers[schema.type.toString()].apply(sanitizers, [
            data,
            _.assign({}, options, {
                propPath: '',
                schema: schema,
                model: this
            })
    ]);
}
