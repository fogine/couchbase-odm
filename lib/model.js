const util    = require('util');
const _       = require("lodash");
const Promise = require('bluebird');

const StorageAdapter = require("./storageAdapter");
const Instance       = require("./instance.js");
const Key            = require("./key/key.js");
const UUID4Key       = require("./key/uuid4Key.js");
const RefDocKey      = require("./key/refDocKey.js");
const ModelError     = require("./error/modelError.js");
const StorageError   = require("./error/storageError.js");
const Hook           = require("./hook.js");
const schemaUtils    = require('./util/schema.js');
const dataUtils      = require('./util/data.js');
const validator    = require('./validator.js');

const HookTypes = Hook.types;

module.exports = Model;

/**
 * Model
 *
 * @constructor
 * @extends {Hook}
 * @throws {ModelError}
 *
 * @param {string}    name - name of the Model
 * @param {Object}    schema - structure definition of stored data
 * @param {Object}    [options]
 * @param {Key}       [options.key=UUID4Key] - The strategy used for document's `key` generation. Must inherit from base `Key` class
 * @param {RefDocKey} [options.refDocKey=RefDocKey] - The strategy used for reference document `key` generation. Must inherit from base `RefDocKey` class
 * @param {boolean}   [options.timestamps=true] - Adds automatically handled timestamp schema properties: `created_at`, `updated_at` and if `paranoid` option is true, `deleted_at` property
 * @param {boolean}   [options.paranoid=false] - if `true` is set, a document is not actually removed from `bucket` but rather `deleted_at` flag on the document is set. aka. `soft delete`
 * @param {boolean}   [options.camelCase=false] - if `true` is set, camel case notation is used for document's internal properties.
 * @param {Object}    [options.schemaSettings] - allows to modify default values used for document's `key` generation and document's property names handled by ODM
 * @param {Object}    [options.schemaSettings.key]
 * @param {string}    [options.schemaSettings.key.prefix] - defaults to Model's name
 * @param {string}    [options.schemaSettings.key.postfix=""]
 * @param {string}    [options.schemaSettings.key.delimiter="_"]
 * @param {Object}    [options.schemaSettings.doc]
 * @param {string}    [options.schemaSettings.doc.idPropertyName="_id"] - `_id` contains generated id of document (not whole document's key)
 * @param {string}    [options.schemaSettings.doc.typePropertyName="_type"] - `_type` contains the name of a Model
 * @param {Object}    [options.hooks] - allows to add one or more hooks of a hook type (eg. `afterValidate`)
 * @param {Object}    [options.classMethods] - custom method definitions which are bound to a Model.
 * @param {Object}    [options.instanceMethods] - custom method definitions which are bound to a Instance.
 * @param {Bucket}    [options.bucket] - must be instance of Couchbase.Bucket (from official nodejs couchbase sdk)
 * @param {Object}    [options.indexes]
 * @param {Object}    [options.indexes.refDocs] - reference documents definitions aka. custom application layer index support. ref. doc. is a document which reference parent document  with its string value=key
 */
function Model(name, schema, options) {

    if (!name || (typeof name !== "string" && !(name instanceof String) )) {
        throw new ModelError("Model's name must be non-empty string value");
    }

    options.schemaSettings.key.prefix = options.schemaSettings.key.prefix || name;
    options.name = name;
    options.schema = schema;

    if (typeof options.key !== "function") {
        throw new ModelError("The `key` is not a constructor object (function)");
    } else if(!(options.key.prototype instanceof Key)) {
        var constructorName = options.key.prototype.constructor.name;
        throw new ModelError("The " + constructorName + " class must inherit from `Key` abstract class");
    }

    /**
     * $private
     * @name Model#schema
     * @instance
     * @type {Object}
     */
    Object.defineProperty(this, "schema", {
        enumerable: true,
        configurable: false,
        writable: false,
        value: schema
    });

    /**
     * $private
     * @name Model#options
     * @instance
     * @type {Object}
     */
    Object.defineProperty(this, "options", {
        enumerable: true,
        configurable: false,
        value: options
    });

    /**
     * @name Model#name
     * @instance
     * @type {string}
     */
    Object.defineProperty(this, "name", {
        enumerable: true,
        writable: false,
        configurable: false,
        value: name
    });

    /**
     * @name Model#storage
     * @instance
     * @type {StorageAdapter}
     */
    Object.defineProperty(this, "storage", {
        enumerable: true,
        configurable: false,
        value: new StorageAdapter({bucket: options.bucket})
    });

    /**
     * @private
     * @name Model#relations
     * @instance
     * @type {Array<Object>}
     */
    Object.defineProperty(this, "relations", {
        enumerable: true,
        configurable: false,
        writable: true,
        value: []
    });

    /**
     * @private
     * @name Model#validator
     * @instance
     * @type {Ajv}
     */
    Object.defineProperty(this, "validator", {
        enumerable: true,
        configurable: false,
        writable: false,
        value: validator
    });

    /**
     * default property value[s] extracted from schema
     * @private
     * @name Model#defaults
     * @instance
     * @type {mixed}
     */
    this.defaults = null;
}

