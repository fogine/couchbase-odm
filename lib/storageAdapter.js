var Bucket     = require("couchbase/lib/bucket");
var BucketMock = require("couchbase/lib/mock/bucket");
var Promise    = require("bluebird");
var Key        = require("./key/key.js");
var Document   = require("./document.js");
var _          = require("lodash");
var couchbase  = require('couchbase');

var CouchbaseError = couchbase.Error;
var StorageError = require("./error/storageError");
var StorageMultiError = require("./error/storageMultiError");

module.exports = StorageAdapter;

/**
 * StorageAdapter
 *
 * @constructor
 *
 * @param {Object} [options]
 * @param {Bucket} [options.bucket]
 */
function StorageAdapter(options) {

    if (!(options.bucket instanceof Bucket) && !(options.bucket instanceof BucketMock)) {
        throw new StorageError("`bucket` is not Bucket instance");
    }

    Object.defineProperty(this, "bucket", {
        enumerable: false,
        configurable: false,
        value: options.bucket
    });
}

StorageAdapter.errors = {
    CouchbaseError: CouchbaseError,
    StorageMultiError: StorageMultiError,
    StorageError: StorageError
};

/**
 * get
 *
 * @param {Key} key
 * @param {Object}  [options]
 * @param {boolean} [options.paranoid] - default=`true` if false, both deleted and non-deleted documents will be returned. if `true`, it'll throw `StorageError` (not found) for a document which was sof-deleted.
 * @param {string}  [options.deletedAtPropName] - should be provided if `options.paranoid` === false
 *
 * @return {Promise<Object>}
 */
StorageAdapter.prototype.get = function(key, options) {

    var self = this;
    options = options || {};

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
                return reject(new StorageError('The `key` was not found in the bucket (soft-deleted)', couchbase.errors.keyNotFound));
            }

            return resolve(doc);
        });
    });
}

/**
 * getMulti
 *
 * if `key` from `keys` array is instance Key, it must be already generated
 * returns collection of results where `index` is `key` searched and value is
 * either StorageError or Object result data
 *
 * @param {Array<Key,Buffer,String>} keys
 *
 * @return {Promise<Object>}
 */
//StorageAdapter.prototype.getMulti = function(keys) {

    //var self = this;
    //return new Promise(function(resolve, reject) {

        //return self.bucket.getMulti(keys, function(numOfFailed, docs) {
            //if (numOfFailed == keys.length) {
                //var errs = [];
                //Object.keys(docs).forEach(function(key) {
                    //var err = docs[key].error;
                    //errs.push(new StorageError(err.message, err.code));
                //});
                //return reject(new StorageMultiError(errs));
            //}

            //Object.keys(docs).forEach(function(key) {
                //var result = docs[key];
                //if (result.error instanceof CouchbaseError) {
                    //docs[key] = new StorageError(result.error.message, result.error.code);
                //}
            //});
            //return resolve(docs);
        //});
    //});
//}

/**
 * getAndTouch
 *
 * @param {Key}     key
 * @param {integer} expirty - time in seconds
 * @param {Object}  options
 *
 * @return {Promise<Object>}
 */
StorageAdapter.prototype.getAndTouch = function(key, expiry, options) {

    var self = this;
    return new Promise(function(resolve, reject) {

        return self.bucket.getAndTouch(key.toString(), expiry, options || {}, function(err, doc) {
            if (err) {
                return reject(new StorageError(err.message, err.code));
            }

            return resolve(doc);
        });
    });
}

/**
 * getAndLock
 *
 * @param {Key}     key
 * @param {Object}  [options]
 * @param {integer} [options.lockTime] - time in seconds, default=15, max=30
 *
 * @return {Promise<Object>}
 */
StorageAdapter.prototype.getAndLock = function(key, options) {

    var self = this;
    return new Promise(function(resolve, reject) {

        return self.bucket.getAndLock(key.toString(), options || {}, function(err, doc) {
            if (err) {
                return reject(new StorageError(err.message, err.code));
            }

            return resolve(doc);
        });
    });
}

