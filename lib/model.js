var util        = require('util');
var _           = require("lodash");

var Promise        = require('bluebird');
var sanitizer      = require("./sanitizer");
var StorageAdapter = require("./storageAdapter");
var Instance       = require("./instance.js");
var Key            = require("./key/key.js");
var UUID4Key       = require("./key/uuid4Key.js");
var RefDocKey      = require("./key/refDocKey.js");
var ModelError     = require("./error/modelError.js");
var StorageError   = require("./error/storageError.js");
var DataType       = require("./dataType.js");
var DataTypes      = DataType.types;
var Hook           = require("./hook.js");
var HookTypes      = Hook.types;

module.exports = Model;

/**
 * Model
 *
 * @constructor
 * @extends {Hook}
 *
 * @param {string}  name - name of the Model
 * @param {Object}  schema - structure definition of stored data
 * @param {Object}  [options]
 * @param {Key}     [options.key=UUID4Key] - The strategy used for document's `key` generation. Must inherit from base `Key` class
 * @param {boolean} [options.timestamps=true] - Adds automatically handled timestamp schema properties: `created_at`, `updated_at` and if `paranoid` option is true, `deleted_at` property
 * @param {boolean} [options.paranoid=false] - if `true` is set, a document is not actually removed from `bucket` but rather `deleted_at` flag on the document is set. aka. `soft delete`
 * @param {boolean} [options.camelCase=false] - if `true` is set, camel case notation is used for document's internal properties.
 * @param {Object}  [options.schemaSettings] - allows to modify default values used for document's `key` generation and document's property names handled by ODM
 * @param {Object}  [options.schemaSettings.key]
 * @param {string}  [options.schemaSettings.key.prefix] - defaults to Model's name
 * @param {string}  [options.schemaSettings.key.postfix=""]
 * @param {string}  [options.schemaSettings.key.delimiter="_"]
 * @param {Object}  [options.schemaSettings.doc]
 * @param {string}  [options.schemaSettings.doc.idPropertyName="_id"] - `_id` contains generated id of document (not whole document's key)
 * @param {string}  [options.schemaSettings.doc.typePropertyName="_type"] - `_type` contains the name of a Model
 * @param {Object}  [options.hooks] - allows to add one or more hooks of a hook type (eg. `afterValidate`)
 * @param {Object}  [options.classMethods] - custom method definitions which are bound to a Model.
 * @param {Object}  [options.instanceMethods] - custom method definitions which are bound to a Instance.
 * @param {Bucket}  [options.bucket] - must be instance of Couchbase.Bucket (from official nodejs couchbase sdk)
 * @param {Object}  [options.indexes]
 * @param {Object}  [options.indexes.refDocs] - reference documents definitions aka. custom application layer index support. ref. doc. is a document which reference parent document  with its string value=key
 */
function Model(name, schema, options) {

    if (!name || (typeof name !== "string" && !(name instanceof String) )) {
        throw new ModelError("Model's name must be non-empty string value");
    }

    options.schemaSettings.key.prefix = options.schemaSettings.key.prefix || name;
    options.name = name;
    options.schema = schema;

    if (typeof options.key !== "function") {
        throw new ModelError("The `key` is not a constructor object");
    } else if(!(options.key.prototype instanceof Key)) {
        var constructorName = options.key.prototype.constructor.name;
        throw new ModelError("The " + constructorName + " class must inherit from `Key` abstract class");
    }

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
}

/**
 * attach hooks methods to Model, Model.prototype
 */
Hook.applyTo(Model);

/**
 * relations
 * @type {Array}
 */
Model.prototype.relations = [];

/**
 * $init
 *
 * Sets up dependencies and registers the Model in cache register
 *
 * @private
 * @return {undefined}
 */
Model.prototype.$init = function(modelManager) {

    var self = this;

    if (this.$dataHasObjectStructure()) {
        if (this.options.timestamps === true) {
            sanitizer.addTimestampProperties.call(this);
        } else if (this.options.paranoid === true) {
            this.options.timestamps = true;
            sanitizer.addTimestampProperties.call(this);
        }
        //add schema properties like `_type`, `_id`
        sanitizer.addInternalDocProperties.call(this);
    }

    //must be called before sanitizeSchema
    if (   !this.options.key.hasOwnProperty('dataType')
        || !DataType.exists(this.options.key.dataType)
    ) {
        throw new ModelError('`options.key` class must expose `dataType` property with valid data type');
    }

    var report = sanitizer.sanitizeSchema(this.options.schema);
    this.relations = report.getRelations();

    //bind Key class
    this.Key = function() {
        self.options.key.apply(this, arguments);
    };
    util.inherits(this.Key, this.options.key);

    //bind Instance class
    this.Instance = function() {
        Instance.apply(this, arguments);
    };
    util.inherits(this.Instance, Instance);
    this.Instance.prototype.Model = this;
    this.$modelManager = modelManager;

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
            var method = instanceMethods[name].bind(
                    self.Instance.prototype,
                    self.Instance.prototype[name]
            );
            self.Instance.prototype[name] = method;
        } else if(!self.Instance.prototype[name]) {
            self.Instance.prototype[name] = instanceMethods[name];
        }
    });

    //attach "get by reference document" methods
    attachGetByRefDocMethods.call(this);
}