Model.validator = validator;

/**
 * attach hooks methods to Model, Model.prototype
 */
Hook.applyTo(Model);

/**
 * $init
 *
 * Sets up dependencies and registers the Model in cache register
 *
 * @throws {ModelError}
 *
 * @private
 * @return {undefined}
 */
Model.prototype.$init = function(modelManager) {

    var self = this;

    this.$modelManager = modelManager;

    if (!this.options.key.hasOwnProperty('dataType')) {
        throw new ModelError('`options.key` class must expose `dataType` property with valid data type');
    }

    this.validator.addSchema(this.options.schema, this.name);

    this.defaults = schemaUtils.extractDefaults(this.schema);
    this.relations = schemaUtils.extractAssociations(this.options.schema);

    if (this.$dataHasObjectStructure()) {
        if (this.options.timestamps === true) {
            schemaUtils.addTimestampProperties.call(this);
        } else if (this.options.paranoid === true) {
            //TODO paranoid should not enable other timestamps
            this.options.timestamps = true;
            schemaUtils.addTimestampProperties.call(this);
        }
        //add schema properties like `_type`, `_id`
        schemaUtils.addInternalDocProperties.call(this);
    }

    //make sure root data object is set when applying the defaults
    if (this.$dataHasJsonStructure()) {
        if (this.$dataHasObjectStructure()) {
            this.defaults.unshift({path: undefined, default: {}, defaults: []});
        } else {
            this.defaults.unshift({path: undefined, default: [], defaults: []});
        }
    }

    //bind Key class
    this.Key = function ModelKey() {
        self.options.key.apply(this, arguments);
    };
    util.inherits(this.Key, this.options.key);

    //bind RefDocKey class
    this.RefDocKey = function ModelRefDocKey() {
        self.options.refDocKey.apply(this, arguments);
    };
    util.inherits(this.RefDocKey, this.options.refDocKey);

    //bind Instance class
    this.Instance = function ModelInstance() {
        Instance.apply(this, arguments);
    };
    util.inherits(this.Instance, Instance);
    this.Instance.prototype.Model = this;

    //attach class methods
    var classMethods = this.options.classMethods;
    Object.keys(classMethods).forEach(function(name) {
        if (typeof self[name] == 'function') {
            self[name] = classMethods[name].bind(self, self[name]);
        } else if(!self[name]) {
            self[name] = classMethods[name].bind(self);
        }
    });

    //attach instance methods
    var instanceMethods = this.options.instanceMethods;
    Object.keys(instanceMethods).forEach(function(name) {
        if ( typeof self.Instance.prototype[name] == 'function') {
            var _parentMethod = self.Instance.prototype[name];
            var method = function() {
                return instanceMethods[name].call(this, _parentMethod);
            };
            self.Instance.prototype[name] = method;
        } else if(!self.Instance.prototype[name]) {
            self.Instance.prototype[name] = instanceMethods[name];
        }
    });

    //attach "get by reference document" methods
    attachGetByRefDocMethods.call(this);

    this.validator._registerCouchbaseType(this.name, this.Instance);
};

/**
 * $dataHasJsonStructure
 *
 * @private
 * @return {boolean}
 */
Model.prototype.$dataHasJsonStructure = function() {
    if (   this.options.schema.type === 'object'
        || this.options.schema.type === 'array'
    ) {
        return true;
    }
    return false;
};

/**
 * $dataHasObjectStructure
 *
 * @private
 * @return {boolean}
 */
Model.prototype.$dataHasObjectStructure = function() {
    if (this.options.schema.type === 'object') {
        return true;
    }
    return false;
};

