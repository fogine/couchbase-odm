var Promise    = require("bluebird");
var Key        = require("./key/key.js");
var Document   = require("./document.js");
var _          = require("lodash");
var couchbase  = require('couchbase');

var CouchbaseError = couchbase.Error;
var StorageError = require("./error/storageError");

module.exports = StorageAdapter;

/**
 * StorageAdapter
 *
 * @constructor
 *
 * @throws {StorageError}
 * @param {Object} [options]
 * @param {Bucket} [options.bucket]
 */
function StorageAdapter(options) {

    if (   !_.isObject(options.bucket)
        || !options.bucket.constructor
        || ['Bucket', 'MockBucket'].indexOf(options.bucket.constructor.name) === -1
    ) {
        throw new StorageError("`bucket` is not Bucket instance");
    }

    Object.defineProperty(this, "bucket", {
        enumerable: false,
        configurable: false,
        value: options.bucket
    });
}

/**
 * @typedef StorageAdapterErrorList
 * @type {Object}
 * @property {StorageError}      StorageError
 * @property {CouchbaseError}    StorageAdapter.CouchbaseError - native couchbase sdk error object
 */

/**
 * @name StorageAdapter.prototype.errors
 * @type {StorageAdapterErrorList}
 */

/**
 * @name StorageAdapter.errors
 * @type {StorageAdapterErrorList}
 */
StorageAdapter.errors = StorageAdapter.prototype.errors = {
    CouchbaseError: CouchbaseError,
    StorageError: StorageError
};

/**
 * @name StorageAdapter.errorCodes
 * @description mirrors native couchbase sdk require('couchbase').errors
 * @type {Object}
 */
StorageAdapter.errorCodes = couchbase.errors;

/**
 * @name StorageAdapter.prototype.errorCodes
 * @description mirrors native couchbase sdk require('couchbase').errors
 * @type {Object}
 */
StorageAdapter.prototype.errorCodes = couchbase.errors;

/**
 * @param {Key} key
 * @param {Object}  [options]
 * @param {boolean} [options.paranoid] - default=`true` if false, both deleted and non-deleted documents will be returned. if `true`, it'll throw `StorageError` (not found) for a document which was sof-deleted.
 * @param {string}  [options.deletedAtPropName] - should be provided if `options.paranoid` === false
 *
 * @return {Promise<Object>}
 */
StorageAdapter.prototype.get = function(key, options) {

    var self = this;
    options = _.clone(options) || {};

    return new Promise(function(resolve, reject) {

        return self.bucket.get(key.toString(), options, function(err, doc) {
            if (err) {
                return reject(new StorageError(err.message, err.code));
            }

            if (   options.hasOwnProperty('paranoid')
                && options.paranoid !== false
                && _.isPlainObject(doc.value)
                && !_.isNil(doc.value[options.deletedAtPropName])
            ) {
                return reject(new StorageError(
                    'The `key` was not found in the bucket (soft-deleted)',
                    couchbase.errors.keyNotFound)
                );
            }

            return resolve(doc);
        });
    });
};

/**
 * @param {Key}     key
 * @param {integer} expiry - time in seconds. If the value is greater than number of seconds in one month, the value must be provided in unix timestamp format.
 * @param {Object}  options
 *
 * @return {Promise<Object>}
 */
StorageAdapter.prototype.getAndTouch = function(key, expiry, options) {

    var self = this;
    return new Promise(function(resolve, reject) {

        return self.bucket.getAndTouch(key.toString(), expiry, _.clone(options) || {}, function(err, doc) {
            if (err) {
                return reject(new StorageError(err.message, err.code));
            }

            return resolve(doc);
        });
    });
};

/**
 * @param {Key}     key
 * @param {Object}  [options]
 * @param {integer} [options.lockTime] - time in seconds, default=15, max=30
 *
 * @return {Promise<Object>}
 */