/**
 * $dataHasJsonStructure
 *
 * @private
 * @return {boolean}
 */
Model.prototype.$dataHasJsonStructure = function() {
    if (   this.options.schema.type === DataTypes.HASH_TABLE
        || this.options.schema.type === DataTypes.ARRAY
    ) {
        return true;
    }
    return false;
}

/**
 * $dataHasObjectStructure
 *
 * @private
 * @return {boolean}
 */
Model.prototype.$dataHasObjectStructure = function() {
    if (this.options.schema.type === DataTypes.HASH_TABLE) {
        return true;
    }
    return false;
}

/**
 * $dataHasPrimitiveStructure
 *
 * @private
 * @return {boolean}
 */
Model.prototype.$dataHasPrimitiveStructure = function() {
    if (   this.options.schema.type !== DataTypes.HASH_TABLE
        && this.options.schema.type !== DataTypes.ARRAY
    ) {
        return true;
    }
    return false;
}

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
    }
    if (this.options.camelCase === true) {
        namesMap.createdAt = 'createdAt';
        namesMap.updatedAt = 'updatedAt';
        namesMap.deletedAt = 'deletedAt';
    }
    return namesMap;
}

/**
 * buildKey
 *
 * return new instance of document's primary key
 *
 * @param {string}  [id]
 * @param {boolean} [isWholeKey=false] - if true, `id` argument will be
 *                             treated as whole document's `key` string.
 *                             By default `id` is presumed to be only "dynamic part of document's key"
 * @return {Key}
 */
Model.prototype.buildKey = function(id, isWholeKey) {
    var options = _.cloneDeep(this.options.schemaSettings.key);
    if (id !== undefined && !isWholeKey) {
        options.id = id;
    }
    var key = new this.Key(options);

    if (isWholeKey) {
        key.parse(id); //id = whole document's key here
    }
    return key;
}

/**
 * $buildRefDocKey
 *
 * return new instance of RefDocKey = primary key of a document referencing parent
 * document with it's value
 *
 * @private
 *
 * @param {Object}       [input]
 * @param {string|Array} [input.id] - `optional`
 * @param {Array}        [input.ref] - `optional`
 *
 * @return {Key}
 */
Model.prototype.$buildRefDocKey = function(input) {
    var options = _.merge({}, this.options.schemaSettings.key, input);
    var key = new RefDocKey(options);

    return key;
}

/**
 * build
 *
 * builds new instance object
 *
 * @param {Object}     data
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
        isNewRecord: true
    }
    options = _.extend(defaults, options);
    var sanitize = options.sanitize || false;
    delete options.sanitize;

    //prepare options object
    if (options.key === undefined || typeof options.key === "string") {
        //options.key is `id` here (not whole key string)
        options.key = this.buildKey(options.key);
    }

    if (options.isNewRecord === true) {
        ////clone data?
        var data = _.cloneDeepWith(data, function(val) {
            if (val instanceof Instance) return val;
        });
    }

    if (this.$dataHasObjectStructure()) {
        data = data || {};
    }

    var instance = new this.Instance(data, options);

    if (sanitize === true) {
        instance.sanitize();
    }
    instance.$initRelations();

    var copy = instance.clone();
    instance.$original = copy;

    return instance;
}

/**
 * create
 *
 * @param {Object}     data
 * @param {Object}     [options] - see {@link StorageAdaper#insert} options
 * @param {string|Key} [options.key] - the key under which a document should be saved. Can be instance of `Key` or valid string `id` (-> dynamic part of Key)
 *
 * @return Promise<Instance>
 */
Model.prototype.create = function(data, options) {
    var key;

    if (_.isPlainObject(options)) {
        key = options.key;
        delete options.key;
    }

    var doc = this.build(data, {key: key});

    return doc.save(options).return(doc);
}