/**
 * $getTimestampPropertyNames
 *
 * @private
 * @return {Object}
 */
Model.prototype.$getTimestampPropertyNames = function() {
    var namesMap = {
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at'
    };
    if (this.options.camelCase === true) {
        namesMap.createdAt = 'createdAt';
        namesMap.updatedAt = 'updatedAt';
        namesMap.deletedAt = 'deletedAt';
    }
    return namesMap;
};


/**
 * $getInternalProperties
 *
 * @private
 * @return {Object}
 */
Model.prototype.$getInternalProperties = function() {

    var props = {};

    if (!this.$dataHasObjectStructure()) {
        return props;
    }

    var idPropName = this.options.schemaSettings.doc.idPropertyName;
    var typePropName = this.options.schemaSettings.doc.typePropertyName;

    props[idPropName] = this.options.schema.schema[idPropName];
    props[typePropName] = this.options.schema.schema[typePropName];

    if (this.options.timestamps === true) {
        var timestampNames = this.$getTimestampPropertyNames();

        props[timestampNames.createdAt] = this.options.schema.schema[timestampNames.createdAt];
        props[timestampNames.updatedAt] = this.options.schema.schema[timestampNames.updatedAt];

        if (this.options.paranoid) {
            props[timestampNames.deletedAt] = this.options.schema.schema[timestampNames.deletedAt];
        }
    }

    return props;
};

/**
 * buildKey
 *
 * return new instance of document's primary key
 *
 * @param {string}  [id]
 * @param {Object}  [options]
 * @param {boolean} [options.parse=false] - if true, `id` argument will be
 *                             treated as whole document's `key` string.
 *                             By default `id` is presumed to be only "dynamic part of document's key"
 * @return {Key}
 */
Model.prototype.buildKey = function(id, options) {
    var defaults = {
        parse: false
    };

    options = _.assign(defaults, options);

    var keyOptions = _.cloneDeep(this.options.schemaSettings.key);
    if (id !== undefined && !options.parse) {
        keyOptions.id = id;
    }
    var key = new this.Key(keyOptions);

    if (options.parse) {
        key.parse(id); //id = whole document's key here
    }
    return key;
};

/**
 * buildRefDocKey
 *
 * return new instance of RefDocKey = primary key of a document referencing parent
 * document with it's value
 *
 * @param {string|Array} [id]
 * @param {Object}       options
 * @param {String}       options.index - index name - one of the keys from `options.indexes.refDocs` object of Model options
 * @param {Boolean}      [options.parse=false]
 *
 * @return {RefDocKey}
 */
Model.prototype.buildRefDocKey = function(id, options) {
    var defaults = {
        parse: false
    };

    options = _.assign(defaults, options);
    var indexOptions = _.cloneDeep(this.options.indexes.refDocs[options.index]) || {};
    indexOptions.ref = indexOptions.keys;
    delete indexOptions.keys;

    if (!options.parse) {
        indexOptions.id = id;
    }

    indexOptions = _.assign({}, this.options.schemaSettings.key, indexOptions);
    var key = new this.RefDocKey(indexOptions);

    if (options.parse) {
        key.parse(id); //id = whole document's key string here
    }

    return key;
};

/**
 * build
 *
 * builds new instance object
 *
 * @param {mixed}      data - In case an Object or an Array is provided, the data value is NOT cloned!
 * @param {Object}     [options]
 * @param {boolean}    [options.isNewRecord=true]
 * @param {boolean}    [options.sanitize=false] - if true, data values are validated, an attempt is made to convert property values to correct type
 * @param {CAS}        [options.cas]
 * @param {Key|string} [options.key] - instance of Key or valid string `id` (-> dynamic part of Key) should be provided if the isNewRecord=false that meens the document is persisted in storage
 *
 * @throws {ValidationError}
 * @return {Instance}
 */
Model.prototype.build = function(data, options) {
    var defaults = {
        isNewRecord: true,
        sanitize: false
    };
    options = _.assign(defaults, options);

    //prepare options object
    if (options.key === undefined || typeof options.key === "string") {
        //options.key is `id` here (not whole key string)
        options.key = this.buildKey(options.key);
    }

    //apply default values
    if (options.isNewRecord) {
        data = dataUtils.applyDefaults(this.defaults, data);
    }

    //build
    var instance = new this.Instance(data, {
        isNewRecord: options.isNewRecord,
        key: options.key,
        cas: options.cas
    });

    instance.$initRelations();

    if (options.sanitize === true) {
        instance.sanitize();
    }

    var copy = instance.clone();
    instance.$original = copy;

    return instance;
};

