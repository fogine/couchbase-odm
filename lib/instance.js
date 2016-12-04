'use strict';
var _        = require('lodash');
var Promise  = require('bluebird');
var util     = require('util');
var moment   = require('moment');

module.exports = Instance;

var Document        = require("./document.js");
var Key             = require("./key/key.js");
var dataType        = require("./dataType");
var Operation       = require("./operation.js");
var InstanceError   = require("./error/instanceError.js");
var KeyError        = require("./error/keyError.js");
var ValidationError = require("./error/validationError.js");
var StorageError    = require("./error/storageError");
var StorageAdapter  = require("./storageAdapter.js");
var HookTypes       = require("./hook.js").types;
var sanitizer       = require("./sanitizer/data.js");
var associations    = require('./associations.js');

var DataTypes = dataType.types;
/**
 * Instance
 *
 * @constructor
 * @extends Document
 *
 * @param {mixed}         data
 * @param {Object}        [options]
 * @param {Key}           [options.key] - `Key` instance representing primary key of the document
 * @param {boolean}       [options.isNewRecord=true]
 * @param {CAS}           [options.cas] - If the item on the server contains a different CAS value, the operation will fail. Note that if this option is undefined, no comparison will be performed.
 *
 * @throws {DocumentError}
 * @throws {InstanceError}
 * @throws {ValidationError}
 * @throws {Error}
 */
function Instance(data, options) {

    Document.call(this, {
        data        : data,
        key         : options.key,
        cas         : options.cas,
        storage     : this.Model.storage,
        isNewRecord : options.isNewRecord
    });

    var self = this;
    if (!(options.key instanceof Key)) {
        throw new InstanceError("`options.key` must be instace of Key");
    }

    Object.defineProperty(this, "$schemaSettings", {
        value: this.Model.options.schemaSettings,
        writable: false,
        enumerable: false,
        configurable: false
    });

    //Instance which is currently perssisted in a bucket
    Object.defineProperty(this, "$original", {
        value: null,
        writable: true,
        enumerable: false,
        configurable: false
    });

    //define `id` (dynamic part of document's `key`) getter property on instance
    var idPropName = this.$schemaSettings.doc.idPropertyName;
    Object.defineProperty(this, idPropName, {
        enumerable: true,
        get: function() {
            return this.getKey().getId();
        },
        configurable: false
    });


    var schema = this.Model.options.schema;
    if (this.Model.$dataHasObjectStructure()) {
        this.options.data = this.options.data || {};
        //bind properties from data schema to this instance so properties are
        //accessible through instance.propertyName
        bindDataProperties.apply(this, [this, schema.schema]);

        //bind internal properties
        Object.defineProperty(this.options.data, idPropName, {
            enumerable: true,
            get: function() {
                return self.getKey().getId();
            },
            configurable: false
        });

        var typePropName = this.$schemaSettings.doc.typePropertyName;
        Object.defineProperty(this.options.data, typePropName, {
            enumerable: true,
            get: function() {
                return self.Model.name;
            },
            configurable: false
        });
    }

}

//Inherit Document prototype
Instance.prototype = Object.create(Document.prototype);
Instance.prototype.constructor = Instance;
Object.defineProperty(Instance.prototype, "super", {
    value: Document.prototype
});

/**
 * @name Instance#Model
 * @instance
 * @type {Model}
 */

/**
 * sanitize
 *
 * validates & tries to parse data values according to defined schema
 *
 * @param {Object}         [options]
 * @param {Boolean}        [options.skipInternalProperties=true]
 * @param {Boolean|Object} [options.associations=false] if true, all object's associations are recursively sanitized as well
 * @param {Boolean}        [options.associations.embedded] if true, object's associations of `EMBEDDED` type are recursively sanitized
 * @param {Boolean}        [options.associations.reference] if true, object's associations of `REFERENCE` type are recursively sanitized
 * @param {Boolean}        [options.includeUnlisted] if true, properties which are not described by the schema will NOT be stripped
 *
 * @throws {ValidationError}
 * @return {undefined}
 */
