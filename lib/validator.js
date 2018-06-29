const Ajv = require('ajv');
const keywords = require('ajv-keywords');

const DATE_TIME = /^\d\d\d\d-[0-1]\d-[0-3]\d[t\s](?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d:\d\d)$/i;
const DATE = /^\d\d\d\d-[0-1]\d-[0-3]\d$/;

const ajv = new Ajv({
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
});

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

module.exports = ajv;

/*
 * @param name {String}
 * @param constructor {Function}
 */
ajv._registerCouchbaseType = function _registerCouchbaseType(name, constructor) {
    const defs = keywords.get('instanceof').definition;
    defs.CONSTRUCTORS['CouchbaseODM_' + name] = constructor;
};
