'use strict';
var _        = require('lodash');
var Promise  = require('bluebird');

module.exports = Document;

var Instance       = require("./instance.js");
var Key            = require("./key/key.js");
var StorageAdapter = require("./storageAdapter");
var DocumentError  = require("./error/documentError.js");
var StorageError   = require("./error/storageError.js");

/**
 * Document
 *
 * @constructor
 * @throws {DocumentError}
 * @param {Object}            [options]
 * @param {string|Key}        [options.key] - `optional` may be set later
 * @param {mixed}             [options.data]
 * @param {CAS}               [options.cas] - `optional`
 * @param {StorageAdapter}    [options.storage]
 * @param {boolean}           [options.isNewRecord] - default=`true`
 * @param {Document|Instance} [options.reference] - `optional`
 */
function Document(options) {
    var defaults = {
        key: null,
        data: null,
        cas: undefined,//should be of type Bucket.CAS
        isNewRecord: true,
        reference: this//reference to parent document (used for refDocs)
    }

    Object.defineProperty(this, 'options', {
        writable: true,
        value:  _.assign(defaults, options)
    });

    Object.defineProperty(this, 'storage', {
        writable: true,
        value:  options.storage || null
    });

    if (!(this.storage instanceof StorageAdapter)) {
        throw new DocumentError("`storage` must be instance of StorageAdapter");
    }
}

/**
 * getStorageAdapter
 *
 * @return {StorageAdapter|null}
 */
Document.prototype.getStorageAdapter = function() {
    return this.storage;
};

/**
 * getKey
 *
 * @return {Key|string|null}
 */
Document.prototype.getKey = function() {
    return this.options.key;
};

/**
 * setKey
 *
 * @throws DocumentError
 * @return {undefined}
 */
Document.prototype.setKey = function(key) {
    if (!(key instanceof Key) && typeof key != 'string') {
        throw new DocumentError("key must be string or instance of Key");
    }

    this.options.key = key;
};

/**
 * getData
 *
 * @param {string} [property]
 * @return {mixed}
 */
Document.prototype.getData = function() {
    if (arguments.length) {
        return this.options.data[arguments[0]];
    }
    return this.options.data;
};

/**
 * setData
 *
 * @param {string} [property]
 * @param {mixed} data
 * @return {Document}
 */
Document.prototype.setData = function() {
    if (!this.hasCAS() && !this.options.isNewRecord) {
        throw new DocumentError('Can NOT set data of unloaded document that has been persisted to a bucket. Call the `refresh` method');
    } else if (arguments.length > 2) {
        throw new DocumentError("Too many arguments. See the `setData` method's signature");
    } else if (arguments.length === 2) {
        this.options.data[arguments[0]] = arguments[1];
    } else {
        this.options.data = arguments[0];
    }
    return this;
};

/**
 * getSerializedData
 *
 * @return {Promise<{mixed}>}
 */
Document.prototype.getSerializedData = Promise.method(function() {
    return this.options.data;
});

/**
 * getCAS
 *
 * @return {CAS|null}
 */
Document.prototype.getCAS = function() {
    return this.options.cas;
};

/**
 * hasCAS
 *
 * @return {boolean}
 */
Document.prototype.hasCAS = function() {
    var cas = this.getCAS();
    return typeof cas === 'string' || (typeof cas === 'object' && cas !== null);
};

/**
 * setCAS
 *
 * @param {CAS} cas
 * @return {undefined}
 */
Document.prototype.setCAS = function(cas) {
    this.options.cas = cas;
};

/**
 * getGeneratedKey
 *
 * @return {Promise<Key>}
 */
Document.prototype.getGeneratedKey = Promise.method(function() {
    var key = this.options.key;
    if (key === null || key === undefined || key === '') {
        return Promise.reject(new DocumentError("Can not perform operation on a document with no `key`"));
    }

    if (key instanceof Key && !key.isGenerated()) {
        return key.generate(this.options.reference);
        //return key.generate(this.options.reference).call("toString");
    }

    //key is instance of Key or it's string
    return key;
});

/**
 * insert
 *
 * @throws StorageError
 * @param {Object} options - See StorageAdapter.insert for available options
 * @return {Promise<Document>}
 */
Document.prototype.insert = Promise.method(function(options) {
    var doc = this;
    return this.getGeneratedKey().bind({}).then(function(key) {
            this.key = key;
            return doc.getSerializedData();
        }).then(function(data) {
            return doc.getStorageAdapter().insert(this.key, data, options);
        }).catch(StorageError, function(err) {
            err.doc = doc;
            throw err;
        });
});

/**
 * replace
 *
 * @throws StorageError
 * @param {Object} options - See StorageAdapter.replace for available options
 * @return {Promise<Document>}
 */
Document.prototype.replace = Promise.method(function(options) {
    var doc = this;
    return this.getGeneratedKey().bind({}).then(function(key) {
            this.key = key;
            return doc.getSerializedData();
        }).then(function(data) {
            var opt = _.assign({}, {cas: doc.getCAS()}, options);
            return doc.getStorageAdapter().replace(this.key, data, opt);
        }).catch(StorageError, function(err) {
            err.doc = doc;
            throw err;
        });
});

/**
 * remove
 *
 * @param {Object} options - See StorageAdapter.remove for available options
 * @return {Promise<Object>}
 */
Document.prototype.remove = Promise.method(function(options) {
    return this.getGeneratedKey().bind(this).then(function(key) {
            var opt = _.assign({}, {cas: this.getCAS()}, options);
            return this.getStorageAdapter().remove(key, opt);
        }).catch(StorageError, function(err) {
            err.doc = this;
            return Promise.reject(err);
        });
});

/**
 * touch
 *
 * @throws StorageError
 * @param {integer} expiry - time in seconds
 * @param {Object} options - see {@link StorageAdapter#touch} for available options
 * @return {Promise<Document>}
 */
Document.prototype.touch = Promise.method(function(expiry, options) {
    return this.getGeneratedKey().bind(this).then(function(key) {
            var opt = _.assign({}, {cas: this.getCAS()}, options);
            return this.getStorageAdapter().touch(key, expiry, opt);
        }).catch(StorageError, function(err) {
            err.doc = this;
            throw err;
        });
});

/*
 * inspect
 *
 * @private
 * @return {string}
 */
Document.prototype.inspect = function() {
    var key = this.options && this.options.key;
    var cas = key && this.options.cas;
    var out = '[object CouchbaseDocument:\n';
    out += "    key: '" + key + "'\n";
    out += "    cas: " + cas;
    out += "]";

    return out;
};

/**
 * toString
 *
 * @return {string}
 */
Document.prototype.toString = Document.prototype.inspect;
