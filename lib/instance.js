'use strict';
const _        = require('lodash');
const Promise  = require('bluebird');
const util     = require('util');
const moment   = require('moment');

module.exports = Instance;

const Document        = require("./document.js");
const Key             = require("./key/key.js");
const Operation       = require("./operation.js");
const InstanceError   = require("./error/instanceError.js");
const KeyError        = require("./error/keyError.js");
const ValidationError = require("./error/validationError.js");
const StorageError    = require("./error/storageError");
const StorageAdapter  = require("./storageAdapter.js");
const HookTypes       = require("./hook.js").types;
const associations    = require('./associations.js');
const relationType    = require('./relationType.js');

/**
 * instance prototype of a Model
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

    const self = this;
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
    const idPropName = this.$schemaSettings.doc.idPropertyName;
    Object.defineProperty(this, idPropName, {
        enumerable: true,
        get: function() {
            return this.getKey().getId();
        },
        configurable: false
    });


    const schema = this.Model.options.schema;
    if (this.Model.$dataHasObjectStructure()
        && !schema.hasOwnProperty('$relation')
    ) {
        this.options.data = this.options.data || {};
        //bind properties from data schema to this instance so properties are
        //accessible through instance.propertyName
        bindDataProperties.apply(this, [this, schema.properties]);

        //bind internal properties
        Object.defineProperty(this.options.data, idPropName, {
            enumerable: true,
            get: function() {
                return self.getKey().getId();
            },
            configurable: false
        });

        const typePropName = this.$schemaSettings.doc.typePropertyName;
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
 * validates & tries to parse data values according to defined schema
 *
 * @throws {ValidationError}
 * @return {undefined}
 */
Instance.prototype.sanitize =  function() {
    const validator = this.Model.validator;
    this.Model.runHooks(HookTypes.beforeValidate, this);
    const result = validator.validate(this.Model.name, this.getData());

    if (!result) {
        throw new ValidationError(JSON.stringify(validator.errors.shift()));
    }
    this.Model.runHooks(HookTypes.afterValidate, this);
};

/**
 * @private
 *
 * @param {Object} options
 * @param {String} options.index - index name
 * @return {Document}
 */
