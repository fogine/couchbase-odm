var _       = require('lodash');
var Promise = require('bluebird');

var relationType = require('./relationType.js');
var Instance     = require('./instance.js');

module.exports[relationType.REF] = {
    /**
     * serialize
     *
     * @private
     * @this {Instance}
     * @return {Promise<Object>}
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
        //relation by reference should be always serialized as plain object with an id
        //if it's not the case just return back data we've got
        //in ideal world this should never happen
        /* istanbul ignore if */
        if (!_.isPlainObject(data)) {
            return data;
        }
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

module.exports[relationType.EMBEDDED] = {
    /**
     * serialize
     *
     * @private
     * @this {Promise<Object>}
     */
    serialize: Promise.method(function(associatedInstance) {
        var idPropName = this.$schemaSettings.doc.idPropertyName;
        var typePropName = this.$schemaSettings.doc.typePropertyName;

        return associatedInstance.getGeneratedKey().then(function(key) {
            return cloneCustomizer(associatedInstance);
        });

        //recursively clones & normalizes data
        function cloneCustomizer(val) {
            if (val instanceof Instance) {
                var vendorIdPropName = val.$schemaSettings.doc.idPropertyName;
                var vendorTypePropName = val.$schemaSettings.doc.typePropertyName;
                var key = val.getKey();

                val = val.$cloneData(cloneCustomizer);
                if (_.isPlainObject(val)) {
                    val[idPropName] = key.toString();
                    if (idPropName != vendorIdPropName) {
                        delete val[vendorIdPropName];
                    }
                    if (typePropName != vendorTypePropName) {
                        val[typePropName] = val[vendorTypePropName];
                        delete val[vendorTypePropName];
                    }
                }
                return val;
            }
        }
    }),

    /**
     * deserialize
     *
     * @private
     * @this {Instance}
     * @return {Instance}
     */
    deserialize: function(dataType, data) {
        var key;
        var idPropName = this.$schemaSettings.doc.idPropertyName;
        var relModel   = dataType.getModel(this.Model.$modelManager);

        //embedded documents which has primitive root data type don't have an id serialized
        //along it's data, so don't build the key
        if (_.isPlainObject(data)) {
            console.log(data);
            key = relModel.buildKey(data[idPropName], {parse: true});
        }

        return relModel.build(data, {
            key: key,
            isNewRecord: true,
            sanitize: false
        });
    }
};