/**
 * create
 *
 * @param {Object}     data
 * @param {Object}     [options] - see {@link StorageAdaper#insert} options
 * @param {string|Key} [options.key] - the key under which a document should be saved. Can be instance of `Key` or valid string `id` (-> dynamic part of Key)
 *
 * @function
 * @return Promise<Instance>
 */
Model.prototype.create = Promise.method(function(data, options) {
    var key;

    if (_.isPlainObject(options)) {
        key = options.key;
        delete options.key;
    }

    var doc = this.build(data, {key: key});

    return doc.save(options).return(doc);
});

/**
 * getByIdOrFail
 *
 * if a key is not found, it returns rejected promise with StorageError which has appropriate error code
 *
 * @param {string|Key}    id
 * @param {object}        [options]
 * @param {boolean}       [options.plain] - if true, raw data are returned
 * @param {integer}       [options.lockTime] - time in seconds (max=30)
 * @param {integer}       [options.expiry] - time in seconds. if provided, the method performs `touch` operation on document, returning the most recent document data
 * @param {boolean}       [options.hooks=true] - if false, `hooks` are not run
 * @param {boolean}       [options.paranoid=true] - if false, both deleted and non-deleted documents will be returned. Only applies if `options.paranoid` is true for the model.
 *
 * @function
 * @return Promise<Instance>
 */
Model.prototype.getByIdOrFail = Promise.method(function(id, options) {
    var key = id;
    var actions = [];
    var defaults = {
        paranoid: true,
        hooks: true,
    };
    options = _.merge(defaults, options);

    if (!(id instanceof this.Key)) {
        key = this.buildKey(id);
    }

    //beforeGet hooks
    var promise;
    if (options.hooks === true) {
        promise = this.runHooks(HookTypes.beforeGet, key, options);
    } else {
        promise = Promise.resolve();
    }

    //manage action performed according to expiry & lockTime options
    //note: getAndTouch is same as touch method of sdk bucket

    //if paranoid option is set it will perform extra get query to check whether the doc is soft-deleted
    if (this.options.paranoid === true) {//model.options.paranoid
        actions.push(get);
    }
    if (options.expiry) actions.push(getAndTouch);
    if (options.lockTime) actions.push(getAndLock);
    if (!this.options.paranoid && !actions.length) actions.push(get);

    //perform get
    return promise.bind(this).then(function() {
        var self = this;
        var opt = _.clone(options);
        if (this.options.paranoid === true) {
            //we don't want to expose internal options to eg.: hooks methods
            opt.deletedAtPropName = this.$getTimestampPropertyNames().deletedAt;
        }
        return Promise.mapSeries(actions, function(action, index) {
            return action(self.storage, key, opt);
        });
    }).then(function(results) { // build instance
        var doc = results.pop();

        if (options.plain === true) {
            return doc;
        }

        return this.build(doc.value, {
            key: key,
            cas: doc.cas,
            sanitize: false,
            isNewRecord: false
        });
    }).then(function(instance) { //set expiration for each reference document
        if (options.expiry) {
            return instance.getRefDocs().map(function(doc){
                return doc.touch(options.expiry, {cas: doc.getCAS()});
            }).return(instance);
        }

        return instance;

    }).tap(function(doc) { // run afterGet hooks
        if (options.hooks === false) {
            return doc;
        }
        return this.runHooks(HookTypes.afterGet, doc, options);
    });

    //method definitions
    function getAndLock(storage, key, options) {
        return storage.getAndLock(key, {lockTime: options.lockTime});
    }
    function getAndTouch(storage, key, options) {
        return storage.getAndTouch(key, options.expiry);
    }
    function get(storage, key, options) {
        return storage.get(key, options);
    }
});

/**
 * getById
 *
 * if a key is not found, it returns resolved promise with null value
 *
 * @see {@link Model#getByIdOrFail} arguments
 * @function
 * @return Promise<Instance|null>
 */