Instance.prototype.sanitize =  function(options) {
    var defaults = {
        skipInternalProperties: true,
        associations: false,
        includeUnlisted: this.Model.options.schema.$hasInternalPropsOnly ? true : false
    };
    options = _.assign(defaults, options);

    this.Model.runHooks(HookTypes.beforeValidate, this);

    this.setData( sanitizer.sanitize.apply(this.Model, [
                this.Model.options.schema,
                this.getData(),
                options
    ]));
    this.Model.runHooks(HookTypes.afterValidate, this);
};

/**
 * $buildRefDocument
 *
 * @private
 *
 * @param {Object} options
 * @param {String} options.index - index name
 * @return {Document}
 */
Instance.prototype.$buildRefDocument =  function(options) {
    return this.getGeneratedKey().bind(this).then(function(key) {
        var doc = new Document({
            key: this.Model.buildRefDocKey(null, {
                index: options.index,
                parse: false
            }),
            data: key.toString(),
            storage: this.getStorageAdapter(),
            reference: this
        });
        return doc;
    });
};

/**
 * $initRelations
 *
 * @private
 *
 * @return {undefined}
 */
Instance.prototype.$initRelations =  function() {
    var idPropName = this.$schemaSettings.doc.idPropertyName;
    var modelManager = this.Model.$modelManager;
    var dataValues = this.getData();
    var relations = this.Model.relations;

    for (var i = 0, len = relations.length; i < len; i++) {
        var rel = relations[i];
        var deserialize = associations[rel.type.options.relation].deserialize;

        //model's schema can be set up in a way that it only contains
        //relation to another Document (Model) at root of the data schema.
        //In that case "rel.path === null" and
        //this.getData() == associated object
        //eg: this.getData() == {"_id": "User_some-unique-id-of-associated-doc"}
        var relData = rel.path !== null ? _.get(dataValues, rel.path) : dataValues;
        var arrayOfRelations = true;

        //unify data interface
        if (!Array.isArray(relData)) {
            relData = [relData];
            arrayOfRelations = false;
        }

        for (var y = 0, len2 = relData.length; y < len2; y++) {
            if (relData[y] instanceof Instance || _.isNil(relData[y]))  continue;
            var assoc = deserialize.call(this, rel.type, relData[y]);

            if (arrayOfRelations) {
                relData[y] = assoc;
            } else if (rel.path === null) {
                this.setData(assoc);
            } else {
                _.set(dataValues, rel.path, assoc);
            }
        }
    }
};

/**
 * getSerializedData
 *
 * converts object's associations to json objects with single property with value
 * of key string
 * returns object's serialized data
 *
 * @override
 * @function
 * @return {Promise<{mixed}>}
 */
Instance.prototype.getSerializedData = Promise.method(function() {
    if (   !this.Model.$dataHasJsonStructure()
        && this.Model.options.schema.type.toString() !== dataType.Complex.toString()
    ) {
        return this.super.getSerializedData.call(this);
    }

    var instance = this;
    var relations = this.Model.relations;
    var modelManager = this.Model.$modelManager;
    var data = this.$cloneData();

    return Promise.map(relations, function(rel) {
        var serialize = associations[rel.type.options.relation].serialize;
        //model's schema can be set up in a way that it only contains
        //relation to another Document (Model) at root of the data schema.
        //In that case "rel.property === null" and
        //this.getData() == association object
        //eg: this.getData() == {"_id": "User_some-unique-id-of-associated-doc"}
        var assoc = rel.path !== null ? _.get(data, rel.path) : data;

        //unify data interface
        var arrayOfRelations = true;
        if (!Array.isArray(assoc)) {
            assoc = [assoc];
            arrayOfRelations = false;
        }

        return Promise.map(assoc, function(association, index) {
            /* istanbul ignore if */
            if (!(association instanceof rel.type.getModel(modelManager).Instance)) {
                return null;//continue (should never happen)
            }
            return serialize.call(instance, association).then(function(serializedData) {
                if (arrayOfRelations) {
                    assoc[index] = serializedData;
                } else if (rel.path === null) {
                    data = serializedData;
                } else {
                    _.set(data, rel.path, serializedData);
                }
                return null;
            });
        });
    }).then(function() {
        //must be explicitly in "then closure function"
        return data;
    });
});

