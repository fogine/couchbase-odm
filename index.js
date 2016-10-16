var _            = require("lodash");

var InstanceError           = require("./lib/error/instanceError.js");
var DocumentError           = require("./lib/error/documentError.js");
var KeyError                = require("./lib/error/keyError.js");
var ModelError              = require("./lib/error/modelError.js");
var StorageMultiError       = require("./lib/error/storageMultiError.js");
var StorageError            = require("./lib/error/storageError.js");
var ValidationError         = require("./lib/error/validationError.js");
var ModelManagerError       = require("./lib/error/modelManagerError.js");
var ModelNotFoundError      = require("./lib/error/modelNotFoundError.js");


var RefDocKey      = require("./lib/key/refDocKey.js");
var IncrementalKey = require("./lib/key/incrementalKey.js");
var UUID4Key       = require("./lib/key/uuid4Key.js");
var Key            = require("./lib/key/key.js");

var Operation      = require("./lib/operation.js");
var DataTypes      = require("./lib/dataType.js").types;
var Instance       = require("./lib/instance.js");
var Document       = require("./lib/document.js");
var Model          = require("./lib/model.js");
var ModelManager   = require("./lib/modelManager.js");
var Sanitizer      = require("./lib/sanitizer.js");
var StorageAdapter = require("./lib/storageAdapter.js");
var Hook           = require("./lib/hook.js");

/**
 * CouchbaseODM
 *
 * main enterance to the couchbase-odm
 *
 * @constructor
 * @param {Object}  [options]
 * @param {Bucket}  options.bucket - must be instance of Couchbase.Bucket (from official nodejs couchbase sdk)
 * @param {Key}     [options.key={UUID4Key}] - The strategy used for document's `key` generation. Must inherit from base `Key` class
 * @param {boolean} [options.timestamps=true] - Adds automatically handled timestamp schema properties: `created_at`, `updated_at` and if `paranoid` option is true, `deleted_at` property
 * @param {boolean} [options.paranoid=false] - if `true` is set, a document is not actually removed from `bucket` but rather `deleted_at` flag on the document is set. aka. `soft delete`
 * @param {boolean} [options.camelCase=false] - if `true` is set, camel case notation is used for document's internal properties.
 * @param {Object}  [options.schemaSettings] - allows to modify default values used for document's `key` generation and document's property names handled by ODM
 * @param {Object}  [options.schemaSettings.key]
 * @param {string}  [options.schemaSettings.key.prefix=defaults to Model's name] - you most likely do not want to set default value at `CouchbaseODM` constructor level
 * @param {string}  [options.schemaSettings.key.postfix=""]
 * @param {string}  [options.schemaSettings.key.delimiter=""]
 * @param {boolean} [options.schemaSettings.key.caseSensitive=true]
 * @param {Object}  [options.schemaSettings.doc]
 * @param {string}  [options.schemaSettings.doc.idPropertyName="_id"] - `_id` contains generated id of document (not whole document's key)
 * @param {string}  [options.schemaSettings.doc.typePropertyName="_type"] - `_type` contains the name of a Model
 * @param {Object}  [options.hooks] - allows to add one or more hooks of a hook type (eg. `afterValidate`)
 * @param {Object}  [options.classMethods] - custom method definitions which are bound to a Model.
 * @param {Object}  [options.instanceMethods] - custom method definitions which are bound to a Instance.
 * @param {Object}  [options.indexes]
 * @param {Object}  [options.indexes.refDocs] - Global reference document definitions. Refdoc is a document which reference parent document with its string value(=key). See {@tutorial 3b.refDocIndexes} tutorial for more details
 */
function CouchbaseODM(options) {

    var defaults = {
        key: UUID4Key,
        schemaSettings : {
            key: {
                postfix: "",
                delimiter: "_"
            },
            doc: {
                idPropertyName: "_id",
                typePropertyName: "_type"
            }
        },
        hooks: {},
        timestamps: true,
        paranoid: false,
        camelCase: false,
        classMethods: {},
        instanceMethods: {},
        bucket: null,
        indexes: {
            refDocs: {}
        }
    };

    var self = this;

    /**
     * @instance
     * @type {ModelManager}
     */
    this.modelManager = new ModelManager();
    this.options = _.merge(defaults, options || {});

    //Transform mapped hooks of type to collection of hooks if not collection already
    Object.keys(this.options.hooks || {}).forEach(function(hookType) {
        if (!(self.options.hooks[hookType] instanceof Array)) {
            self.options.hooks[hookType] = [self.options.hooks[hookType]];
        }
    });
}

/**
 * attach hooks methods to Model, Model.prototype
 */
Hook.applyTo(CouchbaseODM);

/**
 * define
 *
 * builds new Model representing a document(s) in bucket
 *
 * @param {string} name - name of the model
 * @param {Object} schema - data schema definition
 * @param {Object} [options] - see {@link Model} for available options
 * @return {Model}
 */
CouchbaseODM.prototype.define = function(name, schema, options) {

    options = options || {};
    //Transform mapped hooks of type to collection of hooks if not collection already
    Object.keys(options.hooks || {}).forEach(function(hookType) {
        if (!(options.hooks[hookType] instanceof Array)) {
            options.hooks[hookType] = [options.hooks[hookType]];
        }
    });

    var opt = _.merge({}, this.options);
    options = _.mergeWith(opt, options || {}, function(objValue, srcValue, key) {
        if (key === 'bucket') {
            return srcValue;
        }
    });

    var model = new Model(name, schema, options);
    model.$init(this.modelManager);

    this.modelManager.add(model);

    return model;
}

