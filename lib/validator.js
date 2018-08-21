const Ajv = require('ajv');
const keywords = require('ajv-keywords');

const ajv = build();

module.exports = ajv;

/*
 * @param name {String}
 * @param constructor {Function}
 */
ajv._registerCouchbaseType = function _registerCouchbaseType(name, constructor) {
    const defs = keywords.get('instanceof').definition;
    defs.CONSTRUCTORS['CouchbaseODM_' + name] = constructor;
};

ajv._build = build;

/*
 *
 */
function build(options) {
    const defaults = {
        _data: true, //data json references
        allErrors: false,
        verbose: true, //include validated data in errors
        //it should fail if other keywords are present
        //along the _ref keywords in the schema
        extendRefs: 'fail',
        //only additional properties with additionalProperties keyword
        //equal to false are removed
        additionalProperties: true,
        removeAdditional: true,
        //used by a separated schema which only applies defaults
        //and by `dynamicDefaults` keyword
        useDefaults: true,
        coerceTypes: true,
        //serialize: false,
        passContext: true, //pass validation context to custom keyword functions
    };

    Object.assign(defaults, options);
    const ajv = new Ajv(defaults);

    keywords(ajv, ['typeof', 'instanceof', 'dynamicDefaults', 'transform']);

    ajv.addKeyword('relation', {
        modifying: false,
        metaSchema: {
            type: 'object',
            required: ['type'],
            properties: {
                type: {type: 'string'},
                method: {type: 'string', enum: ['reference']}
            }
        },
        macro: function(schema, parentSchema) {
            return {
                instanceof: 'CouchbaseODM_' + (schema.type + '').trim()
            };
        }
    });

    ajv.addKeyword('$toJSON', {
        modifying: true,
        statements: true,
        valid: true,
        metaSchema: {
            type: 'object'
        },
        validate: function(schema, data, parentSchema, dataPath, parentData, prop) {
            if (   typeof data === 'object'
                && data !== null
                && typeof data.toJSON === 'function'
                && parentData
            ) {
                parentData[prop] = data.toJSON();
            } else if (typeof data === 'string') {
                parentData[prop] = JSON.parse(data);
            }
        }
    });

    ajv.addKeyword('$toDate', {
        type: ['string', 'integer'],
        modifying: true,
        statements: true,
        valid: true,
        metaSchema: {
            type: 'object'
        },
        validate: function(schema, data, parentSchema, dataPath, parentData, prop) {
            if (parentData) {
                parentData[prop] = new Date(data);
            }
        }
    });

    return ajv;
}
