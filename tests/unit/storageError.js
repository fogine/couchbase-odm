var sinon     = require('sinon');
var sinonChai = require("sinon-chai");
var chai      = require('chai');
var couchbase = require('couchbase').Mock;

var ODM = require('../../index.js');

chai.use(sinonChai);
chai.should();

var assert = sinon.assert;
var expect = chai.expect;

describe('storageError', function() {
    before(function() {
        var cluster = new couchbase.Cluster();
        this.bucket = cluster.openBucket('crud');
        this.storageAdapter = new ODM.StorageAdapter({bucket: this.bucket});
    });

    describe('toJSON', function() {
        before(function() {
            this.document = new ODM.Document({
                key: new ODM.UUID4Key({postfix: "", delimiter: "_"}),
                storage: this.storageAdapter,
                data: {some: 'data'}
            });

            return this.document.getGeneratedKey();
        });

        it('should return plain object', function() {

            var error = new ODM.errors.StorageError(
                'test message',
                500,
                this.document
            );

            error.toJSON().should.be.eql({
                type: "CouchbaseError",
                message: 'test message',
                code: 500,
                key: this.document.getKey().toString()
            });
        });

        it('should return plain object (2)', function() {

            var error = new ODM.errors.StorageError(
                'test message',
                500
            );

            error.toJSON().should.be.eql({
                type: "CouchbaseError",
                message: 'test message',
                code: 500
            });
        });
    });
});