Model.prototype.getById = Promise.method(function() {
    return this.getByIdOrFail.apply(this, arguments)
    .catch(function(err) { // mute the keyNotFound error

        if (   err instanceof StorageError
                && err.code === StorageAdapter.errorCodes.keyNotFound
           ) {
            return null;
        }
        return Promise.reject(err);
    });
});

/**
 * getMulti
 *
 * if a operation fails to get a `id` from `ids` array,
 * a StorageError is returned in place of resulting value
 * in returned collection/map.
 *
 * @example
 * //PSEUDOCODE:
 *
 * var ids = [
 *     '829f52b2-f168-4538-8884-b5ad9054e391',
 *     'nonexistent-id'
 * ];
 *
 * // Indexed results
 * Model.getMulti(ids, {indexed: true}).then((result) => {
 *     console.log(result);
 * });
 *
 * // The above prints:
 *     {
 *         data: {
 *             '829f52b2-f168-4538-8884-b5ad9054e391': Document, // object
 *             'nonexistent-id': Error // object
 *         },
 *         failed: ['nonexistend-id'],
 *         resolved: [Document]
 *     }
 *
 * // Non-indexed results
 * Model.getMulti(ids, {indexed: false}).then((result) => {
 *     console.log(result);
 * });
 *
 * // The above prints:
 *     {
 *         data: [
 *             Document, //object
 *             Error //object
 *         ],
 *         failed: [1], // collection of indexes referencing data array items
 *         resolved: [Document]
 *     }
 *
 * @param {Array<string|Key>} ids
 * @param {Object}            [options]
 * @param {boolean}           [options.plain=false] - if true, Instances are not built and raw results are collected instead
 * @param {integer}           [options.lockTime] - time in seconds (max=30)
 * @param {integer}           [options.expiry] - time in seconds
 * @param {boolean}           [options.hooks=true] - if false, `hooks` are not run
 * @param {boolean}           [options.indexed=true] - if true, a results are indexed by document's `id` value, otherwise an array of results is collected
 * @param {boolean}           [options.individualHooks=false] - if true, `hooks` are run for each get query. if set to false, hooks are only run once before and after `getMulti` operation
 * @param {boolean}           [options.paranoid=true] - if false, both deleted and non-deleted documents will be returned. Only applies if `options.paranoid` is true for the model.
 *
 * @throws {KeyError}
 * @function
 * @return {Promise<Object>}
 */
Model.prototype.getMulti = Promise.method(function(ids, options) {

    var defaults = {
        indexed         : true,
        hooks           : true,
        paranoid        : true,
        individualHooks : false,
        plain           : false
    };

    options = _.assign(defaults, options);

    var self = this;
    var promise;
    var out = {
        failed: [],
        resolved: [],
        data: options.indexed === true ? {} : []
    };

    var runHooks = options.hooks;

    if (runHooks !== false && options.individualHooks !== true) {
        promise = this.runHooks(HookTypes.beforeGet, ids, options).return(ids);
    } else {
        promise = Promise.resolve(ids);
    }

    if (!options.individualHooks) {
        options.hooks = false;
    }

    return promise.map(function(id, index) {

        if (options.indexed === true) {
            if (id instanceof self.Key) {
                index = id.getId();
            } else {
                index = id.toString();
            }
        }

        return self.getByIdOrFail(id, options).then(function(doc) {
            out.data[index] = doc;
            out.resolved.push(doc);
        }).catch(function(err) {
            out.data[index] = err;
            out.failed.push(index);
        });
    }).return(out).tap(function(out) {
        if (runHooks !== false && options.individualHooks !== true) {
            return self.runHooks(HookTypes.afterGet, out, options);
        }
    });
});

/**
 * remove
 *
 * @param {string|Key} id
 *
 * @function
 * @return {Promise<Instance>}
 */
Model.prototype.remove = Promise.method(function(id) {
    //must be handled this way, because of reference decuments
    return Model.prototype.getByIdOrFail.call(this, id).then(function(instance) {
        return instance.destroy();
    });
});

/**
 * touch
 *
 * @param {string|Key} id
 * @param {integer}    expiry
 *
 * See {@link StorageAdapter#touch} for more information
 *
 * @function
 * @return {Promise<Object>}
 */
Model.prototype.touch = Promise.method(function(id, expiry) {
    var key = id;
    if (!(id instanceof this.Key)) {
        key = this.buildKey(id);
    }

    return this.storage.touch(key, expiry);
});