/**
 * populate
 *
 * @example
 *
 * user.populate('friends'); //single path
 *
 * user.populate([
 *     'friends',
 *     'apps'
 * ]); // multiple paths
 *
 * user.populate({
 *     path: 'friends',
 *     populate: 'friends'
 * }); // Populates user's friends and friends of the friends
 *
 * // You can combine these three styles to describe exactly what you want to populate
 *
 * @param {String|Array|Object} include
 * @param {Object}              [options]
 * @param {Boolean}             [options.skipPopulated=true] - if false, associations will be reloaded even though they've been already loaded
 * @param {Boolean}             [options.getOrFail=false] - if true, when there is an association which can not be found, the populate method will return rejected promise with the error
 *
 * @function
 * @return {Instance}
 */
Instance.prototype.populate = Promise.method(function(include, options) {
    var instance = this;
    var defaults = {
        skipPopulated: true,
        getOrFail: false
    };

    options = _.assign(defaults, _.clone(options));

    //normalize `include` argument
    if (!Array.isArray(include)) {
        include = [include];
    }

    return Promise.map(include, function(path) {
        var populate;
        var association;

        //normalize path
        if (_.isPlainObject(path)) {
            populate = path.populate;
            path = path.path;
        }
        if (typeof path !== 'string' && !_.isNil(path)) {
            throw new InstanceError('Invalid `include` argument received for the `populate` method');
        }

        if (path === '' || _.isNil(path)) {
            association = instance.getData();
        } else {
            association = _.get(instance.getData(), path);
        }

        if (association instanceof Array) {
            return Promise.map(association, function(assoc) {
                return refreshAssociation(assoc, populate);
            });
        } else if (association instanceof Instance) {
            return refreshAssociation(association, populate);
        } else {
            throw new InstanceError(
                instance.Model.name + "'s data " + (path ? 'located at ' + path : '') +
                "is not " + instance.Model.name + "'s Instance object"
            );
        }
    }).return(instance);

    function refreshAssociation(assoc, populate) {

        if (   assoc.hasCAS()
            && !assoc.options.isNewRecord
            && options.skipPopulated
        ) {
            return null;
        }

        return assoc.refresh()
        .then(function(assoc) {
            if (!_.isNil(populate)) {
                return assoc.populate(populate, options);
            }
            return assoc;
        })
        .catch(function(err) {
            if (   err instanceof StorageError
                && err.code === StorageAdapter.errorCodes.keyNotFound
                && !options.getOrFail
               ) {
                return null;
            }
            return Promise.reject(err);
        });
    }
});

/**
 * $cloneData
 *
 * @param {Function} [customizer]
 *
 * @private
 * @return {Mixed}
 */
Instance.prototype.$cloneData = function(customizer) {
    return _.cloneDeepWith(this.getData(), function(val) {
        if (customizer instanceof Function) {
            var resolved = customizer(val);
            if (resolved !== undefined) {
                return resolved;
            }
        }
        if (val instanceof Instance) return val;
    });
};

/**
 * $cloneOptions
 *
 * @private
 * @return {Mixed}
 */
Instance.prototype.$cloneOptions = function() {
    return  _.cloneDeepWith(this.options, function(val) {
        if (val instanceof Key) return val.clone();
    });
};

/**
 * clone
 *
 * @return {Instance}
 */
