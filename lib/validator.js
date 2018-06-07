const Ajv = require('ajv');
const keywords = require('ajv-keywords');

const ajv = new Ajv({
    $data: false, //data json references
    allErrors: false,
    verbose: true, //include validated data in errors
    schemaId: '$id',
    //it should fail if other keywords are present
    //along the $ref keywords in the schema
    extendRefs: 'fail',
    //only additional properties with additionalProperties keyword
    //equal to false are removed
    additionalProperties: true,
    removeAdditional: true,
    useDefaults: false, //integration of "default" keyword is handled separately by the ODM
    coerceTypes: true,
    passContext: true, //pass validation context to custom keyword functions
});

keywords(ajv, ['typeof', 'instanceof', 'dynamicDefaults', 'transform']);

ajv.addKeyword('$relation', {
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

module.exports = ajv;