/**
 * unlock
 *
 * @param {string|Key} id
 * @param {CAS} cas
 *
 * @function
 * @return {Promise<Object>}
 */
Model.prototype.unlock = Promise.method(function(id, cas) {
    var key = id;
    if (!(id instanceof this.Key)) {
        key = this.buildKey(id);
    }

    return this.storage.unlock(key, cas);
});

/**
 * exists
 *
 * @param {string|Key} id
 *
 * @function
 * @return {Promise<Object>}
 */
Model.prototype.exists = Promise.method(function(id) {
    var key = id;
    if (!(id instanceof this.Key)) {
        key = this.buildKey(id);
    }

    return this.storage.exists(key);
});

/**
 * attachGetByRefDocMethods
 *
 * binds methods like: getBy{schemaPropertyName}
 * eg.: getByUsername()
 *
 * @private
 * @return {undefined}
 */
function attachGetByRefDocMethods() {
    var self = this;
    var getByRefDocPrefix = 'getBy';
    var refDocs = this.options.indexes.refDocs;

    Object.keys(refDocs).forEach(function(indexName) {
        var getByRefDocFnName = getByRefDocPrefix + _.upperFirst(_.camelCase(indexName));
        var getByRefDocOrFailFnName = getByRefDocPrefix + _.upperFirst(_.camelCase(indexName)) + 'OrFail';

        //register getByRefDoc method
        //id can be string|Array|RefDocKey see Model.$getByRefdoc method for more info
        self[getByRefDocFnName] = Promise.method(function(id, options) {
            options = _.clone(options || {});
            if (!(id instanceof self.RefDocKey)) {
                id = self.buildRefDocKey(id, {
                    index: indexName,
                    parse: false
                });
            }

            return self.$getByRefDoc(id, options);
        });

        //register getByRefDocOrFail method
        //id can be string|Array|RefDocKey see Model.$getByRefDocOrFail method for more info
        self[getByRefDocOrFailFnName] = Promise.method(function(id, options) {
            options = _.clone(options || {});
            if (!(id instanceof self.RefDocKey)) {
                id = self.buildRefDocKey(id, {
                    index: indexName,
                    parse: false
                });
            }

            return self.$getByRefDocOrFail(id, options);
        });
    });
}

/**
 * $getByRefDoc
 *
 * @param {RefDocKey} key - unique index value/s a document should be searched by. Eg.: username/email value
 * @param {Object}    [options] - see {@link Model.getByRefDoc} options
 *
 * @private
 * @function
 * @return {Promise<Instance|Object>}
 */
Model.prototype.$getByRefDoc = Promise.method(function(key, options) {
    //get the reference document
    return this.$getByRefDocOrFail(key, options).catch(function(err) {
        if (   err instanceof StorageError
            && err.code === StorageAdapter.errorCodes.keyNotFound
           ) {
            return null;
        }
        return Promise.reject(err);
    });
});

/**
 * $getByRefDocOrFail
 *
 * @param {RefDocKey} key - unique index value/s a document should be searched by. Eg.: username/email value
 * @param {Object}    [options]
 * @param {boolean}   [options.plain] - if true, raw data are returned no instance is build
 * @param {integer}   [options.lockTime] - period of time in seconds for which parent document should be locked
 * @param {integer}   [options.expiry] - expiry time of parent document in seconds
 * @param {boolean}   [options.lean] - if true, parent document's `Key` object is returned, no document's data are fetched
 * @param {boolean}   [options.paranoid=true] - if false, both deleted and non-deleted documents will be returned. Only applies if global `options.paranoid` is true for the model.
 *
 * @private
 * @function
 * @return {Promise<Instance|Object>}
 */
Model.prototype.$getByRefDocOrFail = Promise.method(function(key, options) {
    //get the reference document
    return this.storage.get(key)
    .bind(this)
    .then(function(refDoc) {
        var parentKey = this.buildKey(refDoc.value, {parse: true});
        if (options.lean === true) {
            return parentKey;
        }
        //get the Instance with data
        return this.getByIdOrFail(parentKey, options);
    });
});

/**
 * toString
 *
 * @return {string}
 */
Model.prototype.toString = function() {
    return '[object CouchbaseModel:' + this.name + ']';
};

/**
 * inspect
 *
 * @private
 * @return {string}
 */
Model.prototype.inspect = Model.prototype.toString;