Instance.prototype.$buildRefDocument =  function(options) {
    return this.getGeneratedKey().bind(this).then(function(key) {
        const doc = new Document({
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
 * @private
 *
 * @return {undefined}
 */
Instance.prototype.$initRelations =  function() {
    const idPropName   = this.$schemaSettings.doc.idPropertyName;
    const modelManager = this.Model.$modelManager;
    const relations    = this.Model.relations;
    const dataValues   = this.getData();

    for (let i = 0, len = relations.length; i < len; i++) {
        let rel = relations[i];
        let deserialize = associations[rel.method || relationType.REF].deserialize;

        //model's schema can be set up in a way that it only contains
        //relation to another Document (Model) at root of the data schema.
        //In that case "rel.path === null" and
        //this.getData() == associated object
        //eg: this.getData() == {"_id": "User_some-unique-id-of-associated-doc"}
        let relData = rel.path.length ? _.get(dataValues, rel.path) : dataValues;
        let arrayOfRelations = true;

        //unify data interface
        if (!Array.isArray(relData)) {
            relData = [relData];
            arrayOfRelations = false;
        }

        for (let y = 0, len2 = relData.length; y < len2; y++) {
            if (relData[y] instanceof Instance || _.isNil(relData[y]))  continue;
            let assoc = deserialize.call(this, rel.type, relData[y]);

            if (arrayOfRelations) {
                relData[y] = assoc;
            } else if (!rel.path.length) {
                this.setData(assoc);
            } else {
                _.set(dataValues, rel.path, assoc);
            }
        }
    }
};

/**
 * converts object's associations to json objects with single property with value
 * of key string
 * returns object's serialized data
 *
 * @override
 * @function
 * @return {Promise<{mixed}>}
 */
Instance.prototype.getSerializedData = Promise.method(function() {
    const relations = this.Model.relations;
    const instance = this;
    const modelManager = this.Model.$modelManager;

    if (   !this.Model.$dataHasJsonStructure()
        && !_.isPlainObject(this.Model.options.schema.$relation)
        || !relations.length
    ) {
        return this.super.getSerializedData.call(this);
    }

    let data = this.$cloneData();

    return Promise.map(relations, function(rel) {
        let serialize = associations[rel.method || relationType.REF].serialize;
        //model's schema can be set up in a way that it only contains
        //relation to another Document (Model) at root of the data schema.
        //In that case "rel.path == []" and
        //this.getData() == association object
        //eg: this.getData() == {"_id": "User_some-unique-id-of-associated-doc"}
        let assoc = rel.path.length ? _.get(data, rel.path) : data;

        //unify data interface
        let arrayOfRelations = true;
        if (!Array.isArray(assoc)) {
            assoc = [assoc];
            arrayOfRelations = false;
        }

        return Promise.map(assoc, function(association, index) {
            /* istanbul ignore if */
            if (!(association instanceof modelManager.get(rel.type).Instance)) {
                return null;//continue (should never happen)
            }
            return serialize.call(instance, association).then(function(serializedData) {
                if (arrayOfRelations) {
                    assoc[index] = serializedData;
                } else if (!rel.path.length) {
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
 * populates model's referenced associations
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
    const instance = this;
    const defaults = {
        skipPopulated: true,
        getOrFail: false
    };

    options = Object.assign(defaults, _.clone(options));

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
                return _refreshAssociation(assoc, populate, options);
            });
        } else if (association instanceof Instance) {
            return _refreshAssociation(association, populate, options);
        } else {
            throw new InstanceError(
                instance.Model.name + "'s data " + (path ? 'located at ' + path : '') +
                "is not " + instance.Model.name + "'s Instance object"
            );
        }
    }).return(instance);
});


/**
 * @private
 */
function _refreshAssociation(assoc, populate, options) {

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

/**
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
 * @private
 * @return {Mixed}
 */
Instance.prototype.$cloneOptions = function() {
    return  _.cloneDeepWith(this.options, function(val) {
        if (val instanceof Key) return val.clone();
    });
};

/**
 * @return {Instance}
 */
Instance.prototype.clone = function() {

    const self = this;

    const clone = new this.Model.Instance(this.$cloneData(), self.$cloneOptions());

    clone.$original = new this.Model.Instance(
            this.$cloneData(),
            self.$cloneOptions()
    );
    return clone;
};

/**
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
   if (arguments.length == 1 && _.isPlainObject(arguments[0])) {
        let data = arguments[0];

        let keys = Object.keys(data);
        keys = _.without(keys,
                this.$schemaSettings.doc.idPropertyName,
                this.$schemaSettings.doc.typePropertyName
                );

        for (let i = 0, len = keys.length; i < len; i++) {
            this.options.data[keys[i]] = data[keys[i]];
        }
        return this;
    } else {
        return this.super.setData.apply(this, arguments);
    }
};

/**
 * Explicitly fetches itself from upstream.
 * Works also with destroyed documents which have been soft-deleted due to paranoid=true option
 *
 * @return {Promise<Instance>}
 */
Instance.prototype.refresh = function() {
    return this.super.refresh.call(
        this
    ).bind(this).then(function(instance) {
        setOriginal.call(this);
        this.$initRelations();
        return this;
    });
};

/**
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
 * returns collection of reference {@link Document Documents} of the Model instance.
 *
 * @function
 * @return {Promise<Array<Document>>}
 */
Instance.prototype.getRefDocs = Promise.method(function() {

    if (!this.Model.$dataHasJsonStructure()) {
        return Promise.resolve([]);
    }

    const refDocs = this.Model.options.indexes.refDocs;
    const refDocIndexNames = Object.keys(refDocs);
    const out = [];

    return Promise.resolve(refDocIndexNames).bind(this).map(function(indexName) {
        const refDocOptions = refDocs[indexName];

        return this.$buildRefDocument({
            index: indexName
        }).tap(function(doc) {
            return doc.getGeneratedKey();
        }).then(function(doc) {
            out.push(doc);
        }).catch(KeyError, function(err) {
            if (refDocOptions.required === false) {
                return null;
            }
            return Promise.reject(err);
        });
    }).then(function(refDocs) {
        return out;
    });
});

/**
 * returns two collections of reference documents one of which are changed `current` and are going to be
 * persisted to db and other collection of outdated ref docs `old` which should be removed
 * from bucket in order to fulfill update process of a refdoc indexes
 *
 * @private
 * @function
 * @return {Object}
 */
Instance.prototype.$getDirtyRefDocs = Promise.method(function() {

    const self = this;
    const out = {
        current: [],//collection of current ref-documents which will be persisted to the bucket
        old: [] //collection of outdated ref-documents which will be removed from the bucket
    };

    if (!this.Model.$dataHasJsonStructure()) {
        return Promise.resolve(out);
    }

    const refDocs = self.Model.options.indexes.refDocs;
    const refDocIndexNames = Object.keys(refDocs);

    //pupulate `out` collection
    return Promise.map(refDocIndexNames, function(indexName) {
        const refDocOptions = refDocs[indexName];

        const docPool = {};

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

            const keyPool = {
                key: this.doc.getGeneratedKey().reflect(),
                oldKey: this.oldDoc.getGeneratedKey().reflect()
            }

            return Promise.props(keyPool).bind(this).then(function(result) {
                const key = this.doc.getKey();
                const oldKey = this.oldDoc.getKey();

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


                const required = refDocOptions.required;
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
                    let reason = null;
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
 * shortcut method for calling {@link Instance#replace} / {@link Instance#insert}. if fresh instance is initialized
 * and the data are not persisted to bucket yet, `insert` is called. If the Instance
 * is already persisted, data are updated with `replace` method
 *
 * @function
 * @param {Object} [options] - either {@link StorageAdapter#insert} or {@link StorageAdapter#replace} options depending on whether the document is being saved for the first time
 * @return {Promise<Instance>}
 */
Instance.prototype.save = Promise.method(function(options) {
    if (this.options.isNewRecord) {
        return this.insert(options);
    }
    return this.replace(options);
});

/**
 * This is similar to seting data on the instance and then calling {@link Instance#save},
 * (respectively {@link Instance#replace}) however in this case when the operation failes,
 * the Model's instance data are restored to the previous state.
 *
 * @param {Object} data
 * @param {Object} [options] - see {@link StorageAdapter#replace} for available options
 *
 * @function
 * @return {Instance}
 */
Instance.prototype.update = Promise.method(function(data, options) {

    const self = this;
    const backup = this.$cloneData();

    self.setData(data);

    return this.save(options).catch(function(err) {
        self.setData(backup);
        const currentData = self.getData();

        _.difference(
                Object.keys(data),
                Object.keys(backup)
        ).forEach(function(propName) {
            delete currentData[propName];
        });

        return Promise.reject(err);
    });
});

/**
 * deletes the document and all related reference documents from a bucket
 *
 * @param {Object}  [options] - See `StorageAdapter.remove` for available options
 * @param {Boolean} [options.force=false] - performs destoy operation even with no `cas` value set
 *
 * @function
 * @return {Promise}
 */
Instance.prototype.destroy = Promise.method(function(options) {

    const self = this;
    options = options || {};

    if (!this.hasCAS() && !options.force) {
        return Promise.reject(new InstanceError('Can not destroy a Model instance without the `cas` value being set'));
    }

    return this.Model.runHooks(HookTypes.beforeDestroy, this, options).then(function() {
        return self.getRefDocs();
    }).bind({}).then(function(docs) {//remove ref docs
        this.docs = docs;
        this.timestamps = self.$touchTimestamps(undefined, {touchDeletedAt: true});
        return self.getStorageAdapter()
            .bulkRemoveSync(docs, options);
    }).then(function() {//remove the doc
        const opt = _.assign({cas: self.getCAS()}, options);

        if (self.Model.options.paranoid) {
            return self.super.replace.call(self, opt);
        }
        return self.remove(opt);
    }).then(function(result) {// resolve successful destroy operation
        if (!self.Model.options.paranoid) {
            self.options.isNewRecord = true;
        }
        return self.Model.runHooks(HookTypes.afterDestroy, self, options).return(self);
    }).catch(StorageError, function(err) {// rollback deleted refdocs
        let docs = this.docs;
        const failedIndex = this.docs.indexOf(err.doc);
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

    const self = this;
    let   report
        , timestampsBck;

    //touch timestamps, backup previous timestamps values
    timestampsBck = this.$touchTimestamps();

    //run beforeCreate hooks
    return this.Model.runHooks(HookTypes.beforeCreate, this, options).then(function() {

        //validate
        try {
            self.sanitize();
        } catch(e) {
            self.$touchTimestamps(timestampsBck);
            return Promise.reject(e);
        }

        //begin insert process
        return self.getRefDocs();
    }).bind({}).then(function(docs) {//Insert ref docs
        this.docs = docs;
        this.timestamps = timestampsBck;
        return self.getStorageAdapter().bulkInsertSync(docs, options);
    }).then(function() {//Insert the doc
        return self.super.insert.call(self, options);
    }).then(function(result) {//Resolve successful `insert` operation
        self.options.isNewRecord = false;
        setOriginal.call(self);

        return self.Model.runHooks(HookTypes.afterCreate, self, options).return(self);
    }).catch(StorageError, function(err) {//try to rollback inserted refdocs

        var docs = this.docs;
        const failedIndex = this.docs.indexOf(err.doc);
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
 * replaces (updates) current document (fails if the document with the key does not exists) in a bucket
 * and synchronizes reference documents (indexes). If an error occur,
 * an attempt for rollback is made, if the rollback fails,
 * the `afterFailedRollback` hook is triggered for every document an atempt for rollback failed (includes failed refdocs operations)
 *
 * @param {Object}  [options] - See `StorageAdapter.replace` for available options
 * @param {Boolean} [options.force=false] - performs replace operation even with no `cas` value set
 *
 * @function
 * @return {Promise<Instance>}
 */
Instance.prototype.replace = Promise.method(function(options) {

    const self = this;
    let timestampsBck;
    options = options || {};

    if (!this.hasCAS() && !options.force) {
        return Promise.reject(new InstanceError('Can not call the replace (update) method on a Model instance without the `cas` value being set'));
    }

    //touch timestamps, backup previous timestamps values
    timestampsBck = this.$touchTimestamps();

    //run beforeUpdate hooks
    return this.Model.runHooks(HookTypes.beforeUpdate, this, options).then(function() {

        //validate & sanitize data
        try {
            self.sanitize();
        } catch(e) {
            self.$touchTimestamps(timestampsBck);
            return Promise.reject(e);
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
        const failedIndex = this.refDocs.indexOf(err.doc);
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

    const timestamps = options.timestamps;
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
        const storage = this.instance.getStorageAdapter();
        return storage[rollbackMethod](this.docs);
    }).each(function(result, index, length) {
        if (result.isRejected()) {
            this.instance.Model.runHooks(HookTypes.afterFailedRollback, result.reason(), this);
        }
        return null;
    }).then(function() {
        return this.instance.Model.runHooks(HookTypes.afterRollback, this);
    }).return(Promise.reject(options.err));
};

/**
 * touches underlaying document and all its reference documents
 * when an Error occurs, it tries to touch all remaining documents before failing
 *
 * @throws StorageError
 * @param {integer} expiry - time in seconds
 * @param {Object} options - see {@link StorageAdapter#touch} for available options
 * @function
 * @return {Promise<Instance>}
 */
Instance.prototype.touch = Promise.method(function(expiry, options) {
    var ops = [];

    ops.push(this.super.touch.call(this, expiry, options));

    return this.getRefDocs().each(function(refDoc) {
        ops.push(refDoc.touch(expiry, options));
    }).then(function() {
        return Promise.all(ops);
    }).return(this);
});

/**
 * @throws InstanceError
 * @return {Object}
 */
Instance.prototype.toJSON = function() {
    //if (!this.Model.$dataHasJsonStructure()) {
        //throw new InstanceError("Can NOT convert document value of primitive type to JSON");
    //}
    const data = this.$cloneData();

    if (this.Model.$dataHasObjectStructure()) {
        var typePropName = this.$schemaSettings.doc.typePropertyName;
        delete data[typePropName];
    }
    return data;
};

/**
 * @param {Object} obj - object to which properties will be bind to
 * @param {Object} properties
 * @param {boolean} [forceRebinding=false] - if it's true, existing properties on the instance are redefined
 *
 * @private
 * @return {undefined}
 *
 */
function bindDataProperties(obj, properties, forceRebinding) {
    const keys = Object.keys(properties);

    for (let i = 0, len = keys.length; i < len; i++) {
        let name = keys[i];
        if (!obj.hasOwnProperty(name) || forceRebinding === true) {
            let prop = properties[name];
            Object.defineProperty(obj, name, {
                enumerable: true,
                configurable: true,
                set: function(value) {
                    this.setData(name, value);
                },
                get: function() {
                    return this.getData(name);
                }
            });
        }
    }
}

/**
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

    let data = this.getData();

    let propNames = this.Model.$getTimestampPropertyNames();

    var oldTimestamps = {};
    oldTimestamps[propNames.createdAt] = data[propNames.createdAt];
    oldTimestamps[propNames.updatedAt] = data[propNames.updatedAt];
    oldTimestamps[propNames.deletedAt] = data[propNames.deletedAt];

    if (_.isPlainObject(timestamps)) {
        _.assign(data, timestamps);
        return oldTimestamps;
    }

    const now = moment.utc().format();

    if (!data[propNames.createdAt]) {
        data[propNames.createdAt] = now;
    }

    data[propNames.updatedAt] = now;

    if (options.touchDeletedAt === true) {

        if (!data[propNames.deletedAt]) {
            data[propNames.deletedAt] = now;
        }
    }

    return oldTimestamps;
};

/*
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
