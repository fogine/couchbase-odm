const _         = require('lodash');
const dataUtils = require("./data.js");

module.exports.addTimestampProperties = addTimestampProperties;
module.exports.addInternalDocProperties = addInternalDocProperties;
module.exports.extractAssociations = extractAssociations;
module.exports.extract = extract;

/**
 * recursive function
 * associations are defined with `relation` keyword:
 *
 * {
 *   user: {
 *     relation: {type: 'User' method: 'reference'}
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
    if (_.isPlainObject(schema.relation)) {
        data.push({
            path   : path,
            type   : schema.relation.type,
            method : schema.relation.method
        });
    } else if (schema.type === 'array') {
        if (_.isPlainObject(schema.items)
            && _.isPlainObject(schema.items.relation)
        ) {
            data.push({
                path   : path,
                type   : schema.items.relation.type,
                method : schema.items.relation.method
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
 * extract some of the json-schema keywords like `default` & `format` into
 * a separate schema object
 *
 * @private
 * @param {Object} schema - json-schema
 * @param {Object} keywords - which keywords to process & extract into a separate schema
 * @param {Boolean} keywords.default
 * @param {Object} keywords.timestamps
 */
function extract(schema, keywords, _skipDefaults) {

    if (_.isPlainObject(schema) && keywords.default) {
        const out = {
            properties: {
                data: {}
            }
        };

        if (schema.type === 'object') {
            out.properties.data.default = {};
        } else if(schema.type === 'array') {
            out.properties.data.default = [];
        }

        Object.assign(
            out.properties.data,
            _extract(schema, keywords, _skipDefaults)
        );

        return out;
    } else {
        return _extract(schema, keywords, _skipDefaults);
    }
}

/**
 * @private
 * @param {Object} schema - json-schema
 * @param {Object} keywords - which keywords to process & extract into a separate schema
 * @param {Boolean} keywords.default
 * @param {Object} keywords.timestamps
 */
function _extract(schema, keywords, _skipDefaults) {
    let out = {};
    keywords = keywords || {};
    if (typeof _skipDefaults !== 'boolean') {
        _skipDefaults = true;
    }

    if (_.isPlainObject(schema)) {
        if (keywords.default
            && schema.hasOwnProperty('default')
            && !_skipDefaults
        ) {
            out.default = schema.default;
        } else if (keywords.timestamps
            && schema.hasOwnProperty('format')
            && ['date-time', 'date'].includes(schema.format)
        ) {
            Object.assign(out, keywords.timestamps);
        }

        if (schema.hasOwnProperty('properties')) {
            Object.keys(schema.properties).forEach(function(prop) {
                let _schema = _extract(
                    schema.properties[prop],
                    keywords,
                    false
                );
                if (!_.isEmpty(_schema)) {
                    _.set(out, ['properties', prop], _schema);
                }
            });
        } else if (schema.items instanceof Array) {
            schema.items.forEach(function(subSchema, index) {
                let _schema = _extract(subSchema, keywords, false);
                if (!_.isEmpty(_schema)) {
                    _.set(out, ['items', index], _schema);
                }
            })
        } else if (_.isPlainObject(schema.items)) {
            let _schema = _extract(schema.items, keywords, true);
            if (!_.isEmpty(_schema)) {
                _.set(out, ['items'], _schema);
            }
        }
    }

    return out;
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

    let timestampPropNames = this._getTimestampPropertyNames();

    schema[timestampPropNames.createdAt] = {
        type: ['string', 'object'],
        format: 'date-time'
    };

    schema[timestampPropNames.updatedAt] = {
        type: ['string', 'object'],
        format: 'date-time'
    };

    if (paranoid === true) {
        schema[timestampPropNames.deletedAt] = {
            type: ['string', 'object'],
            format: 'date-time'
        };
    }

    required.push(timestampPropNames.createdAt);
    required.push(timestampPropNames.updatedAt);
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