/**
 * @typedef ErrorList
 * @type {Object}
 * @property {InstanceError}     InstanceError
 * @property {ModelError}        ModelError
 * @property {DocumentError}     DocumentError
 * @property {KeyError}          KeyError
 * @property {StorageError}      StorageError
 * @property {StorageMultiError} StorageMultiError
 * @property {ValidationError}   ValidationError
 * @property {CouchbaseError}    StorageAdapter.CouchbaseError - native couchbase sdk error object
 * @property {ModelManagerError}  ModelManagerError
 * @property {ModelNotFoundError} ModelNotFoundError
 */

/**
 * @name CouchbaseODM.prototype.errors
 * @type {ErrorList}
 */

/**
 * @name CouchbaseODM.errors
 * @type {ErrorList}
 */
CouchbaseODM.errors = CouchbaseODM.prototype.errors = {
    InstanceError     : InstanceError,
    ModelError        : ModelError,
    DocumentError     : DocumentError,
    KeyError          : KeyError,
    StorageError      : StorageError,
    StorageMultiError : StorageMultiError,
    ValidationError   : ValidationError,
    ModelManagerError : ModelManagerError,
    ModelNotFoundError: ModelNotFoundError,
    CouchbaseError    : StorageAdapter.CouchbaseError
};

CouchbaseODM.Key            = CouchbaseODM.prototype.Key            = Key;
CouchbaseODM.UUID4Key       = CouchbaseODM.prototype.UUID4Key       = UUID4Key;
CouchbaseODM.IncrementalKey = CouchbaseODM.prototype.IncrementalKey = IncrementalKey;
CouchbaseODM.RefDocKey      = CouchbaseODM.prototype.RefDocKey      = RefDocKey;
CouchbaseODM.DataTypes      = CouchbaseODM.prototype.DataTypes      = DataTypes;
CouchbaseODM.Operation      = CouchbaseODM.prototype.Operation      = Operation;
CouchbaseODM.Instance       = CouchbaseODM.prototype.Instance       = Instance;
CouchbaseODM.Document       = CouchbaseODM.prototype.Document       = Document;
CouchbaseODM.Model          = CouchbaseODM.prototype.Model          = Model;
CouchbaseODM.ModelManager   = CouchbaseODM.prototype.ModelManager   = ModelManager;
CouchbaseODM.Sanitizer      = CouchbaseODM.prototype.Sanitizer      = Sanitizer;
CouchbaseODM.StorageAdapter = CouchbaseODM.prototype.StorageAdapter = StorageAdapter;
CouchbaseODM.Hook           = CouchbaseODM.prototype.Hook           = Hook;

module.exports = CouchbaseODM;

//============= STATIC members ==============

/**
 * @name CouchbaseODM.Key
 * @type Key
 */

/**
 * @name CouchbaseODM.UUID4Key
 * @type UUID4Key
 */

/**
 * @name CouchbaseODM.IncrementalKey
 * @type IncrementalKey
 */

/**
 * @name CouchbaseODM.RefDocKey
 * @type RefDocKey
 */

/**
 * @name CouchbaseODM.DataTypes
 * @type DataTypes
 */

/**
 * @name CouchbaseODM.Operation
 * @type Operation
 */

/**
 * @name CouchbaseODM.Instance
 * @type Instance
 */

/**
 * @name CouchbaseODM.Document
 * @type Document
 */

/**
 * @name CouchbaseODM.Model
 * @type Model
 */

/**
 * @name CouchbaseODM.ModelManager
 * @type ModelManager
 */

/**
 * @name CouchbaseODM.Sanitizer
 * @type Sanitizer
 */

/**
 * @name CouchbaseODM.StorageAdapter
 * @type StorageAdapter
 */

/**
 * @name CouchbaseODM.Hook
 * @type Hook
 */

//============= INSTANCE members ==============

/**
 * @name CouchbaseODM.prototype.Key
 * @type Key
 */

/**
 * @name CouchbaseODM.prototype.UUID4Key
 * @type UUID4Key
 */

/**
 * @name CouchbaseODM.prototype.IncrementalKey
 * @type IncrementalKey
 */

/**
 * @name CouchbaseODM.prototype.RefDocKey
 * @type RefDocKey
 */

/**
 * @name CouchbaseODM.prototype.DataTypes
 * @type DataTypes
 */

/**
 * @name CouchbaseODM.prototype.Operation
 * @type Operation
 */

/**
 * @name CouchbaseODM.prototype.Instance
 * @type Instance
 */

/**
 * @name CouchbaseODM.prototype.Document
 * @type Document
 */

/**
 * @name CouchbaseODM.prototype.Model
 * @type Model
 */

/**
 * @name CouchbaseODM.prototype.ModelManager
 * @type ModelManager
 */

/**
 * @name CouchbaseODM.prototype.Sanitizer
 * @type Sanitizer
 */

/**
 * @name CouchbaseODM.prototype.StorageAdapter
 * @type StorageAdapter
 */

/**
 * @name CouchbaseODM.prototype.Hook
 * @type Hook
 */

