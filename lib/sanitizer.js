var debug           = require('debug')('couchbase-sdk:sanitizer');
var _               = require('lodash');
var DataType        = require("./dataType");
var DataTypes       = DataType.types;
var ValidationError = require("./error/validationError.js");
var moment          = require('moment');
var Instance        = require("./instance.js");

var sanitizers = {};

/**
 * @module Sanitizer
 * @private
 */

module.exports.sanitizeData = sanitizeData;
module.exports.sanitizeSchema = sanitizeSchema;
module.exports.addTimestampProperties = addTimestampProperties;
module.exports.addInternalDocProperties = addInternalDocProperties;
module.exports.sanitizers = sanitizers;
module.exports.Report = Report;

/**
 * @param {sting} property - full path of property being sanitized
 * @param {mixed} val
 * @function
 * @return {integer|float}
 */
sanitizers[DataTypes.NUMBER] = sanitizers[DataTypes.FLOAT] = function(property, val) {

    if (typeof val === 'number') {
        return val;
    }

    var containsNonDigit = /[^0-9.]$/.exec(val.toString()) !== null;
    val = Number.parseFloat(val);

    if (Number.isNaN(val) || containsNonDigit) {
        throw new ValidationError((property || 'Object data') + " value is not of type integer or float");
    }
    return val;
}

/**
 * @param {sting} property - full path of property being sanitized
 * @param {mixed} val
 * @function
 * @return {integer}
 */
sanitizers[DataTypes.INT] = function(property, val) {

    var containsNonDigit = /[^0-9]/.exec(val.toString()) !== null;
    val = (typeof val !== 'number' && Number.parseInt(val) ) || val;

    if (Number.isNaN(val) || Math.floor(val) !== val || containsNonDigit) {
        throw new ValidationError((property || 'Object data') + " value is not an integer number");
    }
    return val;
}

/**
 * @param {sting} property - full path of property being sanitized
 * @param {mixed} val
 * @function
 * @return {string}
 */
sanitizers[DataTypes.STRING] = function(property, val) {

    if (!_.isString(val)) {
        throw new ValidationError((property || 'Object data') + " value is not of type `string`");
    }
    return val.toString();
}

/**
 * @param {sting} property - full path of property being sanitized
 * @param {mixed} val
 * @function
 * @return {boolean|integer}
 */