/**
 * getReplica
 *
 * @param {Key} key
 * @param {Object} [options]
 * @param {intger} [options.index] - `optional` The index for which replica you wish to retrieve this value from, or if undefined, use the value from the first server that replies.
 *
 * @return {Promise<Object>}
 */
StorageAdapter.prototype.getReplica = function(key, options) {

    var self = this;
    return new Promise(function(resolve, reject) {

        return self.bucket.getReplica(key.toString(), options || {}, function(err, doc) {
            if (err) {
                return reject(new StorageError(err.message, err.code));
            }

            return resolve(doc);
        });
    });
}

/**
 * insert
 *
 * @param {Key}     key
 * @param {mixed}   data
 * @param {Object}  [options]
 * @param {integer} [options.expiry] - `optional` default=`0`. Set the initial expiration time for the document. A value of 0 represents never expiring
 * @param {integer} [options.persist_to] - `optional` default=`0` Ensures this operation is persisted to this many nodes
 * @param {integer} [options.replicate_to] - `optional` default=`0` Ensures this operation is replicated to this many nodes
 * @return {Promise<Object>}
 */
StorageAdapter.prototype.insert = function(key, data, options) {

    var self = this;

    return new Promise(function(resolve, reject) {

        //TODO - save correct data
        return self.bucket.insert(key.toString(), data, options || {}, function(err, result) {
            if (err) {
                return reject(new StorageError(err.message, err.code));
            }
            return resolve(result);
        });
    });
}

/**
 * bulkInsert
 *
 * aync version
 *
 * @param {Array<Document>} documents
 * @param {Object}          [options]
 * @param {integer}         [options.expiry] - `optional` default=`0`. Set the initial expiration time for the document. A value of 0 represents never expiring
 * @param {integer}         [options.persist_to] - `optional` default=`0` Ensures this operation is persisted to this many nodes
 * @param {integer}         [options.replicate_to] - `optional` default=`0` Ensures this operation is replicated to this many nodes
 *
 * @return {Promise<Array<PromiseInspection>>}
 */
StorageAdapter.prototype.bulkInsert = function(documents, options) {

    return Promise.all(documents.map(function(doc) {
        return doc.insert(options).reflect();
    }));
}

/**
 * bulkInsertSync
 *
 * @param {Array<Document>} documents
 * @param {Object}          [options]
 * @param {integer}         [options.expiry] - `optional` default=`0`. Set the initial expiration time for the document. A value of 0 represents never expiring
 * @param {integer}         [options.persist_to] - `optional` default=`0` Ensures this operation is persisted to this many nodes
 * @param {integer}         [options.replicate_to] - `optional` default=`0` Ensures this operation is replicated to this many nodes
 *
 * @return {Promise<Array>}
 */
StorageAdapter.prototype.bulkInsertSync = function(documents, options) {

    return Promise.mapSeries(documents, function(doc) {
        return doc.insert(options);
    });
}

/**
 * getManager
 *
 * Returns an instance of a BucketManager for performing management operations against a bucket.
 *
 * @return {BucketManager}
 */
StorageAdapter.prototype.getManager = function() {

    return this.bucket.manager();
}

/**
 * append
 *
 * @param {Key}       key
 * @param {mixed}     value
 * @param {Object}    [options]
 * @param {BucketCAS} [options.cas] - `optional` The CAS value to check. If the item on the server contains a different CAS value, the operation will fail. Note that if this option is undefined, no comparison will be performed.
 * @param {integer}   [options.expiry] - `optional` default=`0`. Set the initial expiration time for the document. A value of 0 represents never expiring
 * @param {integer}   [options.persist_to] - `optional` default=`0` Ensures this operation is persisted to this many nodes
 * @param {integer}   [options.replicate_to] - `optional` default=`0` Ensures this operation is replicated to this many nodes
 *
 * @return {Promise<Object>}
 */
