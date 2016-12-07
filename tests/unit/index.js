var _              = require("lodash");
var Promise        = require('bluebird');
var sinon          = require('sinon');
var sinonChai      = require("sinon-chai");
var chai           = require('chai');
var chaiAsPromised = require('chai-as-promised');
var couchbase      = require('couchbase').Mock;

var ODM          = require('../../index.js');

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised');

var DataTypes = ODM.DataTypes;

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

var assert = sinon.assert;
var expect = chai.expect;

describe('CouchbaseODM', function() {
    before(function() {
        var cluster = new couchbase.Cluster();
        var bucket = this.bucket = cluster.openBucket('functional');
    });

    describe('define', function() {
        before(function() {
            this.odm = new ODM({bucket: this.bucket});
        });

        describe('`hooks` option', function() {
            it('should accept single hook function for given event (hook) type', function() {
                var beforeValidateSpy = sinon.spy();

                var model = this.odm.define('Model', {
                    type: DataTypes.STRING
                }, {
                    hooks: {
                        beforeValidate: beforeValidateSpy
                    }
                });

                model.options.hooks.should.have.property('beforeValidate').that.is.instanceof(Array);
                model.options.hooks.beforeValidate.should.include(beforeValidateSpy);
            });
        });

        describe('`bucket` option', function() {
            it('should not modify provided `bucket` option value', function() {
                var bucketBck = _.cloneDeep(this.bucket);

                var model = this.odm.define('Model2', {
                    type: DataTypes.STRING
                }, {
                    bucket: this.bucket
                });

                model.storage.bucket.should.be.equal(this.bucket);
                model.storage.bucket.should.be.eql(bucketBck);
            });
        });
    });
});
