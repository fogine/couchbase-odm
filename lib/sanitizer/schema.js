/**
 * @module Schema Sanitizer
 * @private
 */

var _ = require('lodash');

var DataType        = require("../dataType");
var ValidationError = require("../error/validationError.js");
var sanitizers      = require('./data.js').sanitizers;
var Report          = require('./report.js');

var DataTypes = DataType.types;

/**
 * sanitize
 *
 * validates & sanitizes schema definition of a Model
 *
 * @param {Object} schema
 * @param {ModelManager} modelManager
 *
 * @throws {ValidationError}
 * @exports Sanitizer:sanitizeSchema
 *
 * @private
 * @return {Report}
 */
module.exports.sanitize = function sanitizeSchema(schema, modelManager) {

    if (!_.isPlainObject(schema)) {
        throw new ValidationError("Model`s schema definition must be an object (hash table)");
    }

    var report = new Report();
    sanitize(schema, report, modelManager, null);
    return report;
}

/**
 * sanitize
 *
 * validates & sanitizes schema definition of a Model
 *
 * @param {Object} schema
 * @param {Report} report
 * @param {ModelManager} modelManager
 *
 * @throws {ValidationError}
 *
 * @private
 */
function sanitize(schema, report, modelManager, propertyPath) {

    validatePropertyType(schema.type, report, propertyPath);

    validateSchemaEnumProperty(schema, propertyPath);

    sanitizeDefaultPropertyValue(schema, modelManager, propertyPath);

    validatePropertySchemaValue(schema, propertyPath);

    //In case of the ARRAY type, ensure valid type of array's item is set
    if (   schema.type === DataTypes.ARRAY
        && schema.hasOwnProperty('schema')
        && schema.schema.hasOwnProperty('type')
    ) {
        validatePropertyType(schema.schema.type, report, propertyPath);
    }

    //recursively sanitize
    if(schema.type === DataTypes.HASH_TABLE && _.isPlainObject(schema.schema)) {

        Object.keys(schema.schema).forEach(function(propertyName, index) {
            var propertyOptions = schema.schema[propertyName];
            var path = propertyPath ? propertyPath + "." + propertyName: propertyName;
            return sanitize(propertyOptions, report, modelManager, path);
        });
    }
}

/**
 * validatePropertyType
 *
 * @param {Object} schema
 * @param {Report} report
 * @param {String|null} propertyPath
 *
 * @throws {ValidationError}
 *
 * @private
 */
function validatePropertyType(type, report, propertyPath) {
    //type can be of type `string` or instance of `Complex`
    if (!DataType.exists(type)) {
        throw new ValidationError("Unsupported data type: " + type + " is set for " + ( propertyPath || '`data` object'));
    }

    if (type && type.toString() === DataType.Complex.toString()) {
        report.addRelation(type, propertyPath);
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
 * @param {ModelManager} modelManager
 * @param {String|null} propertyPath
 *
 * @throws {ValidationError}
 *
 * @private
 */
function sanitizeDefaultPropertyValue(schema, modelManager, propertyPath) {

    if (!_.isNil(schema.default)) {
        schema.default = sanitizers[schema.type.toString()].apply(sanitizers, [
                propertyPath + ".default",
                schema.default,
                schema,
                //TODO not every method accepts modelManager argument
                //sanitizer methods` argument format needs to be redesigned
                modelManager
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
    //ensure that the `schema` value is of type object
    //eg.:
    //{
    //   type: DataTypes.OBJECT,
    //   schema: {} // <== validate this
    //}
    if (   [DataTypes.ARRAY, DataTypes.HASH_TABLE].indexOf(schema.type) > -1
        && schema.hasOwnProperty('schema')
        && !_.isPlainObject(schema.schema)
    ) {
        throw new ValidationError("`schema` definition for " + (propertyPath || '`data` object') + "must be an object (hash table)");
    }
}
