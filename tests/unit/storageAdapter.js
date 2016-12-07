var Promise        = require('bluebird');
var sinon          = require('sinon');
var chai           = require('chai');
var chaiAsPromised = require('chai-as-promised');
var sinonChai      = require("sinon-chai");
var couchbase      = require('couchbase').Mock;
var CouchbaseError = require('couchbase').Error;
var BucketManager  = require('couchbase/lib/mock/bucketmgr.js');

var UUID4Key     = require('../../lib/key/uuid4Key.js');
var Document     = require('../../lib/document.js');
var StorageError = require("../../lib/error/storageError.js");

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised');

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

var assert = sinon.assert;
var expect = chai.expect;

describe('StorageAdapter', function() {
    before(function() {
        this.StorageAdapter = require('../../lib/storageAdapter.js');

        var cluster = new couchbase.Cluster();
        var bucket = cluster.openBucket('test');
        var storageAdapter = new this.StorageAdapter({bucket: bucket});

        function DocumentMock() {}

        Document.prototype.insert  = sinon.stub();
        Document.prototype.replace = sinon.stub();
        Document.prototype.upsert  = sinon.stub();
        Document.prototype.remove  = sinon.stub();

        function ViewQueryMock() {}
        function N1qlQueryMock() {}

        this.ViewQueryMock  = couchbase.ViewQuery;
        this.N1qlQueryMock  = couchbase.N1qlQuery;
        this.bucket         = bucket;
        this.storageAdapter = storageAdapter;
        this.Document       = Document;
        this.buildDocument  = function(data) {
            var doc = new Document({
                data: data,
                storage: storageAdapter
            });

            return doc;
        }
    });

    beforeEach(function() {

        this.stubGet         = sinon.stub(this.bucket, 'get').yields(null, {});
        this.stubGetMulti    = sinon.stub(this.bucket, 'getMulti').yields(null, {});
        this.stubGetAndTouch = sinon.stub(this.bucket, 'getAndTouch').yields(null, {});
        this.stubGetAndLock  = sinon.stub(this.bucket, 'getAndLock').yields(null, {});
        this.stubGetReplica  = sinon.stub(this.bucket, 'getReplica').yields(null, {});
        this.stubInsert      = sinon.stub(this.bucket, 'insert').yields(null, {});
        this.stubAppend      = sinon.stub(this.bucket, 'append').yields(null, {});
        this.stubPrepend     = sinon.stub(this.bucket, 'prepend').yields(null, {});
        this.stubCounter     = sinon.stub(this.bucket, 'counter').yields(null, {});
        this.stubQuery       = sinon.stub(this.bucket, 'query').yields(null, {});
        this.stubRemove      = sinon.stub(this.bucket, 'remove').yields(null, {});
        this.stubReplace     = sinon.stub(this.bucket, 'replace').yields(null, {});
        this.stubUpsert      = sinon.stub(this.bucket, 'upsert').yields(null, {});
        this.stubTouch       = sinon.stub(this.bucket, 'touch').yields(null, {});
        this.stubUnlock      = sinon.stub(this.bucket, 'unlock').yields(null, {});
        this.stubDisconnect  = sinon.stub(this.bucket, 'disconnect');
        //enableN1ql is not supported for mocket bucket by couchbase sdk
        this.stubEnableN1ql  = sinon.stub(this.bucket, 'enableN1ql');
    });

    afterEach(function() {

        this.Document.prototype.insert.reset();
        this.Document.prototype.replace.reset();
        this.Document.prototype.upsert.reset();
        this.Document.prototype.remove.reset();

        this.stubGet.restore();
        this.stubGetMulti.restore();
        this.stubGetAndTouch.restore();
        this.stubGetAndLock.restore();
        this.stubGetReplica.restore();
        this.stubInsert.restore();
        this.stubAppend.restore();
        this.stubPrepend.restore();
        this.stubCounter.restore();
        this.stubQuery.restore();
        this.stubRemove.restore();
        this.stubReplace.restore();
        this.stubUpsert.restore();
        this.stubTouch.restore();
        this.stubUnlock.restore();
        this.stubDisconnect.restore();
        this.stubEnableN1ql.restore();
    });

    it('should throw StorageError when `StorageAdapter` is instantiated with bucket which is not instance of Couchbase.Bucket', function() {
        function test() {
            var storageAdapter = new this.StorageAdapter({bucket: {}});
        }

        expect(test.bind(this)).to.throw(StorageError);
    });

    describe('get', function() {
        it('should return a Promise', function() {
            this.storageAdapter.get('key').should.be.an.instanceof(Promise);
        });

        it('should call `bucket.get` with given arguments', function() {
            var key = 'key';
            return this.storageAdapter.get(key).bind(this).then(function() {
                this.stubGet.should.have.been.calledWith(key, {});
                this.stubGet.should.have.been.calledOnce;
            });
        });

        it('should return rejected promise with `StorageError` when a document with given key is not found', function() {
            var key = 'key';
            var error = new Error('test get error');
            error.code = couchbase.errors.keyNotFound;
            this.stubGet.yields(error);

            return this.storageAdapter.get(key).should.be.rejected.then(function(error) {
                error.should.be.instanceof(StorageError);
            });
        });

        it('should return rejected promise with `StorageError` when a document is soft-deleted and `options.paranoid=true`', function() {
            var key = 'key';
            this.stubGet.yields(null, {
                cas: '1234',
                value: {
                    deleted_at: '2016-08-29T11:36:46Z'
                }
            });

            return this.storageAdapter.get(key, {
                paranoid: true,
                deletedAtPropName: 'deleted_at'
            }).should.be.rejected.then(function(error) {
                error.should.be.instanceof(StorageError);
                error.should.be.instanceof(CouchbaseError);
            });
        });
    });

    //describe('getMulti', function() {
        //it('should return a Promise', function() {
            //this.storageAdapter.getMulti(['key']).should.be.an.instanceof(Promise);
        //});

        //it('should call `bucket.getMulti` with given arguments', function() {
            //var keys = ['key'];
            //return this.storageAdapter.getMulti(keys).bind(this).then(function() {
                //this.stubGetMulti.should.have.been.calledWith(keys);
                //this.stubGetMulti.should.have.been.calledOnce;
            //});
        //});
    //});

    describe('getAndTouch', function() {
        it('should return a Promise', function() {
            this.storageAdapter.getAndTouch('key').should.be.an.instanceof(Promise);
        });

        it('should call `bucket.getAndTouch` with given arguments', function() {
            var key = 'key';
            var expiry = 15;
            var options = undefined;

            return this.storageAdapter.getAndTouch(key, expiry, options).bind(this).then(function() {
                this.stubGetAndTouch.should.have.been.calledWith(key, expiry, {});
                this.stubGetAndTouch.should.have.been.calledOnce;
            });
        });

        it('should throw a StorageError if an asynchronous Error is captured', function() {
            var error = new Error('test message');
            error.code = 10;

            this.stubGetAndTouch.reset();
            this.stubGetAndTouch.yields(error);

            return this.storageAdapter.getAndTouch('key').should.be.rejected.then(function(err) {
                err.should.have.property('message', error.message);
                err.should.have.property('code', error.code);
            });
        });
    });

    describe('getAndLock', function() {
        it('should return a Promise', function() {
            this.storageAdapter.getAndLock('key').should.be.an.instanceof(Promise);
        });

        it('should call `bucket.getAndLock` with given arguments', function() {
            var key = 'key';
            var options = undefined;

            return this.storageAdapter.getAndLock(key, options).bind(this).then(function() {
                this.stubGetAndLock.should.have.been.calledWith(key, {});
                this.stubGetAndLock.should.have.been.calledOnce;
            });
        });

        it('should throw a StorageError if an asynchronous Error is captured', function() {
            var error = new Error('test message');
            error.code = 10;

            this.stubGetAndLock.reset();
            this.stubGetAndLock.yields(error);

            return this.storageAdapter.getAndLock('key').should.be.rejected.then(function(err) {
                err.should.have.property('message', error.message);
                err.should.have.property('code', error.code);
            });
        });
    });

    describe('getReplica', function() {
        it('should return a Promise', function() {
            this.storageAdapter.getReplica('key').should.be.an.instanceof(Promise);
        });

        it('should call `bucket.getReplica` with given arguments', function() {
            var key = 'key';
            return this.storageAdapter.getReplica(key).bind(this).then(function() {
                this.stubGetReplica.should.have.been.calledWith(key, {});
                this.stubGetReplica.should.have.been.calledOnce;
            });
        });

        it('should throw a StorageError if an asynchronous Error is captured', function() {
            var error = new Error('test message');
            error.code = 10;

            this.stubGetReplica.reset();
            this.stubGetReplica.yields(error);

            return this.storageAdapter.getReplica('key').should.be.rejected.then(function(err) {
                err.should.have.property('message', error.message);
                err.should.have.property('code', error.code);
            });
        });
    });

    describe('insert', function() {
        it('should return a Promise', function() {
            this.storageAdapter.insert('key', 'data').should.be.an.instanceof(Promise);
        });

        it('should call `bucket.insert` with given arguments', function() {
            var key = 'key';
            var data = {some: 'data'};

            return this.storageAdapter.insert(key, data).bind(this).then(function() {
                this.stubInsert.should.have.been.calledWith(key, data, {});
                this.stubInsert.should.have.been.calledOnce;
            });
        });

    });

    describe('bulkInsert', function() {
        it('should return a Promise', function() {
            this.Document.prototype.insert.returns(Promise.resolve({}));
            var doc = this.buildDocument();;

            this.storageAdapter.bulkInsert([doc])
                .should.be.an.instanceof(Promise);
        });

        it('should call `document.insert` for each document', function() {
            this.Document.prototype.insert.returns(Promise.resolve({}));
            var doc1 = this.buildDocument();
            var doc2 = this.buildDocument();
            var docs = [doc1, doc2];
            var options = {};

            return this.storageAdapter.bulkInsert(docs, options).bind(this).then(function() {
                this.Document.prototype.insert.should.always.have.been.calledWith(options);
                this.Document.prototype.insert.should.have.been.calledTwice;
            });
        });

    });

    describe('bulkInsertSync', function() {
        it('should return a Promise', function() {
            this.storageAdapter.bulkInsertSync([this.buildDocument()])
                .should.be.an.instanceof(Promise);
        });

        it('should call `document.insert` for each document', function() {
            this.Document.prototype.insert.returns(Promise.resolve({}));
            var doc1 = this.buildDocument();
            var doc2 = this.buildDocument();
            var docs = [doc1, doc2];
            var options = {};

            return this.storageAdapter.bulkInsert(docs, options).bind(this).then(function() {
                this.Document.prototype.insert.should.always.have.been.calledWith(options);
                this.Document.prototype.insert.should.have.been.calledTwice;
            });
        });

    });

    describe('getManager', function() {

        it('should return an instance of BucketManager', function() {
            this.storageAdapter.getManager().should.be.an.instanceof(BucketManager);
        });
    });

    describe('append', function() {

        it('should return a Promise', function() {
            this.storageAdapter.append('key', 'value').should.be.an.instanceof(Promise);
        });

        it('should call `bucket.append` with given arguments', function() {
            var key = 'key';
            var data = 'append this string';

            return this.storageAdapter.append(key, data).bind(this).then(function() {
                this.stubAppend.should.have.been.calledWith(key, data, {});
                this.stubAppend.should.have.been.calledOnce;
            });
        });

        it('should throw a StorageError if an asynchronous Error is captured', function() {
            var error = new Error('test message');
            error.code = 10;

            this.stubAppend.reset();
            this.stubAppend.yields(error);

            return this.storageAdapter.append('key').should.be.rejected.then(function(err) {
                err.should.have.property('message', error.message);
                err.should.have.property('code', error.code);
            });
        });
    });

    describe('prepend', function() {

        it('should return a Promise', function() {
            this.storageAdapter.prepend('key', 'value').should.be.an.instanceof(Promise);
        });

        it('should call `bucket.prepend` with given arguments', function() {
            var key = 'key';
            var data = 'prepend this string';

            return this.storageAdapter.prepend(key, data).bind(this).then(function() {
                this.stubPrepend.should.have.been.calledWith(key, data, {});
                this.stubPrepend.should.have.been.calledOnce;
            });
        });

        it('should throw a StorageError if an asynchronous Error is captured', function() {
            var error = new Error('test message');
            error.code = 10;

            this.stubPrepend.reset();
            this.stubPrepend.yields(error);

            return this.storageAdapter.prepend('key').should.be.rejected.then(function(err) {
                err.should.have.property('message', error.message);
                err.should.have.property('code', error.code);
            });
        });
    });

    describe('counter', function() {

        it('should return a Promise', function() {
            this.storageAdapter.counter('key', 1).should.be.an.instanceof(Promise);
        });

        it('should call `bucket.counter` with given arguments', function() {
            var key = 'key';
            var data = 1;

            return this.storageAdapter.counter(key, data).bind(this).then(function() {
                this.stubCounter.should.have.been.calledWith(key, data, {});
                this.stubCounter.should.have.been.calledOnce;
            });
        });

        it('should throw a StorageError if an asynchronous Error is captured', function() {
            var error = new Error('test message');
            error.code = 10;

            this.stubCounter.reset();
            this.stubCounter.yields(error);

            return this.storageAdapter.counter('key').should.be.rejected.then(function(err) {
                err.should.have.property('message', error.message);
                err.should.have.property('code', error.code);
            });
        });
    });

    describe('query', function() {

        it('should return a Promise', function() {
            this.storageAdapter.query(new this.ViewQueryMock).should.be.an.instanceof(Promise);
        });

        it('should call `bucket.query` with given arguments', function() {
            var query = new this.ViewQueryMock;

            return this.storageAdapter.query(query).bind(this).then(function() {
                this.stubQuery.should.have.been.calledWith(query);
                this.stubQuery.should.have.been.calledOnce;
            });
        });

        it('should throw a StorageError if an asynchronous Error is captured', function() {
            var error = new Error('test message');
            error.code = 10;

            this.stubQuery.reset();
            this.stubQuery.yields(error);

            return this.storageAdapter.query('key').should.be.rejected.then(function(err) {
                err.should.have.property('message', error.message);
                err.should.have.property('code', error.code);
            });
        });
    });

    describe('remove', function() {

        it('should return a Promise', function() {
            this.storageAdapter.remove('key').should.be.an.instanceof(Promise);
        });

        it('should call `bucket.remove` with given arguments', function() {
            var key = 'key';
            var options = {};

            return this.storageAdapter.remove(key, options).bind(this).then(function() {
                this.stubRemove.should.have.been.calledWith(key, options);
                this.stubRemove.should.have.been.calledOnce;
            });
        });

        it('should throw a StorageError if an asynchronous Error is captured', function() {
            var error = new Error('test message');
            error.code = 10;

            this.stubRemove.reset();
            this.stubRemove.yields(error);

            return this.storageAdapter.remove('key').should.be.rejected.then(function(err) {
                err.should.have.property('message', error.message);
                err.should.have.property('code', error.code);
            });
        });
    });

    describe('bulkRemove', function() {

        it('should return a Promise', function() {
            this.Document.prototype.remove.returns(Promise.resolve({}));
            this.storageAdapter.bulkRemove([this.buildDocument()]).should.be.an.instanceof(Promise);
        });

        it('should call `document.remove` for each given instance of `Document` and `bucket.remove` for each instance of `Key`', function() {
            this.Document.prototype.remove.returns(Promise.resolve({}));
            var doc = this.buildDocument();
            var key = new UUID4Key({});
            var entities = [key, doc];
            var options = {};

            var removeSpy = sinon.spy(this.storageAdapter, 'remove');

            return this.storageAdapter.bulkRemove(entities, options).bind(this).then(function() {
                this.Document.prototype.remove.should.have.been.calledWith(options);
                this.Document.prototype.remove.should.have.been.calledOnce;
                removeSpy.should.have.been.calledWith(key, options);
                removeSpy.should.have.been.calledOnce;
                removeSpy.restore();
            });
        });

        it('should return fulfilled promise with an array containing a StorageError when we provide an entity that is neither `Document` or `Key`', function() {
            var entities = [{}];
            return this.storageAdapter.bulkRemove(entities).should.be.fulfilled.then(function(results) {
                results.should.have.lengthOf(1);
                results[0].reason().should.be.an.instanceof(StorageError);
            });
        });
    });

    describe('bulkRemoveSync', function() {

        beforeEach(function() {
            this.stub = sinon.stub(this.storageAdapter, 'remove').returns(Promise.resolve({}));
        });

        afterEach(function() {
            this.stub.restore();
        });

        it('should return a Promise', function() {
            var result = this.storageAdapter.bulkRemoveSync([ new UUID4Key({}) ]).should.be.an.instanceof(Promise);
        });

        it('should call `document.remove` for each given instance of `Document` and `bucket.remove` for each instance of `Key`', function() {
            this.Document.prototype.remove.returns(Promise.resolve({}));
            var doc = this.buildDocument();
            var key = new UUID4Key({});
            var entities = [key, doc];
            var options = {};

            return this.storageAdapter.bulkRemoveSync(entities, options).bind(this).then(function() {
                this.Document.prototype.remove.should.have.been.calledWith(options);
                this.Document.prototype.remove.should.have.been.calledOnce;
                this.stub.should.have.been.calledWith(key, options);
                this.stub.should.have.been.calledOnce;
            });
        });

        it('should return rejected promise with a StorageError when we provide an entity that is neither `Document` or `Key`', function() {
            var entities = [{}];
            return this.storageAdapter.bulkRemoveSync(entities).should.be.rejectedWith(StorageError);
        });
    });

    describe('replace', function() {

        it('should return a Promise', function() {
            this.storageAdapter.replace('key', 'value').should.be.an.instanceof(Promise);
        });

        it('should call `bucket.replace` with given arguments', function() {
            var key = 'key';
            var data = {some: 'data'};
            var options = {};

            return this.storageAdapter.replace(key, data).bind(this).then(function() {
                this.stubReplace.should.have.been.calledWith(key, data, options);
                this.stubReplace.should.have.been.calledOnce;
            });
        });

        it('should throw a StorageError if an asynchronous Error is captured', function() {
            var error = new Error('test message');
            error.code = 10;

            this.stubReplace.reset();
            this.stubReplace.yields(error);

            return this.storageAdapter.replace('key').should.be.rejected.then(function(err) {
                err.should.have.property('message', error.message);
                err.should.have.property('code', error.code);
            });
        });
    });

    describe('upsert', function() {

        it('should return a Promise', function() {
            this.storageAdapter.upsert('key', 'value').should.be.an.instanceof(Promise);
        });

        it('should call `bucket.upsert` with given arguments', function() {
            var key = 'key';
            var data = {some: 'data'};
            var options = {};

            return this.storageAdapter.upsert(key, data, options).bind(this).then(function() {
                this.stubUpsert.should.have.been.calledWith(key, data, options);
                this.stubUpsert.should.have.been.calledOnce;
            });
        });

        it('should throw a StorageError if an asynchronous Error is captured', function() {
            var error = new Error('test message');
            error.code = 10;

            this.stubUpsert.reset();
            this.stubUpsert.yields(error);

            return this.storageAdapter.upsert('key').should.be.rejected.then(function(err) {
                err.should.have.property('message', error.message);
                err.should.have.property('code', error.code);
            });
        });
    });

    describe('touch', function() {

        it('should return a Promise', function() {
            this.storageAdapter.touch('key').should.be.an.instanceof(Promise);
        });

        it('should call `bucket.touch` with given arguments', function() {
            var key = 'key';
            var expiry = 5;
            var options = {};

            return this.storageAdapter.touch(key, expiry, options).bind(this).then(function() {
                this.stubTouch.should.have.been.calledWith(key, expiry, options);
                this.stubTouch.should.have.been.calledOnce;
            });
        });

        it('should throw a StorageError if an asynchronous Error is captured', function() {
            var error = new Error('test message');
            error.code = 10;

            this.stubTouch.reset();
            this.stubTouch.yields(error);

            return this.storageAdapter.touch('key').should.be.rejected.then(function(err) {
                err.should.have.property('message', error.message);
                err.should.have.property('code', error.code);
            });
        });
    });

    describe('unlock', function() {

        it('should return a Promise', function() {
            this.storageAdapter.unlock('key').should.be.an.instanceof(Promise);
        });

        it('should call `bucket.unlock` with given arguments', function() {
            var key = 'key';
            var cas = 12312312;//fake CAS - in production it must be Bucket.CAS
            var options = {};

            return this.storageAdapter.unlock(key, cas, options).bind(this).then(function() {
                this.stubUnlock.should.have.been.calledWith(key, cas, options);
                this.stubUnlock.should.have.been.calledOnce;
            });
        });

        it('should throw a StorageError if an asynchronous Error is captured', function() {
            var error = new Error('test message');
            error.code = 10;

            this.stubUnlock.reset();
            this.stubUnlock.yields(error);

            return this.storageAdapter.unlock('key').should.be.rejected.then(function(err) {
                err.should.have.property('message', error.message);
                err.should.have.property('code', error.code);
            });
        });
    });

    describe('exists', function() {

        it('should return a Promise', function() {
            this.storageAdapter.exists('key').should.be.an.instanceof(Promise);
        });

        it('should call `bucket.insert` with given key and return false, signalizing that the document does NOT exists', function() {
            var key = 'key';

            return this.storageAdapter.exists(key).bind(this).then(function(result) {
                result.should.be.equal(false);
                this.stubInsert.should.have.been.calledWith(key, true, {expiry: 1});
                this.stubInsert.should.have.been.calledOnce;
            });
        });

        it('should call `bucket.insert` with given key and return true, signalizing that the document exists', function() {
            var key = 'key2';
            var err = new Error();
            err.code = this.StorageAdapter.errorCodes.keyAlreadyExists;

            this.stubInsert.yields(err);

            return this.storageAdapter.exists(key).bind(this).then(function(result) {
                result.should.be.equal(true);
                this.stubInsert.should.have.been.calledWith(key, true, {expiry: 1});
                this.stubInsert.should.have.been.calledOnce;
            });
        });

        it('should throw a StorageError if an asynchronous Error is captured', function() {
            var error = new Error('test message');
            error.code = 10;

            this.stubInsert.reset();
            this.stubInsert.yields(error);

            return this.storageAdapter.exists('key').should.be.rejected.then(function(err) {
                err.should.have.property('message', error.message);
                err.should.have.property('code', error.code);
            });
        });
    });

    describe('disconnect', function() {

        it('should call `bucket.disconnect`', function() {
            this.storageAdapter.disconnect();
            this.stubDisconnect.should.have.been.calledOnce;
        });
    });

    describe('enableN1ql', function() {

        it('should call `bucket.enableN1ql` method with `hosts` argument', function() {
            var hosts = ['127.0.0.1'];
            this.storageAdapter.enableN1ql(hosts);
            this.stubEnableN1ql.should.have.been.calledWith(hosts);
            this.stubEnableN1ql.should.have.been.calledOnce;
        });
    });
});
