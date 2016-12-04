/**
 * @module Schema Sanitizer
 * @private
 */

var _ = require('lodash');

var DataType        = require("../dataType");
var ValidationError = require("../error/validationError.js");
var sanitizers      = require('./data.js').sanitizers;
var schemaUtils     = require('../util/schema.js');
var dataUtils       = require('../util/data.js');

var DataTypes = DataType.types;

/**
 * sanitize
 *
 * validates & sanitizes schema definition of a Model
 *
 * @param {Object} schema
 *
 * @throws {ValidationError}
 * @exports Sanitizer:sanitizeSchema
 *
 * @private
 * @this {Model}
 */
module.exports.sanitize = function sanitizeSchema(schema) {

    if (!_.isPlainObject(schema)) {
        throw new ValidationError("Model`s schema definition must be an object (hash table)");
    }

    sanitize(schema, this, null);
}

/**
 * sanitize
 *
 * validates & sanitizes schema definition of a Model
 *
 * @param {Object} schema
 * @param {Model} model
 *
 * @throws {ValidationError}
 *
 * @private
 */
function sanitize(schema, model, propertyPath) {

    validatePropertyType(schema.type, propertyPath);

    validateSchemaEnumProperty(schema, propertyPath);

    sanitizeDefaultPropertyValue(schema, model, propertyPath);

    validatePropertySchemaValue(schema, propertyPath);

    //In case of the ARRAY type, ensure valid type of array's item is set
    if (   schema.type === DataTypes.ARRAY
        && schema.hasOwnProperty('schema')
        && schema.schema.hasOwnProperty('type')
    ) {
        validatePropertyType(schema.schema.type, propertyPath);
    }

    //recursively sanitize
    if (_.isPlainObject(schema.schema)) {
        if(schema.type === DataTypes.HASH_TABLE) {

            Object.keys(schema.schema).forEach(function(propertyName, index) {
                var propertyOptions = schema.schema[propertyName];
                var path = propertyPath ? propertyPath + "." + propertyName: propertyName;
                return sanitize(propertyOptions, model, path);
            });
        } else if(schema.type === DataTypes.ARRAY) {
            return sanitize(schema.schema, model, propertyPath);
        }
    }
}

/**
 * validatePropertyType
 *
 * @param {Object} schema
 * @param {String|null} propertyPath
 *
 * @throws {ValidationError}
 *
 * @private
 */
function validatePropertyType(type, propertyPath) {
    //type can be of type `string` or instance of `Complex`
    if (!DataType.exists(type)) {
        throw new ValidationError("Unsupported data type: " + type + " is set for " + ( propertyPath || '`data` object'));
    }
}

/**
 * validateSchemaEnumProperty
 *
 * @param {Object} schema
 * @param {String|null} propertyPath
 *
 * @throws {ValidationError}
 *
 * @private
 */
function validateSchemaEnumProperty(schema, propertyPath) {
    if (schema.type === DataTypes.ENUM && !(schema.enum instanceof Array)) {
        throw new ValidationError("`ENUM` data type requires the `schema.enum` property to be an Array");
    }
}

/**
 * sanitizeDefaultPropertyValue
 *
 * @param {Object} schema
 * @param {Model} model
 * @param {String|null} propertyPath
 *
 * @throws {ValidationError}
 *
 * @private
 */
function sanitizeDefaultPropertyValue(schema, model, propertyPath) {

    if (!_.isNil(schema.default)) {
        if (_.isPlainObject(schema.schema)) {
            if (   schema.type === DataTypes.HASH_TABLE
                && _.isPlainObject(schema.default)
            ) {
                schema.default = schemaUtils.extractDefaults(schema);
            } else if(   schema.type === DataTypes.ARRAY
                      && Array.isArray(schema.default)
            ) {
                schema.default = dataUtils.applyDefaults(
                        schemaUtils.extractDefaults(schema),
                        schema.default
                );
            }
        }

        schema.default = sanitizers[schema.type.toString()].apply(sanitizers, [
                schema.default,
                {
                    propPath: propertyPath + ".default",
                    schema: schema,
                    model: model,
                    skipInternalProperties: true
                }
        ]);
    }
}

/**
 * validatePropertySchemaValue
 *
 * @param {Object} schema
 * @param {String|null} propertyPath
 *
 * @throws {ValidationError}
 *
 * @private
 */
function validatePropertySchemaValue(schema, propertyPath) {
    if ( DataTypes.HASH_TABLE == schema.type) {
        if (   !schema.hasOwnProperty('schema')
            || !_.isPlainObject(schema.schema)
            || !Object.keys(schema.schema).length
        ) {
            Object.defineProperty(schema, '$hasInternalPropsOnly', {
                enumerable: false,
                configurable: true,
                value: true
            });
        }
    }
    //ensure that the `schema` value is of type object
    //eg.:
    //{
    //   type: DataTypes.HASH_TABLE,
    //   schema: {} // <== validate this
    //}
    if (   [DataTypes.ARRAY, DataTypes.HASH_TABLE].indexOf(schema.type) > -1
        && schema.hasOwnProperty('schema')
        && !_.isPlainObject(schema.schema)
    ) {
        throw new ValidationError("`schema` definition for " + (propertyPath || '`data` object') + "must be an object (hash table)");
    }
}