Instance.prototype.clone = function() {

    var self = this;

    var clone = new this.Model.Instance(this.$cloneData(), self.$cloneOptions());

    clone.$original = new this.Model.Instance(
            this.$cloneData(),
            self.$cloneOptions()
    );
    return clone;
};

/**
 * setData
 *
 * override `Document.prototype.setData`
 *
 * @example
 *
 * instance.setData({some: 'data'}) // bulk set enumerable properties of provided data object
 * instance.setData('username', 'fogine') //writes to `username` property on data object
 *
 * @param {string} [property]
 * @param {mixed} data
 * @return {Instance}
 */
Instance.prototype.setData = function() {
    if (!this.hasCAS() && !this.options.isNewRecord) {
        throw new InstanceError('Can NOT set data of unloaded document that has been persisted to a bucket. Call the `refresh` method');
    } else if (arguments.length == 1 && _.isPlainObject(arguments[0])) {
        var data = arguments[0];

        var keys = Object.keys(data);
        keys = _.without(keys,
                this.$schemaSettings.doc.idPropertyName,
                this.$schemaSettings.doc.typePropertyName
                );

        for (var i = 0, len = keys.length; i < len; i++) {
            this.options.data[keys[i]] = data[keys[i]];
        }
        return this;
    } else {
        return this.super.setData.apply(this, arguments);
    }
};

/**
 * refresh
 *
 * @return {Promise<Instance>}
 */
Instance.prototype.refresh = function() {
    return this.getGeneratedKey().bind(this).then(function(key) {
        return this.Model.getByIdOrFail(key, {plain: true});
    }).then(function(doc) {
        this.setCAS(doc.cas);
        this.setData(doc.value);
        setOriginal.call(this);
        this.$initRelations();
        return this;
    });
};

/**
 * setOriginal
 *
 * @private
 * @throws {DocumentError}
 * @return {undefined}
 */
function setOriginal() {
    if (this.$original !== null) {
        this.$original.setCAS(this.getCAS());
        this.$original.setData(this.$cloneData());
        this.$original.options.isNewRecord = false;
        this.$original.options = this.$cloneOptions();
        this.$original.setKey(this.getKey().clone());
    }
}

/**
 * $getRefDocs
 *
 * @private
 * @function
 * @return {Promise<Array<Document>>}
 */
Instance.prototype.$getRefDocs = Promise.method(function() {

    //TODO add reference documents suppport for non-json documents as well??
    if (!this.Model.$dataHasJsonStructure()) {
        return Promise.resolve([]);
    }

    var refDocs = this.Model.options.indexes.refDocs;
    var refDocIndexNames = Object.keys(refDocs);

    return Promise.resolve(refDocIndexNames).bind(this).map(function(indexName) {
        var refDocOptions = refDocs[indexName];

        return this.$buildRefDocument({
            index: indexName
        }).tap(function(doc) {
            return doc.getGeneratedKey();
        }).catch(KeyError, function(err) {
            if (refDocOptions.required === false) {
                return null;
            }
            return Promise.reject(err);
        });
    }).then(function(refDocs) {
        //TODO better solution, now it's iterating twice and that's useless!
        return refDocs.filter(function(refDoc) {
            return !_.isNil(refDoc);
        })
    });
});

/**
 * $getDirtyRefDocs
 *
 * returns two collections of reference documents one of which are changed `current` and are going to be
 * persisted to db and other collection of outdated ref docs `old` which should be removed
 * from bucket in order to fulfill update process of a refdoc indexes
 *
 * @private
 * @function
 * @return {Object}
 */