StorageAdapter.prototype.getAndLock = function(key, options) {

    var self = this;
    return new Promise(function(resolve, reject) {

        return self.bucket.getAndLock(key.toString(), _.clone(options) || {}, function(err, doc) {
            if (err) {
                return reject(new StorageError(err.message, err.code));
            }

            return resolve(doc);
        });
    });
};

/**
 * @param {Key} key
 * @param {Object} [options]
 * @param {intger} [options.index] - `optional` The index for which replica you wish to retrieve this value from, or if undefined, use the value from the first server that replies.
 *
 * @return {Promise<Object>}
 */
StorageAdapter.prototype.getReplica = function(key, options) {

    var self = this;
    return new Promise(function(resolve, reject) {

        return self.bucket.getReplica(key.toString(), _.clone(options) || {}, function(err, doc) {
            if (err) {
                return reject(new StorageError(err.message, err.code));
            }

            return resolve(doc);
        });
    });
};

/**
 * @param {Key}     key
 * @param {mixed}   data
 * @param {Object}  [options]
 * @param {integer} [options.expiry=0] - Set the initial expiration time for the document. A value of 0 represents never expiring. If the value is greater than number of seconds in one month, the value must be provided in unix timestamp format.
 * @param {integer} [options.persist_to] - `optional` default=`0` Ensures this operation is persisted to this many nodes
 * @param {integer} [options.replicate_to] - `optional` default=`0` Ensures this operation is replicated to this many nodes
 * @return {Promise<Object>}
 */
StorageAdapter.prototype.insert = function(key, data, options) {

    var self = this;

    return new Promise(function(resolve, reject) {

        return self.bucket.insert(key.toString(), data, _.clone(options) || {}, function(err, result) {
            if (err) {
                return reject(new StorageError(err.message, err.code));
            }
            return resolve(result);
        });
    });
};

/**
 * aync version
 *
 * @param {Array<Document>} documents
 * @param {Object}          [options]
 * @param {integer}         [options.expiry=0] - Set the initial expiration time for the document. A value of 0 represents never expiring. If the value is greater than number of seconds in one month, the value must be provided in unix timestamp format.
 * @param {integer}         [options.persist_to] - `optional` default=`0` Ensures this operation is persisted to this many nodes
 * @param {integer}         [options.replicate_to] - `optional` default=`0` Ensures this operation is replicated to this many nodes
 *
 * @return {Promise<Array<PromiseInspection>>}
 */
StorageAdapter.prototype.bulkInsert = function(documents, options) {

    return Promise.all(documents.map(function(doc) {
        return doc.insert(_.clone(options)).reflect();
    }));
}

/**
 * @param {Array<Document>} documents
 * @param {Object}          [options]
 * @param {integer}         [options.expiry=0] - Set the initial expiration time for the document. A value of 0 represents never expiring. If the value is greater than number of seconds in one month, the value must be provided in unix timestamp format.
 * @param {integer}         [options.persist_to] - `optional` default=`0` Ensures this operation is persisted to this many nodes
 * @param {integer}         [options.replicate_to] - `optional` default=`0` Ensures this operation is replicated to this many nodes
 *
 * @return {Promise<Array>}
 */
StorageAdapter.prototype.bulkInsertSync = function(documents, options) {

    return Promise.mapSeries(documents, function(doc) {
        return doc.insert(_.clone(options));
    });
};

/**
 * Returns an instance of a BucketManager for performing management operations against a bucket.
 *
 * @return {BucketManager}
 */
StorageAdapter.prototype.getManager = function() {

    return this.bucket.manager();
};

/**
 * @param {Key}       key
 * @param {mixed}     value
 * @param {Object}    [options]
 * @param {BucketCAS} [options.cas] - `optional` The CAS value to check. If the item on the server contains a different CAS value, the operation will fail. Note that if this option is undefined, no comparison will be performed.
 * @param {integer}   [options.expiry=0] - Set the initial expiration time for the document. A value of 0 represents never expiring. If the value is greater than number of seconds in one month, the value must be provided in unix timestamp format.
 * @param {integer}   [options.persist_to] - `optional` default=`0` Ensures this operation is persisted to this many nodes
 * @param {integer}   [options.replicate_to] - `optional` default=`0` Ensures this operation is replicated to this many nodes
 *
 * @return {Promise<Object>}
 */
