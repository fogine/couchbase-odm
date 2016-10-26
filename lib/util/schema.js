var _               = require('lodash');
var DataType        = require("../dataType");
var DataTypes       = DataType.types;

module.exports.addTimestampProperties = addTimestampProperties;
module.exports.addInternalDocProperties = addInternalDocProperties;

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