Instance.prototype.$getDirtyRefDocs = Promise.method(function() {

    var self = this;
    var out = {
        current: [],//collection of current ref-documents which will be persisted to the bucket
        old: [] //collection of outdated ref-documents which will be removed from the bucket
    };

    //TODO add suppport of reference documents for non-json documents as well??
    if (!this.Model.$dataHasJsonStructure()) {
        return Promise.resolve(out);
    }

    var refDocs = self.Model.options.indexes.refDocs;
    var refDocIndexNames = Object.keys(refDocs);

    //pupulate `out` collection
    return Promise.map(refDocIndexNames, function(indexName) {
        var refDocOptions = refDocs[indexName];

        var docPool = {};

        //create instance of the reference document with most recent data
        //from the Instance
        return self.$buildRefDocument({
            index: indexName
        }).bind(docPool).then(function(doc) {
            this.doc = doc;

            //create instance of the reference document with data which are
            //currently persisted in bucket
            return self.$original.$buildRefDocument({
                index: indexName
            });
        }).then(function(oldDoc) {
            this.oldDoc = oldDoc;

            var keyPool = {
                key: this.doc.getGeneratedKey().reflect(),
                oldKey: this.oldDoc.getGeneratedKey().reflect()
            }

            return Promise.props(keyPool).bind(this).then(function(result) {
                var key = this.doc.getKey();
                var oldKey = this.oldDoc.getKey();

                //if rejected, check if expected error has been throwed, otherwise fail
                if(   result.oldKey.isRejected()
                        && !(result.oldKey.reason() instanceof KeyError)
                  ) {
                    return Promise.reject(result.oldKey.reason());
                }

                //if rejected, check if expected error has been throwed, otherwise fail
                if(   result.key.isRejected()
                        && !(result.key.reason() instanceof KeyError)
                  ) {
                    return Promise.reject(result.key.reason());
                }


                var required = refDocOptions.required;
                if (result.key.isFulfilled() && result.oldKey.isFulfilled()) {
                    if (key.toString() !== oldKey.toString()) {
                        out.current.push(this.doc);
                        out.old.push(this.oldDoc);
                    }
                    return out;
                } else if (required === false) {
                    if(!key.isGenerated() && oldKey.isGenerated()) {
                        out.old.push(this.oldDoc);
                    } else if(!oldKey.isGenerated() && key.isGenerated()) {
                        out.current.push(this.doc);
                    }
                    return out;
                } else {
                    var reason = null;
                    if (result.key.isRejected()) {
                        reason = result.key.reason();
                    } else {
                        reason = result.oldKey.reason();
                    }
                    return Promise.reject(reason);
                }
            });
        });

    }).return(out);
});

/**
 * save
 *
 * shortcut method for calling {@link Instance#replace} / {@link Instance#insert}. if fresh instance is initialized
 * and the data are not persisted to bucket yet, `insert` is called. If the Instance
 * is already persisted, data are updated with `replace` method
 *
 * @function
 * @return {Promise<Instance>}
 */
Instance.prototype.save = Promise.method(function(options) {
    if (this.options.isNewRecord) {
        return this.insert(options);
    }
    return this.replace(options);
});

/**
 * update
 *
 * This is the same as seting data on the instance and then calling {@link Instance#save},
 * (respectively {@link Instance#replace}) but this only updates the exact values passed to it,
 * making it more atomic.
 *
 * @param {Object} data
 * @param {Object} [options] - see {@link StorageAdapter#replace} for available options
 *
 * @function
 * @return {Instance}
 */
Instance.prototype.update = Promise.method(function(data, options) {

    var self = this;
    var backup = this.$original.$cloneData();

    this.$original.setData(data);

    return this.$original.save(options).then(function(instance) {
        self.setData(data);
        return self;
    }).catch(function(err) {
        var originalData = self.$original.getData();
        //restore `$original` object state to the correct state
        if (   self.Model.$dataHasObjectStructure()
            && _.isPlainObject(data)
            && _.isPlainObject(originalData)
        ) {
            _.difference(
                    Object.keys(data),
                    Object.keys(self.getData())
            ).forEach(function(propName) {
                delete originalData[propName];
            });
        }
        self.$original.setData(backup);
        return Promise.reject(err);
    });
});