StorageAdapter.prototype.append = function(key, value, options) {

    var self = this;
    return new Promise(function(resolve, reject) {

        return self.bucket.append(key.toString(), value, _.clone(options) || {}, function(err, doc) {
            if (err) {
                return reject(new StorageError(err.message, err.code));
            }

            return resolve(doc);
        });
    });
};

/**
 * @param {Key}       key
 * @param {mixed}     value
 * @param {Object}    [options]
 * @param {BucketCAS} [options.cas] - `optional` The CAS value to check. If the item on the server contains a different CAS value, the operation will fail. Note that if this option is undefined, no comparison will be performed.
 * @param {integer}   [options.expiry=0] - Set the initial expiration time for the document. A value of 0 represents never expiring. If the value is greater than number of seconds in one month, the value must be provided in unix timestamp format.
 * @param {integer}   [options.persist_to] - `optional` default=`0` Ensures this operation is persisted to this many nodes
 * @param {integer}   [options.replicate_to] - `optional` default=`0` Ensures this operation is replicated to this many nodes
 * @return {Promise<Object>}
 */
StorageAdapter.prototype.prepend = function(key, value, options) {

    var self = this;
    return new Promise(function(resolve, reject) {

        return self.bucket.prepend(key.toString(), value, _.clone(options) || {}, function(err, doc) {
            if (err) {
                return reject(new StorageError(err.message, err.code));
            }

            return resolve(doc);
        });
    });
};

/**
 * Increments or decrements a key's numeric value.
 * Note that JavaScript does not support 64-bit integers (while libcouchbase and the server do).
 * You might receive an inaccurate value if the number is greater than 53-bits (JavaScript's maximum integer precision).
 *
 * @param {Array<string|Buffer>} key
 * @param {integer}              value
 * @param {Object}               [options]
 * @param {integer}              [options.initial] - `optional` Sets the initial value for the document if it does not exist. Specifying a value of undefined will cause the operation to fail if the document does not exist, otherwise this value must be equal to or greater than 0.
 * @param {integer}              [options.expiry=0] - Set the initial expiration time for the document. A value of 0 represents never expiring. If the value is greater than number of seconds in one month, the value must be provided in unix timestamp format.
 * @param {integer}              [options.persist_to] - `optional` default=`0` Ensures this operation is persisted to this many nodes
 * @param {integer}              [options.replicate_to] - `optional` default=`0` Ensures this operation is replicated to this many nodes
 * @return {Promise<Object>}
 */
StorageAdapter.prototype.counter = function(key, value, options) {

    var self = this;
    return new Promise(function(resolve, reject) {
        return self.bucket.counter(key, value, _.clone(options) || {}, function(err, doc) {
            if (err) {
                return reject(new StorageError(err.message, err.code));
            }

            return resolve(doc);
        });
    });
};

/**
 * Executes a previously prepared query object. This could be a ViewQuery or a N1qlQuery.
 *
 * @param {ViewQuery|N1qlQuery} query - The query to execute
 * @param {Object|Array}        params - `optional` A list or map to do replacements on a N1QL query.
 *
 * @return {Promise<Bucket.ViewQueryResponse|Bucket.N1qlQueryResponse>}
 */
StorageAdapter.prototype.query = function(query, params) {

    var self = this;
    return new Promise(function(resolve, reject) {
        return self.bucket.query(query, params, function(err, response) {
            if (err) {
                return reject(new StorageError(err.message, err.code));
            }

            return resolve(response);
        });
    });
};

