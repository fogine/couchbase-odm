var _              = require('lodash');
var Promise        = require('bluebird');
var sinon          = require('sinon');
var chai           = require('chai');
var chaiAsPromised = require('chai-as-promised');
var sinonChai      = require("sinon-chai");
var couchbase      = require('couchbase').Mock;
var Document       = require('../../lib/document.js');
var UUID4Key       = require("../../lib/key/uuid4Key.js");
var DocumentError  = require("../../lib/error/documentError.js");
var StorageError   = require("../../lib/error/storageError.js");
var StorageAdapter = require('../../lib/storageAdapter.js');

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised');

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

var assert = sinon.assert;
var expect = chai.expect;

describe("Document", function() {
    before(function() {
        var cluster = new couchbase.Cluster();
        var bucket = cluster.openBucket('test');
        var storageAdapter = new StorageAdapter({bucket: bucket});

        this.key = {
            generate: sinon.stub(UUID4Key.prototype, 'generate'),
            isGenerated: sinon.stub(UUID4Key.prototype, 'isGenerated')
        };

        this.storageAdapter = storageAdapter;
        this.insert = sinon.stub(this.storageAdapter, 'insert');
        this.replace = sinon.stub(this.storageAdapter, 'replace');
        this.remove = sinon.stub(this.storageAdapter, 'remove');
        this.touch = sinon.stub(this.storageAdapter, 'touch');

        this.buildKey = function(reference) {
            var opt = {
                prefix: 'Test',
                delimiter: '_'
            };
            if (reference) opt.reference = reference;

            var key = new UUID4Key(opt);
            return key;
        };
        this.buildDoc = function(data, options) {
            var doc = new Document(_.assign(options, {
                storage: storageAdapter,
                data: data
            }));
            return doc;
        };
    });

    afterEach(function() {
        this.key.generate.reset();
        this.key.isGenerated.reset();
        this.insert.reset();
        this.replace.reset();
        this.remove.reset();
        this.touch.reset();
    });

    after(function() {
        this.key.generate.restore();
        this.key.isGenerated.restore();
        this.insert.restore();
        this.replace.restore();
        this.remove.restore();
        this.touch.restore();
    });

    it('should fail when instance of StorageAdapter is not passed to constructor', function() {
        function test() {
            var doc = new Document({
                storage: {}
            });
        }

        expect(test).to.throw(DocumentError);
    });

    describe('setKey', function() {
       it('should throw a DocumentError when a key value being set is not an instance of `Key` or type of string', function() {
           var doc = this.buildDoc();

           function test() {
               doc.setKey(2);
           }

           expect(test).to.throw(DocumentError);
       });
    });

    describe('getData', function() {
        before(function() {
            this.data = {
                some: 'data'
            };
            this.doc = this.buildDoc(this.data);
        });

        it('should return data associated with a property if the property is provided as a method argument', function() {

            this.doc.getData('some').should.be.equal('data');
        });

        it("should return document's data object when there is no method's argument specified", function() {
            this.doc.getData().should.be.equal(this.data);
        });
    });

    describe('setData', function() {
        describe("with new Document that's never been persisted to a bucket yet", function() {
            before(function() {
                this.data = {};
                this.doc = this.buildDoc(this.data);
            });

            it('should set specified data under specified property', function() {
                this.doc.setData('some', 'data');
                this.doc.getData().should.be.equal(this.data);
                this.doc.getData().should.have.property('some', 'data');
            });

            it('should set specified data by owerwriting current data', function() {
                var data = {some: 'data'};
                this.doc.setData(data);
                this.doc.getData().should.not.be.equal(this.data);
                this.doc.getData().should.be.equal(data);
            });

            it('should return self (the document object)', function() {
                this.doc.setData({}).should.be.equal(this.doc);
            });

            it('should throw a DocumentError when we provide invalid number of arguments', function() {
                expect(this.doc.setData.bind(this.doc, 'key', 'value', 'unexpected third arg'))
                    .to.throw(DocumentError);
            });
        });

        describe('with a Document that is NOT fully loaded from a bucket ', function() {
            before(function() {
                this.data = {};
                this.doc = this.buildDoc(this.data, {
                    isNewRecord: false
                });
            });
        });
    });

    describe('getGeneratedKey', function() {
        it('should fail if `key` is not set at the time of `id` generation', function() {
            var doc = this.buildDoc();
            var promise = doc.getGeneratedKey();
            return promise.should.be.rejected;
        });

        it('should not call `key.generate()` if a key is already generated', function() {

            var doc = this.buildDoc();
            var key = this.buildKey();
            doc.setKey(key);

            this.key.isGenerated.returns(true);

            return doc.getGeneratedKey().bind(this).then(function() {
                this.key.isGenerated.should.have.been.calledOnce;
                this.key.generate.should.have.callCount(0);
            });
        });

        it('should call `key.generate` if a `key` is instance of `Key` and if the key is not generated yet', function() {

            var ref = {};
            var doc = this.buildDoc();
            var key = this.buildKey(ref);
            doc.setKey(key);

            this.key.isGenerated.returns(false);
            this.key.generate.returns(Promise.resolve(key));

            return doc.getGeneratedKey().bind(this).then(function(key) {
                this.key.isGenerated.should.have.been.calledOnce;
                this.key.generate.should.have.callCount(1);
                this.key.generate.should.have.been.calledWithExactly(ref);
                key.should.be.an.instanceof(UUID4Key);
            });
        });

        it('should call `key.generate` with the `doc` as argument if a `Key` is instantiated without `reference` option', function() {

            var doc = this.buildDoc();
            var key = this.buildKey();
            doc.setKey(key);

            this.key.isGenerated.returns(false);
            this.key.generate.returns(Promise.resolve(key));

            return doc.getGeneratedKey().bind(this).then(function(key) {
                this.key.generate.should.have.been.calledWithExactly(doc);
            });
        });
    });

    describe('insert', function() {
        before(function() {
            this.data = { some: 'data' };
            this.opt = {expiry: 15};

            this.doc = this.buildDoc(this.data);
            this.key = this.buildKey();
            this.doc.setKey(this.key);

            this.keyGenerateSpy = sinon.spy(this.doc, 'getGeneratedKey');
        });

        afterEach(function() {
            this.keyGenerateSpy.reset();
        })

        it('should call `doc.getGeneratedKey`', function() {

            this.insert.returns(Promise.resolve({}));

            return this.doc.insert().bind(this).then(function() {
                this.keyGenerateSpy.should.have.been.calledOnce;
            });
        });

        it('should call `doc.getSerializedData`', function() {

            var getDataSpy = sinon.spy(this.doc, 'getSerializedData');
            this.insert.returns(Promise.resolve({}));

            return this.doc.insert().bind(this).then(function() {
                getDataSpy.should.have.been.calledOnce;
            });
        });

        it('should call `storageAdapter.insert` after the `doc.getGeneratedKey` method has been called', function() {

            var response = { cas: 123 };
            this.insert.returns(Promise.resolve(response));

            return this.doc.insert(this.opt).bind(this).then(function(result) {
                this.insert.should.have.been.calledAfter(this.keyGenerateSpy);
                this.insert.should.have.been.calledWith(this.key, this.data, this.opt);
                this.doc.getCAS().should.be.equal(response.cas);
                result.should.be.equal(this.doc);
            });
        });

        it('should assing self (document) to a `StorageError` if storageAdapter.insert is rejected', function() {
            var opt = {expiry: 15};
            var doc = this.buildDoc();
            var key = this.buildKey();
            doc.setKey(key);

            this.insert.returns(Promise.reject(new StorageError));
            var promise = doc.insert(opt);
            return promise.should.be.rejectedWith(StorageError).then(function() {
                return promise.catch(function(err) {
                    err.should.have.property('doc', doc);
                });
            });
        });
    });

    describe('replace', function() {
        before(function() {
            this.data = { some: 'data' };
            this.opt = {expiry: 15};

            this.doc = this.buildDoc(this.data);
            this.key = this.buildKey();
            this.doc.setKey(this.key);

            this.keyGenerateSpy = sinon.spy(this.doc, 'getGeneratedKey');
        });

        afterEach(function() {
            this.keyGenerateSpy.reset();
        })

        it('should call `doc.getGeneratedKey`', function() {

            this.replace.returns(Promise.resolve({}));

            return this.doc.replace().bind(this).then(function() {
                this.keyGenerateSpy.should.have.been.calledOnce;
            });
        });

        it('should call `doc.getSerializedData`', function() {

            var getDataSpy = sinon.spy(this.doc, 'getSerializedData');
            this.replace.returns(Promise.resolve({}));

            return this.doc.replace().bind(this).then(function() {
                getDataSpy.should.have.been.calledOnce;
            });
        });

        it('should call `storageAdapter.replace` after the `doc.getGeneratedKey` method has been called', function() {

            var response = { cas: 123 };
            this.replace.returns(Promise.resolve(response));
            var casBck = this.doc.getCAS();

            return this.doc.replace(this.opt).bind(this).then(function(result) {
                this.replace.should.have.been.calledAfter(this.keyGenerateSpy);
                this.replace.should.have.been.calledWith(
                        this.key,
                        this.data,
                        {expiry: this.opt.expiry, cas: casBck}
                );
                result.should.be.equal(this.doc);
                this.doc.getCAS().should.be.equal(response.cas);
            });
        });

        it('should assing self (document) to a `StorageError` if storageAdapter.replace is rejected', function() {

            this.replace.returns(Promise.reject(new StorageError));
            var promise = this.doc.replace(this.opt);
            var doc = this.doc;

            return promise.should.be.rejectedWith(StorageError).then(function() {
                return promise.catch(function(err) {
                    err.should.have.property('doc', doc);
                });
            });
        });
    });

    describe('remove', function() {
        before(function() {
            this.doc = this.buildDoc();
            this.key = this.buildKey();
            this.doc.setKey(this.key);

            this.keyGenerateSpy = sinon.spy(this.doc, 'getGeneratedKey');
        });

        afterEach(function() {
            this.keyGenerateSpy.reset();
        })

        it('should call `doc.getGeneratedKey`', function() {

            this.remove.returns(Promise.resolve({}));

            return this.doc.remove().bind(this).then(function() {
                this.keyGenerateSpy.should.have.been.calledOnce;
            });
        });

        it('should call `storageAdapter.remove` after the `doc.getGeneratedKey` method has been called', function() {

            var response = { cas: 123 };
            this.remove.returns(Promise.resolve(response));
            var casBck = this.doc.getCAS();

            return this.doc.remove().bind(this).then(function(result) {
                this.remove.should.have.been.calledAfter(this.keyGenerateSpy);
                this.remove.should.have.been.calledWith(
                        this.key,
                        {cas: casBck}
                );
                result.should.be.equal(this.doc);
                this.doc.getCAS().should.be.equal(response.cas);
            });
        });

        it('should assing self (document) to a `StorageError` if storageAdapter.remove is rejected', function() {

            this.remove.returns(Promise.reject(new StorageError));
            var promise = this.doc.remove(this.opt);
            var doc = this.doc;

            return promise.should.be.rejectedWith(StorageError).then(function() {
                return promise.catch(function(err) {
                    err.should.have.property('doc', doc);
                });
            });
        });
    });

    describe('touch', function() {
        before(function() {
            this.doc = this.buildDoc();
            this.key = this.buildKey();
            this.doc.setKey(this.key);
        });

        it('should assign the document object to a StorageError if the error occurs', function() {
            var self = this;

            var error = new StorageError('test error');
            this.touch.returns(Promise.reject(error));

            return this.doc.touch(10).should.be.rejected.then(function(error) {
                error.should.have.property('doc').that.is.equal(self.doc);
            })
        });
    });

    describe('inspect', function() {
        it('should return correctly formated string value', function() {
            var doc = this.buildDoc();
            var key = this.buildKey();
            doc.setKey(key);
            doc.setCAS('12345');

            doc.inspect().should.be.equal(
                    "[object CouchbaseDocument:\n    " +
                    "key: 'Test_undefined'\n    " +
                    "cas: 12345]"
            );
        });

        it('should return correctly formated string value (2)', function() {
            var doc = this.buildDoc();

            doc.inspect().should.be.equal(
                    "[object CouchbaseDocument:\n    " +
                    "key: 'null'\n    " +
                    "cas: null]"
            );
        });
    });
});