/**
 * getById
 *
 * @param {string|Key} id
 * @param {object}     [options]
 * @param {boolean}    [options.plain] - if true, raw data are returned
 * @param {integer}    [options.lockTime] - time in seconds (max=30)
 * @param {integer}    [options.expiry] - time in seconds. if provided, the method performs `touch` operation on document, returning the most recent document data
 * @param {boolean}    [options.hooks=true] - if false, `hooks` are not run
 * @param {boolean}    [options.paranoid=true] - if false, both deleted and non-deleted documents will be returned. Only applies if `options.paranoid` is true for the model.
 *
 * @return Promise<Instance>
 */
Model.prototype.getById = function(id, options) {
    var key = id;
    var actions = [];
    var defaults = {
        paranoid: true,
        hooks: true
    };
    options = _.merge(defaults, options);

    if (!(id instanceof this.Key)) {
        key = this.buildKey(id);
    }

    //hooks
    var promise;
    if (options.hooks === true) {
        promise = this.runHooks(HookTypes.beforeGet, key, options);
    } else {
        promise = Promise.resolve();
    }

    //manage action performed according to expiry & lockTime options
    //note: getAndTouch is same as touch method of sdk bucket

    //if paranoid options is set it will perform extra get query to check if the doc is soft-deleted or not
    if (this.options.paranoid === true) {//model.options.paranoid
        var propNames = this.$getTimestampPropertyNames();
        options.deletedAtPropName = propNames.deletedAt;
        actions.push(get);
    }
    if (options.expiry) actions.push(getAndTouch);
    if (options.lockTime) actions.push(getAndLock);
    if (!this.options.paranoid && !actions.length) actions.push(get);

    //perform get
    return promise.bind(this).then(function() {
        var self = this;
        return Promise.mapSeries(actions, function(action, index) {
            return action(self.storage, key, options);
        });
    }).then(function(results) {
        var doc = results.pop();

        if (options.plain === true) {
            return doc;
        }

        var instance = this.build(doc.value, {
            key: key,
            cas: doc.cas,
            isNewRecord: false
        });

        //set expiration for each reference document
        if (options.expiry) {
            return instance.$getRefDocs().map(function(doc){
                return doc.touch(options.expiry, {cas: doc.getCAS()});
            }).return(instance);
        }

        return instance;

    }).tap(function(doc) {
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
}

/**
 * getMulti
 *
 * if at least one of `ids` is found, no Error is throwed. Instead, if a operation
 * fails to get a `id` from `ids` array, a StorageError is returned in place of resulting value
 * in returned collection/list.
 *
 * if no `id` is found, the promise is rejected with `StorageMultiError`
 * which provides array of specific errors for each document under`err.errors`.
 *
 * if `indexed=true` returned list is in format where index is an `id` (not whole document's key) and value
 * is either instance of Instance or StorageError.
 *
 * if `indexed=false` the method returns an array of results.
 *
 * @param {Array<string|Key>} ids
 * @param {Object}            [options]
 * @param {boolean}           [options.plain=false] - if true, Instances are not built and raw results are returned instead
 * @param {integer}           [options.lockTime] - time in seconds (max=30)
 * @param {integer}           [options.expiry] - time in seconds
 * @param {boolean}           [options.hooks=true] - if false, `hooks` are not run
 * @param {boolean}           [options.indexed=true] - if true, a hash table indexed by `id` value is returned, otherwise an array of results is returned
 * @param {boolean}           [options.individualHooks=false] - if true, `hooks` are run for each get query. if set to false, hooks are only run once before and after `getMulti` operation
 * @param {boolean}           [options.paranoid=true] - if false, both deleted and non-deleted documents will be returned. Only applies if `options.paranoid` is true for the model.
 *
 * @throws {StorageMultiError}
 * @throws {KeyError}
 * @return {Promise<Object|Array>}
 */
Model.prototype.getMulti = function(ids, options) {

    var self = this;
    var promise;

    var defaults = {
        indexed         : true,
        hooks           : true,
        paranoid        : true,
        individualHooks : false,
        plain           : false
    };
    options = _.extend(defaults, options);

    var runHooks = options.hooks;

    if (runHooks !== false && options.individualHooks !== true) {
        promise = this.runHooks(HookTypes.beforeGet, ids, options).return(ids);
    } else {
        promise = Promise.resolve(ids);
    }

    if (!options.individualHooks) {
        options.hooks = false;
    }

    return promise.map(function(id) {
        return self.getById(id, options).reflect();
    }).then(function(docs) {
        var errsNum = 0;
        var errs = {};
        var out;

        if (options.indexed === true) {
            out = {};
        } else {
            out = [];
        }

        for (var i = 0, len = docs.length; i < len; i++) {
            var doc = docs[i];
            var id, result;

            if (ids[i] instanceof self.Key) {
                id = ids[i].getId();
            } else {
                id = ids[i].toString();
            }

            if (doc.isRejected()) {
                errs[id] = doc.reason();
                errsNum++;
                result = doc.reason();
            } else {
                result = doc.value();
            }

            if (options.indexed === true) {
                out[id] = result;
            } else {
                out.push(result)
            }
        }

        if (errsNum == docs.length) {
            return Promise.reject(new StorageAdapter.errors.StorageMultiError(errs));
        }

        return out;
    }).tap(function(out) {
        if (runHooks !== false && options.individualHooks !== true) {
            return self.runHooks(HookTypes.afterGet, out, options);
        }
    });
}

/**
 * remove
 *
 * @param {string|Key} id
 *
 * @return {Promise<Instance>}
 */
Model.prototype.remove = function(id) {
    //must be handled this way, because of reference decuments
    return Model.prototype.getById.call(this, id).then(function(instance) {
        return instance.destroy();
    });
}

/**
 * touch
 *
 * @param {string|Key} id
 * @param {integer}    expiry
 *
 * See {@link StorageAdapter#touch} for more information
 *
 * @return {Promise<Object>}
 */
Model.prototype.touch = function(id, expiry) {
    var key = id;
    if (!(id instanceof this.Key)) {
        key = this.buildKey(id);
    }

    return this.storage.touch(key, expiry);
}

/**
 * unlock
 *
 * @param {string|Key} id
 *
 * @return {Promise<Object>}
 */
Model.prototype.unlock = function(id) {
    var key = id;
    if (!(id instanceof this.Key)) {
        key = this.buildKey(id);
    }

    return this.storage.unlock(key);
}

/**
 * exists
 *
 * @param {string|Key} id
 *
 * @return {Promise<Object>}
 */
Model.prototype.exists = function(id) {
    var key = id;
    if (!(id instanceof this.Key)) {
        key = this.buildKey(id);
    }

    return this.storage.exists(key);
}

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
    var refDocs = this.options.indexes.refDocs;

    Object.keys(refDocs).forEach(function(fnName) {
        var refKeyOptions = refDocs[fnName];

        //register getByRefDoc method
        self[fnName] = (function(ref) {
            return function(id, options) {
                options = options || {};
                var opt = _.clone(options);
                opt.id = id;
                opt.ref = ref;
                opt.caseSensitive = refKeyOptions.caseSensitive;

                return getByRef.call(self, opt);
            }
        })(refKeyOptions.keys);
    });
}

/**
 * getByRef
 *
 * @param {Object}       [options]
 * @param {string|Array} [options.id] - RefDocKey option - unique index value/s a document should be searched by. Eg.: username/email value
 * @param {Array}        [options.ref] - RefDocKey option - reference types = the Model's schema properties by which the key of referencing document is created
 * @param {boolean}      [options.caseSensitive] - RefDocKey option
 * @param {boolean}      [options.plain] - if true, raw data are returned no instance is build
 * @param {integer}      [options.lockTime] - period of time in seconds for which parent document should be locked
 * @param {integer}      [options.expiry] - expiry time of parent document in seconds
 * @param {boolean}      [options.lean] - if true, parent document's `Key` object is returned, no document's data are fetched
 * @param {boolean}      [options.paranoid=true] - if false, both deleted and non-deleted documents will be returned. Only applies if global `options.paranoid` is true for the model.
 *
 * @private
 * return {Promise<Instance>}
 */
function getByRef(options) {
    //get the reference document
    return getRefDoc.call(this, {
        id: options.id,
        ref: options.ref,
        caseSensitive: options.caseSensitive
    }).bind(this).then(function(refDoc) {
        var key = this.buildKey(refDoc.value, true);
        if (options.lean === true) {
            return key;
        }
        //get the Instance with data
        return this.getById(key, _.omit(options, ['id', 'ref', 'caseSensitive']));
    });
}

/**
 * getRefDoc
 *
 * searches for the reference document by reference type/s (`ref`) and reference value/s (`id`)
 *
 * @param {Object}       [options]
 * @param {string|Array} [options.id]
 * @param {Array}        [options.ref]
 * @param {boolean}      [options.caseSensitive]
 *
 * @private
 * @return {Promise<Object>}
 */
function getRefDoc(options) {
    var key = this.$buildRefDocKey(options);
    return this.storage.get(key);
}

/**
 * toString
 *
 * @return {string}
 */
Model.prototype.toString = function() {
    return '[object CouchbaseModel:' + this.name + ']';
}

/**
 * inspect
 *
 * @private
 * @return {string}
 */
Model.prototype.inspect = Model.prototype.toString;