/**
 * @param {Key}       key
 * @param {Object}    [options]
 * @param {BucketCAS} [options.cas] - `optional` The CAS value to check. If the item on the server contains a different CAS value, the operation will fail. Note that if this option is undefined, no comparison will be performed.
 * @param {integer}   [options.persist_to] - `optional` default=`0` Ensures this operation is persisted to this many nodes
 * @param {integer}   [options.replicate_to] - `optional` default=`0` Ensures this operation is replicated to this many nodes
 *
 * @return {Promise<Object>}
 */
StorageAdapter.prototype.remove = function(key, options) {

    var self = this;
    return new Promise(function(resolve, reject) {

        self.bucket.remove(key.toString(), _.clone(options) || {}, function(err, result) {
            if (err) {
                return reject(new StorageError(err.message, err.code));
            }
            return resolve(result);
        });
    });
};

/**
 * @param {Array<Document|Key>} entities
 * @param {Object}              [options]
 * @param {BucketCAS}           [options.cas] - `optional` The CAS value to check. If the item on the server contains a different CAS value, the operation will fail. Note that if this option is undefined, no comparison will be performed.
 * @param {integer}             [options.persist_to] - `optional` default=`0` Ensures this operation is persisted to this many nodes
 * @param {integer}             [options.replicate_to] - `optional` default=`0` Ensures this operation is replicated to this many nodes
 *
 * @throws {StorageError}
 * @return {Promise<Array>}
 */
StorageAdapter.prototype.bulkRemoveSync = function(entities, options) {

    var self = this;
    options = _.clone(options);

    return Promise.mapSeries(entities, function(entity) {
        if (entity instanceof Key) {
            return self.remove(entity, options);
        } else if(entity instanceof Document) {
            return entity.remove(options);
        } else {
            var err = new StorageError("Must be instance of `Key` or `Document`");
            return Promise.reject(err);
        }
    });
};

/**
 * async version
 * retruns always fullfiled promise with response implementing PromiseInspection
 *
 * @param {Array<Document|Key>} entities
 * @param {Object}              [options]
 * @param {BucketCAS}           [options.cas] - `optional` The CAS value to check. If the item on the server contains a different CAS value, the operation will fail. Note that if this option is undefined, no comparison will be performed.
 * @param {integer}             [options.persist_to] - `optional` default=`0` Ensures this operation is persisted to this many nodes
 * @param {integer}             [options.replicate_to] - `optional` default=`0` Ensures this operation is replicated to this many nodes
 *
 * @return {Promise<Array<PromiseInspection>>}
 */
StorageAdapter.prototype.bulkRemove = function(entities, options) {

    var self = this;
    options = _.clone(options);
    var Document = require("./document.js");

    return Promise.all(entities.map(function(entity) {
        var prom;
        if (entity instanceof Key) {
             prom = self.remove(entity, options);
        } else if(entity instanceof Document) {
            prom = entity.remove(options);
        } else {
            var err = new StorageError("Must be instance of `Key` or `Document`");
            prom = Promise.reject(err);
        }

        return prom.reflect();
    }));
};

/**
 * Identical to Bucket#set, but will only succeed if the document exists already.
 *
 * @param {Key}       key
 * @param {mixed}     value
 * @param {Object}    [options]
 * @param {BucketCAS} [options.cas] - `optional` The CAS value to check. If the item on the server contains a different CAS value, the operation will fail. Note that if this option is undefined, no comparison will be performed.
 * @param {integer}   [options.expiry=0] - Set the initial expiration time for the document. A value of 0 represents never expiring. If the value is greater than number of seconds in one month, the value must be provided in unix timestamp format.
 * @param {integer}   [options.persist_to] - `optional` default=`0` Ensures this operation is persisted to this many nodes
 * @param {integer}   [options.replicate_to] - `optional` default=`0` Ensures this operation is replicated to this many nodes
 *
 * @return {Promise<Object>}
 */
StorageAdapter.prototype.replace = function(key, value, options) {

    var self = this;
    return new Promise(function(resolve, reject) {

        return self.bucket.replace(key.toString(), value, _.clone(options) || {}, function(err, result) {
            if (err) {
                return reject(new StorageError(err.message, err.code));
            }

            return resolve(result);
        });
    });
};

