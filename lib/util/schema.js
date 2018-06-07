const _         = require('lodash');

const DataType  = require("../dataType");
const dataUtils = require("./data.js");

const DataTypes = DataType.types;


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
 * recursive function
 * returns data object with default data structure
 * should be compatible with "default" keyword implementation of Ajv@v6
 * basically properties defined inside properties schema can define
 * default value:
 * {
 *   type: 'object'
 *   properties: {
 *     prop: {type: 'string', default: 'value'}
 *    }
 * }
 *
 * additionally array `items` schema THAT IS AN ARRAY can also define specific
 * collection item defaults:
 * {
 *   type: 'array'
 *   items: [
 *     {
 *       type: 'string',
 *       default: 'value'
 *     }
 *   ]
 * }
 *
 * @param {Object} schema
 * @param {Object} [data] - private, used internaly
 * @param {Array<String>} [path] - private, used internaly
 * @param {Boolean} [skipDefaults=true] - private, used internaly
 *
 * @private
 *
 * @return {Object} - data
 */
function extractDefaults(schema, data, path, skipDefaults) {
    data || (data = {
        defaults: undefined,
        defaultsRootValue: undefined
    });
    path || (path = []);

    if (typeof skipDefaults !== 'boolean') {
        skipDefaults = true;
    }

    if (!_.isPlainObject(schema)) {
        throw new Error('Expected `schema` to be an object got: ' + schema);
    }

    // extract default data values
    if (path !== undefined && schema.default !== undefined && !skipDefaults) {
        if (!path.length) {
            data.defaults = dataUtils.cloneDefaults(schema.default);
        } else {
            setDefaultValue(path, dataUtils.cloneDefaults(schema.default));
        }
    }

    //iterate recursively
    if (schema.type === 'object' && _.isPlainObject(schema.properties)) {
        if (data.defaults === undefined) {
            data.defaultsRootValue = {};
        }

        Object.keys(schema.properties).forEach(function(propertyName, index) {
            let propertyOptions = schema.properties[propertyName];
            let propPath = [].concat(path);
            propPath.push(propertyName)
            return extractDefaults(propertyOptions, data, propPath, false);
        });
    } else if(schema.type === 'array') {

        if (data.defaults === undefined) {
            data.defaultsRootValue = [];
        }

        if(schema.items instanceof Array) {
            schema.items.forEach(function(subSchema, index) {
                let propPath = [].concat(path);
                propPath.push(index);
                return extractDefaults(subSchema, data, propPath, false);
            });
        } else if(_.isPlainObject(schema.items)) {
            let arrayItemDefaults = extractDefaults(schema.items);

            if (arrayItemDefaults) {

                Object.defineProperty(
                    arrayItemDefaults,
                    '_requiresMergeTarget',
                    {
                        value: true,
                        writable: false,
                        enumerable: false
                    }
                );

                let propPath = [].concat(path);
                propPath.push('itemDefaults');
                setDefaultValue(propPath, arrayItemDefaults);
            }
        }
    }

    return data.defaults;

    function setDefaultValue(path, value) {
        if (!_.has(data.defaults, path)) {
            if (data.defaults === undefined) {
                data.defaults = data.defaultsRootValue;
            }

            _.setWith(data.defaults, path, value, function(parent, key, root) {
                if (   parent === undefined
                    && (_.isPlainObject(root)
                    || root instanceof Array)
                ) {
                    /*
                     * this covers the following schema scenario:
                     * {
                     *   type: array,
                     *   items: [{
                     *     type: 'object',
                     *     properties: {
                     *       name: {
                     *         type: 'string',
                     *         default: 'value'
                     *       }
                     *     }
                     *   }]
                     *
                     * where the first item of the array schema does not have any
                     * default value set so we SHOULD NOT create it by default.
                     * However the object schema of the first array item has
                     * defined default value for the "name" property - thus
                     * if we are given an array with empty object at the appropriate
                     * index we should ensure default values are applied  to the object
                     */
                    return Object.create(Object.prototype, {
                        _requiresMergeTarget: {
                            writable: false,
                            enumerable: false,
                            value: true
                        }
                    });
                }
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
