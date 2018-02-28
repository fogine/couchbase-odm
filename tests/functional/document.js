var _              = require("lodash");
var Promise        = require('bluebird');
var sinon          = require('sinon');
var sinonChai      = require("sinon-chai");
var chai           = require('chai');
var chaiAsPromised = require('chai-as-promised');
var couchbase      = require('couchbase').Mock;

var ODM = require('../../index.js');

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised');

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

var assert = sinon.assert;
var expect = chai.expect;

describe('Document', function() {
    before('Initialize bucket & storageAdapter', function() {
        var cluster = new couchbase.Cluster();
        this.bucket = cluster.openBucket('documents');
        this.storageAdapter = new ODM.StorageAdapter({bucket: this.bucket});
    });

    describe('touch', function() {
        before(function() {
            this.document = new ODM.Document({
                key: new ODM.UUID4Key({postfix: "", delimiter: "_"}),
                storage: this.storageAdapter,
                data: {some: 'data'}
            });

            return this.document.insert();
        });

        it('should `touch` document and return self', function() {
            return this.document.touch(10).bind(this).then(function(returnValue) {
                var key = this.document.getKey().toString();
                this.bucket.storage.items[key][key].should.have.property('expiry').that.is.instanceof(Date);
                returnValue.should.be.equal(this.document);
            });
        });
    });
});