/**
 * destroy
 *
 * deletes the document and all related reference documents from a bucket
 *
 * @param {Object} [options] - See `StorageAdapter.remove` for available options
 *
 * @function
 * @return {Promise}
 */
Instance.prototype.destroy = Promise.method(function(options) {

    var self = this;

    if (!this.hasCAS()) {
        return Promise.reject(new InstanceError('Can not destroy a Model instance without the `cas` value being set'));
    }

    return this.Model.runHooks(HookTypes.beforeDestroy, this, options).then(function() {
        return self.$getRefDocs();
    }).bind({}).then(function(docs) {//remove ref docs
        this.docs = docs;
        this.timestamps = self.$touchTimestamps(undefined, {touchDeletedAt: true});
        return self.getStorageAdapter()
            .bulkRemoveSync(docs, options);
    }).then(function() {//remove the doc
        var opt = _.merge({}, {cas: self.getCAS()}, options);

        if (self.Model.options.paranoid) {
            return self.super.replace.call(self, opt);
        }
        return self.remove(opt);
    }).then(function(result) {// resolve successful destroy operation
        if (!self.Model.options.paranoid) {
            self.options.isNewRecord = true;
        }
        self.setCAS(result.cas);//remove operation also returns `cas` value
        return self.Model.runHooks(HookTypes.afterDestroy, self, options).return(self);
    }).catch(StorageError, function(err) {// rollback deleted refdocs
        var docs = this.docs;
        var failedIndex = this.docs.indexOf(err.doc);
        if (failedIndex !== -1) {
            docs = this.docs.slice(0, failedIndex);
        }

        return _rollback.call(self, {
            err        : err,
            operation  : Operation.REMOVE,
            docs       : docs,
            timestamps : this.timestamps
        });
    });
});

/**
 * insert
 *
 * saves NEW document (fails if the document already exists in a bucket) to storage
 * with all its reference documents, if an error occurs,
 * an attempt for rollback is made, if the rollback fails,
 * the `afterFailedRollback` hook is triggered.
 *
 * @param {Object} [options] - See `StorageAdapter.insert` for available options
 *
 * @function
 * @return {Promise<Instance>}
 */
Instance.prototype.insert = Promise.method(function(options) {

    var self = this
        , report
        , timestampsBck;

    //touch timestamps, backup previous timestamps values
    timestampsBck = this.$touchTimestamps();

    //run beforeCreate hooks
    return this.Model.runHooks(HookTypes.beforeCreate, this, options).then(function() {

        //validate
        try {
            self.sanitize({
                skipInternalProperties: false,
                associations: {embedded: true}
            });
        } catch(e) {
            self.$touchTimestamps(timestampsBck);
            return new Promise.reject(e);
        }

        //begin insert process
        return self.$getRefDocs();
    }).bind({}).then(function(docs) {//Insert ref docs
        this.docs = docs;
        this.timestamps = timestampsBck;
        return self.getStorageAdapter().bulkInsertSync(docs, options);
    }).then(function() {//Insert the doc
        return self.super.insert.call(self, options);
    }).then(function(result) {//Resolve successful `insert` operation
        self.setCAS(result.cas);
        self.options.isNewRecord = false;
        setOriginal.call(self);

        return self.Model.runHooks(HookTypes.afterCreate, self, options).return(self);
    }).catch(StorageError, function(err) {//try to rollback inserted refdocs

        var docs = this.docs;
        var failedIndex = this.docs.indexOf(err.doc);
        if (failedIndex !== -1) {
            docs = this.docs.slice(0, failedIndex);
        }

        return _rollback.call(self, {
            err        : err,
            operation  : Operation.INSERT,
            docs       : docs,
            timestamps : this.timestamps
        });
    });
});

