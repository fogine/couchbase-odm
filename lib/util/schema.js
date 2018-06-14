const _         = require('lodash');
const dataUtils = require("./data.js");

module.exports.addTimestampProperties = addTimestampProperties;
module.exports.addInternalDocProperties = addInternalDocProperties;
module.exports.extractDefaults = extractDefaults;
module.exports.extractAssociations = extractAssociations;

/**
 * recursive function
 * associations are defined with `$relation` keyword:
 *
 * {
 *   user: {
 *     $relation: {type: 'User' method: 'reference'}
 *   }
 * }
 *
 * @param {Object} schema
 * @param {Object} [data] - used internaly be recursion
 * @param {String} [path] - used internaly be recursion
 *
 * @private
 *
 * @return {Array<Object>} - collection of associations where each object has path[], type, method properties
 */
function extractAssociations(schema, data, path) {
    data || (data = []);
    path || (path = []);

    if (!_.isPlainObject(schema)) {
        throw new Error('Expected `schema` to be an object got: ' + schema);
    }

    //extract model associations
    if (_.isPlainObject(schema.$relation)) {
        data.push({
            path   : path,
            type   : schema.$relation.type,
            method : schema.$relation.method
        });
    } else if (schema.type === 'array') {
        if (_.isPlainObject(schema.items)
            && _.isPlainObject(schema.items.$relation)
        ) {
            data.push({
                path   : path,
                type   : schema.items.$relation.type,
                method : schema.items.$relation.method
            });
        } else if (schema.items instanceof Array) {
            for (let i = 0, len = schema.items.length; i < len; i++) {
                let subPath = [].concat(path);
                subPath.push(i);
                extractAssociations(schema.items[i], data, subPath);
            }
        }
    }

    //iterate recursively
    if(schema.type === 'object' && _.isPlainObject(schema.properties)) {

        Object.keys(schema.properties).forEach(function(propertyName, index) {
            const subSchema = schema.properties[propertyName];
            const propPath = [].concat(path);
            propPath.push(propertyName);
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
 * @param {Array} [data] - private, used internaly
 * @param {Boolean} [skipDefaults=true] - private, used internaly
 * @param {Array<String|Array>} [path] - private, used internaly
 *
 * @private
 *
 * @return {Array} - data
 */
function extractDefaults(schema, data, parentData, skipDefaults, path) {
    data = data || [];

    if (!_.isPlainObject(schema)) {
        throw new Error('Expected `schema` to be an object got: ' + schema);
    }

    if (typeof skipDefaults !== 'boolean') {
        skipDefaults = true;
    }

    const def = {
        path: path,
        defaults: []
    };

    // extract default data values
    if (path !== undefined && schema.default !== undefined && !skipDefaults) {
        def.default = dataUtils.cloneDefaults(schema.default);
        data.push(def);
    }

    //iterate recursively
    if (schema.type === 'object' && _.isPlainObject(schema.properties)) {
        Object.keys(schema.properties).forEach(function(propertyName) {
            return extractDefaults(
                schema.properties[propertyName],
                parentData ? def.defaults : data,
                data,
                false,
                propertyName
            );
        });
    } else if(schema.type === 'array') {

        if(schema.items instanceof Array) {
            schema.items.forEach(function(subSchema, index) {
                return extractDefaults(
                    subSchema,
                    parentData ? def.defaults : data,
                    data,
                    false,
                    index
                );
            });
        } else if(_.isPlainObject(schema.items)) {
            def.path = [def.path];
            let _defaults = extractDefaults(
                schema.items,
                def.defaults
            );
        }
    }

    if (!data.includes(def) && def.defaults.length) {
        data.push(def);
    }

    return data;
}

/**
 * adds timestamp properties to model's schema definition
 *
 * @private
 * @this {Model}
 * @return {undefined}
 */
function addTimestampProperties() {
    let schema = this.options.schema.properties;
    let required = this.options.schema.required;
    let paranoid = this.options.paranoid;

    if (!_.isPlainObject(schema)) {
        schema = {};
        this.options.schema.properties = schema;
    }

    if (!(required instanceof Array)) {
        required = [];
        this.options.schema.required = [];
    }

    let timestampPropNames = this.$getTimestampPropertyNames();

    schema[timestampPropNames.createdAt] = {
        type: 'string',
        format: 'date-time'
    };

    schema[timestampPropNames.updatedAt] = {
        type: 'string',
        format: 'date-time'
    };

    if (paranoid === true) {
        required.push(timestampPropNames.deletedAt);
        schema[timestampPropNames.deletedAt] = {
            type: 'string',
            format: 'date-time'
        };
    }
}

/**
 * adds internal properties (like `_id`, `_type`) to model's schema definition
 *
 * @private
 * @this {Model}
 * @return {undefined}
 */
function addInternalDocProperties() {
    let schema = this.options.schema.properties;
    let required = this.options.schema.required;

    if (!_.isPlainObject(schema)) {
        schema = {};
        this.options.schema.properties = schema;
    }

    if (!(required instanceof Array)) {
        required = [];
        this.options.schema.required = required;
    }

    let idPropName = this.options.schemaSettings.doc.idPropertyName;
    let typePropName = this.options.schemaSettings.doc.typePropertyName;
    let keyType = this.options.key.dataType;

    schema[idPropName] = {
        type: keyType
    };

    schema[typePropName] = {
        type: 'string'
    };

    required.push(typePropName);
}
