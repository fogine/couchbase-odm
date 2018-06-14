const _       = require('lodash');
const Promise = require('bluebird');

const relationType = require('./relationType.js');
const Instance     = require('./instance.js');

module.exports[relationType.REF] = {
    /**
     * @private
     * @this {Instance}
     * @return {Promise<Object>}
     */
    serialize: Promise.method(function(associatedInstance) {
        const idPropName = this.$schemaSettings.doc.idPropertyName;

        return associatedInstance.getGeneratedKey().then(function(key) {
            const out = {};
            out[idPropName] = key.toString();
            return out;
        });
    }),

    /**
     * @private
     * @this {Instance}
     * @return {Instance}
     */
    deserialize: function(modelName, data) {
        //relation by reference should be always serialized as plain object with an id
        //if it's not the case just return back data we've got
        //in ideal world this should never happen... :)
        /* istanbul ignore if */
        if (!_.isPlainObject(data)) {
            return data;
        }
        const idPropName = this.$schemaSettings.doc.idPropertyName;
        const relModel   = this.Model.$modelManager.get(modelName);
        const key        = relModel.buildKey(data[idPropName], {parse: true});

        return relModel.build(null, {
            key: key,
            isNewRecord: false,
            sanitize: false
        });
    }
};
