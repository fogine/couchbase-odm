const _              = require("lodash");
const Promise        = require('bluebird');
const sinon          = require('sinon');
const sinonChai      = require("sinon-chai");
const chai           = require('chai');
const chaiAsPromised = require('chai-as-promised');
const couchbase      = require('couchbase').Mock;

const ODM = require('../../index.js');

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised');

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

const assert = sinon.assert;
const expect = chai.expect;

describe('CRUD operations', function() {
    before('Initialize bucket & Build Models', function() {
        var cluster = new couchbase.Cluster();
        this.bucket = cluster.openBucket('crud');
        this.odm = new ODM({bucket: this.bucket});

        this.Client = this.odm.define('Client', {
            type: 'object',
            schema: {
                name: {
                    type: 'string'
                }
            }
        }, {
            indexes: {
                refDocs: {
                    name: {
                        keys: ['name']
                    }
                }
            }
        });
    });

    after(function() {
        this.odm.Model.validator.removeSchema('Client');
    });

    describe('create & get', function() {
        before(function() {
            this.id = '92d64e03-bde9-4e9b-9ff5-29a01ed5dc27';
        });

        it('should `create` document with eplicitly provided id value', function() {
            return this.Client.create({
                name: 'test'
            }, {
                key: this.id
            }).should.be.fulfilled;
        });

        it('should `getByIdOrFail` previosly created Client doc by its id and not fail!', function() {
            return this.Client.getByIdOrFail(this.id).should.be.fulfilled;
        });
    });

    describe('update', function() {
        before(function() {
            this.Client.beforeUpdate(function(client, options) {
                client.setData('name', 'changed_in_before_update_hook');
            }, 'beforeUpdate');

            return this.Client.create({name: 'test2'}).bind(this).then(function(client) {
                this.client = client;
            });
        });

        after(function() {
            this.Client.removeHook('beforeUpdate', 'beforeUpdate');
        });

        it('should update document with data mutations applied in `beforeUpdate` hook', function() {
            return this.client.update({name: 'test2_updated'}).then(function(client) {
                var nameValueBeforeRefresh = client.getData('name');
                return client.refresh().then(function(client) {
                    client.getData('name').should.be.equal('changed_in_before_update_hook');
                    nameValueBeforeRefresh.should.be.equal('changed_in_before_update_hook');
                });
            });
        });
    });

    describe('touch', function() {
        before(function() {
            return this.Client.create({name: 'touch'}).bind(this).then(function(client) {
                this.client = client;
            });
        });

        it('should touch the client document and all its reference documents', function() {
            return this.client.touch(10).bind(this).then(function() {
                var key = this.client.getKey().toString();
                var refDocKey = this.Client.buildRefDocKey('touch', {index: 'name'}).toString();
                var keys = [key, refDocKey];

                keys.forEach(function(key) {
                    this.bucket.storage.items[key][key]
                        .should.have.property('expiry').that.is.instanceof(Date);
                }, this);
            });
        });

        it('should return self (Document instance object)', function() {
            return this.client.touch(10).bind(this).then(function(returnValue) {
                returnValue.should.be.equal(this.client);
            });
        });
    });
});