/**
 * replace
 *
 * replaces (updates) current document (fails if the document with the key does not exists) in a bucket
 * and synchronizes reference documents (indexes). If an error occur,
 * an attempt for rollback is made, if the rollback fails,
 * the `afterFailedRollback` hook is triggered for every document an atempt for rollback failed (includes failed refdocs operations)
 *
 * @param {Object} [options] - See `StorageAdapter.replace` for available options
 *
 * @function
 * @return {Promise<Instance>}
 */
Instance.prototype.replace = Promise.method(function(options) {

    var self = this
        , timestampsBck;

    if (!this.hasCAS()) {
        return Promise.reject(new InstanceError('Can not call the replace (update) method on a Model instance without the `cas` value being set'));
    }

    //touch timestamps, backup previous timestamps values
    timestampsBck = this.$touchTimestamps();

    //run beforeUpdate hooks
    return this.Model.runHooks(HookTypes.beforeUpdate, this, options).then(function() {

        //validate & sanitize data
        try {
            self.sanitize({
                skipInternalProperties: false,
                associations: {embedded: true}
            });
        } catch(e) {
            self.$touchTimestamps(timestampsBck);
            return new Promise.reject(e);
        }

        //begin update process
        return self.$getDirtyRefDocs();
    }).bind({}).then(function(docs) {
        this.refDocs = docs.current;
        this.oldRefDocs = docs.old;
        return null;
    }).then(function() {
        return self.getStorageAdapter()
            .bulkInsertSync(this.refDocs, options);
    }).then(function() {
        this.timestamps = timestampsBck;
        return self.super.replace.call(self, options);
    }).then(function(result) {
        self.setCAS(result.cas);
        return self.getStorageAdapter()
            .bulkRemove(this.oldRefDocs, options);
    }).each(function(result, index, length) {
        if (result.isRejected()) {
            if (self.Model.listenerCount('afterFailedIndexRemoval')) {
                //TODO explain in the documentation that if a listener of this type is attached,
                //an user is supposed to handle state of promise resolved/rejected
                return self.Model.runHooks(HookTypes.afterFailedIndexRemoval, result.reason());
            } else {
                return Promise.reject(result.reason());
            }
        }
        return null;
    }).then(function() {
        setOriginal.call(self);
        return self.Model.runHooks(HookTypes.afterUpdate, self, options).return(self);
    }).catch(StorageError, function(err) {//BEGIN rollback
        var docs = this.refDocs;
        var failedIndex = this.refDocs.indexOf(err.doc);
        if (failedIndex !== -1) {
            docs = this.refDocs.slice(0, failedIndex);
        }

        return _rollback.call(self, {
            err        : err,
            operation  : Operation.REPLACE,
            docs       : docs,
            timestamps : this.timestamps
        });
    });
});

/**
 * _rollback
 *
 * @private
 *
 * @param {Object}       [options]
 * @param {StorageError} [options.err] - the error which triggered rollback operation
 * @param {string}       [options.operation] - see `./operation.js` for available values
 * @param {Array}        [options.docs] - documents which should be restored/removed
 * @param {Object}       [options.timestamps] - Instance timestamp values will be reverted to these values
 * @return {Promise.reject<Error>}
 */
function _rollback(options) {
    options.instance = this;

    var timestamps = options.timestamps;
    delete options.timestamps;
    var rollbackMethod;

    switch (options.operation) {
        case Operation.INSERT:
        case Operation.REPLACE:
            rollbackMethod = 'bulkRemove';
            break;
        case Operation.REMOVE:
            rollbackMethod = 'bulkInsert';
            break;
    }

    return this.Model.runHooks(HookTypes.beforeRollback, options).bind(options).then(function() {
        this.instance.$touchTimestamps(timestamps);
        var storage = this.instance.getStorageAdapter();
        return storage[rollbackMethod](this.docs);
    }).each(function(result, index, length) {
        if (result.isRejected()) {
            this.instance.Model.runHooks(HookTypes.afterFailedRollback, result.reason(), this);
        }
        return null;
    }).then(function() {
        return this.instance.Model.runHooks(HookTypes.afterRollback, this);
    }).return(Promise.reject(options.err));
}

