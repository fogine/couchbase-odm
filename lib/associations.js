var Promise = require('bluebird');
var relationType = require('./relationType.js');

module.exports[relationType.REF] = {
    /**
     * serialize
     *
     * @private
     * @this {Promise<Object>}
     */
    serialize: Promise.method(function(associatedInstance) {
        var idPropName = this.$schemaSettings.doc.idPropertyName;

        return associatedInstance.getGeneratedKey().then(function(key) {
            var out = {};
            out[idPropName] = key.toString();
            return out;
        });
    }),

    /**
     * deserialize
     *
     * @private
     * @this {Instance}
     * @return {Instance}
     */
    deserialize: function(dataType, data) {
        var idPropName = this.$schemaSettings.doc.idPropertyName;
        var relModel   = dataType.getModel(this.Model.$modelManager);
        var key        = relModel.buildKey(data[idPropName], {parse: true});

        return relModel.build(null, {
            key: key,
            isNewRecord: false,
            sanitize: false
        });
    }
};

//module.exports[relationType.EMBEDDED] = {
    //serialize: function() {
    //},
    //deserialize: function() {
    //}
//};