/**
 * Identical to Bucket#set, but will only succeed if the document exists already.
 *
 * @param {Key}       key
 * @param {mixed}     value
 * @param {Object}    [options]
 * @param {BucketCAS} [options.cas] - `optional` The CAS value to check. If the item on the server contains a different CAS value, the operation will fail. Note that if this option is undefined, no comparison will be performed.
 * @param {integer}   [options.expiry=0] - Set the initial expiration time for the document. A value of 0 represents never expiring. If the value is greater than number of seconds in one month, the value must be provided in unix timestamp format.
 * @param {integer}   [options.persist_to] - `optional` default=`0` Ensures this operation is persisted to this many nodes
 * @param {integer}   [options.replicate_to] - `optional` default=`0` Ensures this operation is replicated to this many nodes
 *
 * @return {Promise<Object>}
 */
StorageAdapter.prototype.upsert = function(key, value, options) {

    var self = this;
    return new Promise(function(resolve, reject) {

        return self.bucket.upsert(key.toString(), value, _.clone(options) || {}, function(err, result) {
            if (err) {
                return reject(new StorageError(err.message, err.code));
            }

            return resolve(result);
        });
    });
};

/**
 * @param {Key}     key
 * @param {integer} expiry - In seconds. The expiration time to use. If a value of 0 is provided, then the current expiration time is cleared and the key is set to never expire. Otherwise, the key is updated to expire in the time provided. If the value is greater than number of seconds in one month, the value must be provided in unix timestamp format.
 * @param {Object}  [options]
 * @param {integer} [options.persist_to] - `optional` default=`0` Ensures this operation is persisted to this many nodes
 * @param {integer} [options.replicate_to] - `optional` default=`0` Ensures this operation is replicated to this many nodes
 *
 * @return {Promise<Object>}
 */
StorageAdapter.prototype.touch = function(key, expiry, options) {

    var self = this;
    return new Promise(function(resolve, reject) {

        return self.bucket.touch(key.toString(), expiry, _.clone(options) || {}, function(err, result) {
            if (err) {
                return reject(new StorageError(err.message, err.code));
            }
            return resolve(result);
        });
    });
};

/**
 * @param {Key}        key
 * @param {Bucket.CAS} cas - The CAS value returned when the key was locked. This operation will fail if the CAS value provided does not match that which was the result of the original lock operation.
 * @param {Object}     options
 *
 * @return {Promise<Object>}
 */
StorageAdapter.prototype.unlock = function(key, cas, options) {

    var self = this;
    return new Promise(function(resolve, reject) {

        return self.bucket.unlock(key.toString(), cas, _.clone(options) || {}, function(err, result) {
            if (err) {
                return reject(new StorageError(err.message, err.code));
            }

            return resolve(result);
        });
    });
};

/**
 * fake `exists` method which will perform `insert` operation.
 * If the operation succeeds, the inserted document is removed and `true` is returned, otherwise `false` is returned
 *
 * Note: In the future it could be replaced by `LookupInBuilder.exists` method (currently unstable)
 * Currently, the most reliable option is to perform `get` operation
 * (downside is that it is needless "wasting" of bandwidth, especially for larger documents)
 *
 * @param {string|Key} key
 * @return {boolean}
 */
StorageAdapter.prototype.exists = function(key) {

    var self = this;
    return this.insert(key, true, {expiry: 1}).then(function(result) {
        return false;
    }).catch(function(err) {
        if (err.code == couchbase.errors.keyAlreadyExists) {
            return true;
        } else {
            return Promise.reject(new StorageError(err.message, err.code));
        }
    })
};

/**
 */
StorageAdapter.prototype.disconnect = function() {
    return this.bucket.disconnect();
};

/**
 * @param {string|Array<string>} hosts
 */
StorageAdapter.prototype.enableN1ql = function(hosts) {
    return this.bucket.enableN1ql(hosts);
};