StorageAdapter.prototype.append = function(key, value, options) {

    var self = this;
    return new Promise(function(resolve, reject) {

        return self.bucket.append(key.toString(), value, options || {}, function(err, doc) {
            if (err) {
                return reject(new StorageError(err.message, err.code));
            }

            return resolve(doc);
        });
    });
}

/**
 * prepend
 *
 * @param {Key}       key
 * @param {mixed}     value
 * @param {Object}    [options]
 * @param {BucketCAS} [options.cas] - `optional` The CAS value to check. If the item on the server contains a different CAS value, the operation will fail. Note that if this option is undefined, no comparison will be performed.
 * @param {integer}   [options.expiry] - `optional` default=`0`. Set the initial expiration time for the document. A value of 0 represents never expiring
 * @param {integer}   [options.persist_to] - `optional` default=`0` Ensures this operation is persisted to this many nodes
 * @param {integer}   [options.replicate_to] - `optional` default=`0` Ensures this operation is replicated to this many nodes
 * @return {Promise<Object>}
 */
StorageAdapter.prototype.prepend = function(key, value, options) {

    var self = this;
    return new Promise(function(resolve, reject) {

        return self.bucket.prepend(key.toString(), value, options || {}, function(err, doc) {
            if (err) {
                return reject(new StorageError(err.message, err.code));
            }

            return resolve(doc);
        });
    });
}

/**
 * counter
 *
 * Increments or decrements a key's numeric value.
 * Note that JavaScript does not support 64-bit integers (while libcouchbase and the server do).
 * You might receive an inaccurate value if the number is greater than 53-bits (JavaScript's maximum integer precision).
 *
 * @param {Array<string|Buffer>} key
 * @param {integer}              value
 * @param {Object}               [options]
 * @param {integer}              [options.initial] - `optional` Sets the initial value for the document if it does not exist. Specifying a value of undefined will cause the operation to fail if the document does not exist, otherwise this value must be equal to or greater than 0.
 * @param {integer}              [options.expiry] - `optional` default=`0`. Set the initial expiration time for the document. A value of 0 represents never expiring
 * @param {integer}              [options.persist_to] - `optional` default=`0` Ensures this operation is persisted to this many nodes
 * @param {integer}              [options.replicate_to] - `optional` default=`0` Ensures this operation is replicated to this many nodes
 * @return {Promise<Object>}
 */
StorageAdapter.prototype.counter = function(key, value, options) {

    var self = this;
    return new Promise(function(resolve, reject) {
        return self.bucket.counter(key, value, options || {}, function(err, doc) {
            if (err) {
                return reject(new StorageError(err.message, err.code));
            }

            return resolve(doc);
        });
    });
}

/**
 * query
 *
 * Executes a previously prepared query object. This could be a ViewQuery or a N1qlQuery.
 * Note: N1qlQuery queries are currently an uncommitted interface and may be subject to change in 2.0.0's final release.
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
}

/**
 * remove
 *
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

        self.bucket.remove(key.toString(), options || {}, function(err, result) {
            if (err) {
                return reject(new StorageError(err.message, err.code));
            }
            return resolve(result);
        });
    });
}

/**
 * bulkRemoveSync
 *
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
    return Promise.mapSeries(entities, function(entity) {
        if (entity instanceof Key) {
            return self.remove(entity, options);
        } else if(entity instanceof Document) {
            return entity.remove(options);
        } else {
            var err = new StorageError("Must be instance of `Key` or `Document`");
            return Promise.reject(err);
        }

        function catchErr(err) {
            err.index = entities.indexOf(entity);
            throw err;
        }
    });
}

/**
 * bulkRemove
 *
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
}

/**
 * replace
 *
 * Identical to Bucket#set, but will only succeed if the document exists already.
 *
 * @param {Key}       key
 * @param {mixed}     value
 * @param {Object}    [options]
 * @param {BucketCAS} [options.cas] - `optional` The CAS value to check. If the item on the server contains a different CAS value, the operation will fail. Note that if this option is undefined, no comparison will be performed.
 * @param {integer}   [options.expiry] - `optional` default=`0`. Set the initial expiration time for the document. A value of 0 represents never expiring
 * @param {integer}   [options.persist_to] - `optional` default=`0` Ensures this operation is persisted to this many nodes
 * @param {integer}   [options.replicate_to] - `optional` default=`0` Ensures this operation is replicated to this many nodes
 *
 * @return {Promise<Object>}
 */
