var _         = require('lodash');

var DataType  = require("../dataType");
var dataUtils = require("./data.js");

var DataTypes = DataType.types;


module.exports.addTimestampProperties = addTimestampProperties;
module.exports.addInternalDocProperties = addInternalDocProperties;
module.exports.extractDefaults = extractDefaults;
module.exports.extractAssociations = extractAssociations;

/**
 * extractAssociations
 *
 * recursive function
 *
 * @param {Object} schema
 * @param {Object} [data]
 * @param {String} [path]
 *
 * @private
 *
 * @return {Array} - associations
 */
function extractAssociations(schema, data, path) {
    data || (data = []);
    path || (path = null);

    if (!_.isPlainObject(schema)) {
        throw new Error('Expected `schema` to be an object got: ' + schema);
    }

    //extract model associations
    if (schema.type) {
        if (schema.type.toString() === DataType.Complex.toString()) {
            data.push({
                path : path,
                type : schema.type
            });
        } else if (schema.type === DataTypes.ARRAY
            && schema.hasOwnProperty('schema')
            && schema.schema.hasOwnProperty('type')
            && schema.schema.type.toString() === DataType.Complex.toString()
        ) {
            data.push({
                path : path,
                type : schema.schema.type
            });
        }
    }

    //iterate recursively
    if(schema.type === DataTypes.HASH_TABLE && _.isPlainObject(schema.schema)) {

        Object.keys(schema.schema).forEach(function(propertyName, index) {
            var subSchema = schema.schema[propertyName];
            var propPath = path ? path + "." + propertyName: propertyName;
            return extractAssociations(subSchema, data, propPath);
        });
    }

    return data;
}


/**
 * extractDefaults
 *
 * recursive function
 * returns data object with default data structure and a collection of model's
 * associations
 *
 * @param {Object} schema
 * @param {Object} [data]
 * @param {String} [path]
 *
 * @private
 *
 * @return {Object} - data
 */
function extractDefaults(schema, data, path) {
    data || (data = {
        defaults: undefined,
        defaultsRootValue: undefined
    });
    path || (path = null);

    if (!_.isPlainObject(schema)) {
        throw new Error('Expected `schema` to be an object got: ' + schema);
    }

    // extract default data values
    if (path !== undefined && schema.default !== undefined) {
        if (path === null) {
            data.defaults = dataUtils.cloneDefaults(schema.default);
        } else {
            setDefaultValue(path, dataUtils.cloneDefaults(schema.default));
        }
    }

    //iterate recursively
    if(_.isPlainObject(schema.schema)) {

        if (schema.type === DataTypes.HASH_TABLE) {
            if (data.defaults === undefined) {
                data.defaultsRootValue = {};
            }

            Object.keys(schema.schema).forEach(function(propertyName, index) {
                var propertyOptions = schema.schema[propertyName];
                var propPath = path ? path + "." + propertyName: propertyName;
                return extractDefaults(propertyOptions, data, propPath);
            });
        } else if(schema.type === DataTypes.ARRAY) {

            var defaultArrayValue = [];
            /*
             * this signalizes that an user actually didn't set default array value
             * to empty array. However we need to explicitly set it because
             * the user might set default array's ITEM value
             * which in that case is going to be binded to the array object
             */
            defaultArrayValue.bindedByForce = true;

            if (data.defaults === undefined) {
                data.defaultsRootValue = defaultArrayValue;
            }

            var arrayItemDefaults = extractDefaults(schema.schema);
            var propPath = path ? path + ".itemDefaults": 'itemDefaults';

            if (path) {
                setDefaultValue(path, defaultArrayValue);
            }
            setDefaultValue(propPath, arrayItemDefaults);
        }
    }

    return data.defaults;

    function setDefaultValue(path, value) {
        if (!_.has(data.defaults, path)) {
            if (data.defaults === undefined) {
                data.defaults = data.defaultsRootValue;
            }
            _.set(data.defaults, path, value);
        }
    }
}

/**
 * addTimestampProperties
 *
 * adds timestamp properties to model's schema definition
 *
 * @private
 * @this {Model}
 * @return {undefined}
 */
function addTimestampProperties() {
    var schema = this.options.schema.schema;
    var paranoid = this.options.paranoid;

    if (!_.isPlainObject(schema)) {
        schema = {};
        this.options.schema.schema = schema;
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
 * @this {Model}
 * @return {undefined}
 */
function addInternalDocProperties() {
    var schema = this.options.schema.schema;

    if (!_.isPlainObject(schema)) {
        schema = {};
        this.options.schema.schema = schema;
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