sanitizers[DataTypes.BOOLEAN] = function(property, val) {
    var err = new ValidationError((property || 'Object data') + " value is not of type Boolean");

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
 * @param {sting} property - full path of property being sanitized
 * @param {mixed} val
 * @function
 * @return {Date}
 */
sanitizers[DataTypes.DATE] = function(property, val) {

    var err = new ValidationError((property || 'Object data') + " value is not valid date/date-time value");

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
 * @param {sting}   property - full path of property being sanitized
 * @param {mixed}   val
 * @param {Object}  [schema]
 * @param {integer} [schema.type]
 * @param {array}   [schema.enum]
 * @param {mixed}   [schema.default]
 * @param {boolean} [schema.allowEmptyValue]
 *
 * @function
 * @return {mixed} `val`
 */
sanitizers[DataTypes.ENUM] = function(property, val, schema) {

    if (schema.enum.indexOf(val) == -1) {
        throw new ValidationError((property || 'Object data') + " value is not a value of enumerated type");
    }

    return val;
}

/**
 * @param {sting}   property - full path of property being sanitized
 * @param {mixed}   val
 * @param {Object}  [schema]
 * @param {integer} [schema.type]
 * @param {array}   [schema.enum]
 * @param {mixed}   [schema.default]
 * @param {boolean} [schema.allowEmptyValue]
 * @param {ModelManager} $modelManager
 *
 * @function
 * @return {mixed}
 */
sanitizers[DataType.Complex.toString()] = function(property, val, schema, $modelManager) {

    var refModel = schema.type.getModel($modelManager);

    //TODO it might allow value of plain object which has _id property with key string ??
    if (!(val instanceof refModel.Instance)) {
        throw new ValidationError((property || 'Object data') + " value is not instance of `" + refModel.name + '`');
    }

    return val;
}

/**
 * @param {sting}   property - full path of property being sanitized
 * @param {mixed}   val
 * @param {Object}  [schema]
 * @param {integer} [schema.type]
 * @param {array}   [schema.enum]
 * @param {mixed}   [schema.default]
 * @param {boolean} [schema.allowEmptyValue]
 * @param {ModelManager} $modelManager
 *
 * @function
 * @return {array}
 */
sanitizers[DataTypes.ARRAY] = function(property, val, schema, $modelManager) {

    if (_.isPlainObject(schema.schema) && schema.schema.type) {
        var type = schema.schema.type;

        if (!(val instanceof Array)) {
            throw new ValidationError((property || 'Object data')+ " value is not of type Array");
        }

        for (var y = 0, len = val.length; y < len; y++) {
            val[y] = this[type](property, val[y], schema.schema, $modelManager);
        }
    }

    return val;

}

/**
 *
 * recursive validates data against defined schema &
 * attempts to convert the data to defined type & sets default values
 *
 * @param {sting}   propPath - full path of property being sanitized
 * @param {mixed}   data
 * @param {Object}  [schema]
 * @param {integer} [schema.type]
 * @param {array}   [schema.enum]
 * @param {mixed}   [schema.default]
 * @param {boolean} [schema.allowEmptyValue]
 * @param {ModelManager} $modelManager
 * @param {boolean} includeUnlisted
 *
 * @function
 * @return {Object}
 */
sanitizers[DataTypes.HASH_TABLE] = function(propPath, data, schema, $modelManager, includeUnlisted) {

    var err = new ValidationError((propPath || 'Object data') + " value is not of type Object (Hash table)");

    data = inspectEmptyValue(this.name + ' data', data, schema);

    if (_.isNil(data)) {
        return data;
    } else if (!_.isPlainObject(data)) {
        throw err;
    }

    if (_.isPlainObject(schema.schema)) {
        var keys = Object.keys(schema.schema);

        for (var i = 0, len = keys.length; i < len; i++) {
            var name = keys[i];
            var val = data[name];

            var type = schema.schema[name].type;
            var typeStr = type.toString();

            var path = propPath ? propPath + '.' + name : name;
            var emptyCandidate = inspectEmptyValue(path, val, schema.schema[name]);

            if (_.isNil(emptyCandidate)) {
                continue;
            };
            val = emptyCandidate;

            //sanitize data value
            data[name] = sanitizers[typeStr].apply(sanitizers, [
                    path,
                    val,
                    schema.schema[name],
                    $modelManager,
                    includeUnlisted
            ]);
        }

        //exclude unexpected data
        if (includeUnlisted === false) {
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
 * @throws {ValidationError} if property can not be `null` or `undefined` (=allowEmptyValue=false)
 * @param {sting}   property - full path of property being sanitized
 * @param {mixed}   val
 * @param {Object}  [schema]
 * @param {integer} [schema.type]
 * @param {array}   [schema.enum]
 * @param {mixed}   [schema.default]
 * @param {boolean} [schema.allowEmptyValue]
 *
 * @return {mixed}  returns `default` or {null} value if property is nullable and has empty value, or {false} if value is not empty
 */
function inspectEmptyValue(property, val, schema) {
    if (_.isNil(val) && schema.hasOwnProperty('default')) {
        if (_.isPlainObject(schema.default)) {
            val = _.cloneDeep(schema.default);
        } else if (schema.default instanceof Instance) {
            val = schema.default.clone();
        } else {
            val = schema.default;
        }
    }

    if (schema.allowEmptyValue !== true && _.isNil(val)) {
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
 * @param {Object}  [schema]
 * @param {integer} [schema.type]
 * @param {array}   [schema.enum]
 * @param {mixed}   [schema.default]
 * @param {Object}  [schema.schema]
 * @param {boolean} [schema.allowEmptyValue=false]
 * @param {Object}  data
 * @param {Object}  [options]
 * @param {boolean} [options.includeUnlisted=false]
 *
 * @throws {ValidationError}
 * @exports Sanitizer:sanitizeData
 * @return {Object}
 */
function sanitizeData(schema, data, options) {

    var defaults = {
        includeUnlisted: false
    };

    options = _.merge({}, defaults, options);

    var emptyCandidate = data;
    if (schema.type !== DataTypes.HASH_TABLE) {
        emptyCandidate = inspectEmptyValue(this.name + ' data', data, schema);
        if (_.isNil(emptyCandidate)) {
            return data;
        }
    }

    //sanitize data value
    return sanitizers[schema.type.toString()].apply(sanitizers, [
            '',
            data,
            schema,
            this.$modelManager,
            options.includeUnlisted
    ]);
}


/**
 * sanitizeSchema
 *
 * validates schema definition of a Model
 *
 * @param {Object} schema
 * @throws {ValidationError}
 * @exports Sanitizer:sanitizeSchema
 *
 * @private
 * @return {Report}
 */
function sanitizeSchema(schema) {

    if (!_.isPlainObject(schema)) {
        throw new ValidationError("Model`s schema definition must be an object (hash table)");
    }

    var report = new Report();
    validate(schema, null);
    return report;

    function validate(schema, propertyPath) {

        //type can be of type `string` or instance of `Complex`
        var type = schema.type;

        if (type && type.toString() === DataType.Complex.toString()) {
            report.addRelation(type, propertyPath);
        }

        if (type === DataTypes.ENUM && !(schema.enum instanceof Array)) {
            throw new ValidationError("`ENUM` data type requires the `schema.enum` property to be an Array");
        }

        //sanitize & validate `default` property value
        if (!_.isNil(schema.default)) {
            schema.default = sanitizers[type.toString()].apply(sanitizers, [propertyPath + ".default", schema.default, schema]);
        }

        if (!DataType.exists(type)) {
            throw new ValidationError("Unsupported data type: " + type + " is set for " + ( propertyPath || '`data` object'));
        }

        //ensure that `schema` definition is of type object
        if (   [DataTypes.ARRAY, DataTypes.HASH_TABLE].indexOf(type) > -1
            && schema.hasOwnProperty('schema')
            && !_.isPlainObject(schema.schema)
        ) {
            throw new ValidationError("`schema` definition for " + (propertyPath || '`data` object') + "must be a hash table (object)");
        }

        //ensure valid item type of array is set
        if (   type === DataTypes.ARRAY
            && schema.hasOwnProperty('schema')
            && schema.schema.hasOwnProperty('type')
        ) {
            if (!DataType.exists(schema.schema.type)) {
                throw new ValidationError("Unsupported array item data type: " + schema.schema.type + " is set for " + (propertyPath || '`data` object'));
            }

            if(schema.schema.type.toString() === DataType.Complex.toString()){
                report.addRelation(schema.schema.type, propertyPath);
            }
        }

        //recursively validate
        if(type === DataTypes.HASH_TABLE && _.isPlainObject(schema.schema)) {

            Object.keys(schema.schema).forEach(function(propertyName, index) {
                var propertyOptions = schema.schema[propertyName];
                var path = propertyPath ? propertyPath + "." + propertyName: propertyName;
                return validate(propertyOptions, path);
            });
        }
    }
}

/**
 * addTimestampProperties
 *
 * adds timestamp properties to model's schema definition
 *
 * @private
 * @return {undefined}
 */
function addTimestampProperties() {
    var schema = this.options.schema.schema;
    var paranoid = this.options.paranoid;

    if (!_.isPlainObject(schema)) {
        schema = {};
        this.options.schema.schema = schema;
        this.options.schemaSettings.doc.hasInternalPropsOnly = true;
    }

    var timestampPropNames = this.$getTimestampPropertyNames();

    schema[timestampPropNames.createdAt] = {
        type: DataTypes.DATE
    };

    schema[timestampPropNames.updatedAt] = {
        type: DataTypes.DATE
    };

    if (paranoid === true) {
        schema[timestampPropNames.deletedAt] = {
            type: DataTypes.DATE,
            allowEmptyValue: true
        };
    }
}

/**
 * addInternalDocProperties
 *
 * adds internal properties (like `_id`, `_type`) to model's schema definition
 *
 * @private
 * @return {undefined}
 */
function addInternalDocProperties() {
    var schema = this.options.schema.schema;

    if (!_.isPlainObject(schema)) {
        schema = {};
        this.options.schema.schema = schema;
        this.options.schemaSettings.doc.hasInternalPropsOnly = true;
    }

    var idPropName = this.options.schemaSettings.doc.idPropertyName;
    var typePropName = this.options.schemaSettings.doc.typePropertyName;
    var keyType = this.options.key.dataType;

    schema[idPropName] = {
        type: keyType,
        allowEmptyValue: true
    };

    schema[typePropName] = {
        type: DataTypes.STRING
    };
}

/**
 * Report
 *
 * @constructor
 * @private
 */
function Report() {
    this.relations = [];
    this.data = null;
}

/**
 * addRelation
 *
 * @param {Complex} type
 * @param {string}  path - full path to `property` of the `data` object which points to a
 *                              relation
 * @return {undefined}
 */
Report.prototype.addRelation = function(type, path) {
    this.relations.push({
        path : path,
        type : type
    });
}

/**
 * getRelations
 *
 * @return {Object} - hash table
 */
Report.prototype.getRelations = function() {
    return this.relations;
}