StorageAdapter.prototype.replace = function(key, value, options) {

    var self = this;
    return new Promise(function(resolve, reject) {

        return self.bucket.replace(key.toString(), value, options || {}, function(err, result) {
            if (err) {
                return reject(new StorageError(err.message, err.code));
            }

            return resolve(result);
        });
    });
}
/**
 * upsert
 *
 * Identical to Bucket#set, but will only succeed if the document exists already.
 *
 * @param {Key}       key
 * @param {mixed}     value
 * @param {Object}    [options]
 * @param {BucketCAS} [options.cas] - `optional` The CAS value to check. If the item on the server contains a different CAS value, the operation will fail. Note that if this option is undefined, no comparison will be performed.
 * @param {integer}   [options.expiry] - `optional` default=`0`. Set the initial expiration time for the document. A value of 0 represents never expiring
 * @param {integer}   [options.persist_to] - `optional` default=`0` Ensures this operation is persisted to this many nodes
 * @param {integer}   [options.replicate_to] - `optional` default=`0` Ensures this operation is replicated to this many nodes
 *
 * @return {Promise<Object>}
 */
StorageAdapter.prototype.upsert = function(key, value, options) {

    var self = this;
    return new Promise(function(resolve, reject) {

        return self.bucket.upsert(key.toString(), value, options || {}, function(err, result) {
            if (err) {
                return reject(new StorageError(err.message, err.code));
            }

            return resolve(result);
        });
    });
}

/**
 * touch
 *
 * @param {Key}     key
 * @param {integer} expiry - In seconds. The expiration time to use. If a value of 0 is provided, then the current expiration time is cleared and the key is set to never expire. Otherwise, the key is updated to expire in the time provided.
 * @param {Object}  [options]
 * @param {integer} [options.persist_to] - `optional` default=`0` Ensures this operation is persisted to this many nodes
 * @param {integer} [options.replicate_to] - `optional` default=`0` Ensures this operation is replicated to this many nodes
 *
 * @return {Promise<Object>}
 */
StorageAdapter.prototype.touch = function(key, expiry, options) {

    var self = this;
    return new Promise(function(resolve, reject) {

        return self.bucket.touch(key.toString(), expiry, options || {}, function(err, result) {
            if (err) {
                return reject(new StorageError(err.message, err.code));
            }
            return resolve(result);
        });
    });
}

/**
 * unlock
 *
 * @param {Key}        key
 * @param {Bucket.CAS} cas - The CAS value returned when the key was locked. This operation will fail if the CAS value provided does not match that which was the result of the original lock operation.
 * @param {Object}     options
 *
 * @return {Promise<Object>}
 */
StorageAdapter.prototype.unlock = function(key, cas, options) {

    var self = this;
    return new Promise(function(resolve, reject) {

        return self.bucket.unlock(key.toString(), cas, options || {}, function(err, result) {
            if (err) {
                return reject(new StorageError(err.message, err.code));
            }

            return resolve(result);
        });
    });
}

/**
 * disconnect
 */
StorageAdapter.prototype.disconnect = function() {
    return this.bucket.disconnect();
}

/**
 * enableN1ql
 *
 * @param {string|Array<string>} hosts
 */
StorageAdapter.prototype.enableN1ql = function(hosts) {
    return this.bucket.enableN1ql(hosts);
}