/**
 * toJSON
 *
 * @throws InstanceError
 * @return {Object}
 */
Instance.prototype.toJSON = function() {
    if (!this.Model.$dataHasJsonStructure()) {
        throw new InstanceError("Can NOT convert document value of primitive type to JSON");
    }
    //TODO - make sure that this did not broke anything
    //var data = _.cloneDeep(this.options.data);
    var data = _.cloneDeep(this.$cloneData());

    if (this.Model.$dataHasObjectStructure()) {
        var typePropName = this.$schemaSettings.doc.typePropertyName;
        delete data[typePropName];
    }
    return data;
};

/**
 * bindDataProperties
 *
 * @param {Object} obj - object to which properties will be bind to
 * @param {Object} properties
 * @param {boolean} [forceRebinding=false] - if it's true, existing properties on the instance are redefined
 *
 * @private
 * @return {undefined}
 *
 */
function bindDataProperties(obj, properties, forceRebinding) {
    var keys = Object.keys(properties);
    var data = this.getData();

    for (var i = 0, len = keys.length; i < len; i++) {
        var name = keys[i];
        (function(name) {
            if (!obj.hasOwnProperty(name) || forceRebinding === true) {
                var prop = properties[name];
                Object.defineProperty(obj, name, {
                    enumerable: true,
                    configurable: true,
                    set: function(value) {
                        data[name] = value;
                    },
                    get: function() {
                        return data[name];
                    }
                });
            }
        })(name);
    }
}

/**
 * $touchTimestamps
 *
 * @private
 *
 * if `timestamps` object is provided, current timestamps are overwriten with
 * `timestamps` provided and old timestamp values are returned.
 * if no `timestamps` object is provied, timestamps values are touched and
 * old timestamp values are returned
 *
 * @param {Object}  timestamps - [optional]
 * @param {Object}  [options] - [optional]
 * @param {boolean} [options.touchDeletedAt=false] - Applies only if `timestamps`
 *                                             parameter is not provided
 * @return {Object} - old timestamp values
 */
Instance.prototype.$touchTimestamps = function(timestamps, options) {
    options = options || {};

    if (   !this.Model.$dataHasObjectStructure()
            || !this.Model.options.timestamps
            || (options.touchDeletedAt === true && this.Model.options.paranoid !== true)
       ) {
        return;
    }

    var data = this.getData();

    var propNames = this.Model.$getTimestampPropertyNames();

    var oldTimestamps = {};
    oldTimestamps[propNames.createdAt] = data[propNames.createdAt];
    oldTimestamps[propNames.updatedAt] = data[propNames.updatedAt];
    oldTimestamps[propNames.deletedAt] = data[propNames.deletedAt];

    if (_.isPlainObject(timestamps)) {
        _.assign(data, timestamps);
        return oldTimestamps;
    }

    var dateValidator = sanitizer.sanitizers[DataTypes.DATE];
    var now = moment.utc().format();

    try {
        data[propNames.createdAt]  = dateValidator(
                data[propNames.createdAt],
                { propPath: ''}
        );
    } catch(e) {
        data[propNames.createdAt] = now;
    }

    data[propNames.updatedAt] = now;

    if (options.touchDeletedAt === true) {

        try {
            data[propNames.deletedAt]  = dateValidator(
                    data[propNames.deletedAt],
                    {propPath: ''}
            );
        } catch(e) {
            data[propNames.deletedAt] = now;
        }
    }

    return oldTimestamps;
};

/*
 * inspect
 *
 * @private
 * @return {string}
 */
Instance.prototype.inspect = function() {
    var key = this.options && this.options.key;
    var cas = key && this.options.cas;
    var out = '[object CouchbaseInstance:\n';
    out += "    key: '" + key + "'\n";
    out += "    cas: " + cas;
    out += "]";

    return out;
};
