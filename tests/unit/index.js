const _              = require("lodash");
const Promise        = require('bluebird');
const sinon          = require('sinon');
const sinonChai      = require("sinon-chai");
const chai           = require('chai');
const chaiAsPromised = require('chai-as-promised');
const couchbase      = require('couchbase').Mock;

const ODM          = require('../../index.js');

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised');

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

const assert = sinon.assert;
const expect = chai.expect;

describe('CouchbaseODM', function() {
    before(function() {
        const cluster = new couchbase.Cluster();
        const bucket = this.bucket = cluster.openBucket('functional');
    });

    describe('define', function() {
        before(function() {
            this.odm = new ODM({bucket: this.bucket});
        });

        describe('`hooks` option', function() {
            it('should accept single hook function for given event (hook) type', function() {
                const beforeValidateSpy = sinon.spy();

                const model = this.odm.define('Model', {
                    type: 'string'
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
                const bucketBck = _.cloneDeep(this.bucket);

                const model = this.odm.define('Model2', {
                    type: 'string'
                }, {
                    bucket: this.bucket
                });

                model.storage.bucket.should.be.equal(this.bucket);
                model.storage.bucket.should.be.eql(bucketBck);
            });
        });
    });
});
