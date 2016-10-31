var _         = require('lodash');
var DataType  = require("../dataType");
var DataTypes = DataType.types;

module.exports.addTimestampProperties = addTimestampProperties;
module.exports.addInternalDocProperties = addInternalDocProperties;
module.exports.extractData = extractData;


/**
 * extractData
 *
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
function extractData(schema, data, path) {
    data || (data = {
        defaults: undefined,
        relations: []
    });

    path || (path = null);

    if (!_.isPlainObject(schema)) {
        throw new Error('Expected `schema` to be an object got: ' + schema);
    }

    // extract default data values
    if (path !== undefined && schema.default !== undefined) {
        if (path === null) {
            data.defaults = schema.default;
        } else {
            if (!_.has(data.defaults, path)) {
                data.defaults || (data.defaults = {});
                _.set(data.defaults, path, schema.default);
            }
        }
    }

    //extract model associations
    if (schema.type) {
        if (schema.type.toString() === DataType.Complex.toString()) {
            data.relations.push({
                path : path,
                type : schema.type
            });
        } else if (schema.type === DataTypes.ARRAY
            && schema.hasOwnProperty('schema')
            && schema.schema.hasOwnProperty('type')
        ) {
            data.relations.push({
                path : path,
                type : schema.schema.type
            });
        }
    }


    //iterate recursively
    if(schema.type === DataTypes.HASH_TABLE && _.isPlainObject(schema.schema)) {

        Object.keys(schema.schema).forEach(function(propertyName, index) {
            var propertyOptions = schema.schema[propertyName];
            var propPath = path ? path + "." + propertyName: propertyName;
            return extractData(propertyOptions, data, propPath);
        });
    }

    return data;
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
 * @this {Model}
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
