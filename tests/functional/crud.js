const _              = require("lodash");
const Promise        = require('bluebird');
const sinon          = require('sinon');
const sinonChai      = require("sinon-chai");
const chai           = require('chai');
const chaiAsPromised = require('chai-as-promised');
const couchbase      = require('couchbase').Mock;
Promise.longStackTraces();

const ODM = require('../../index.js');

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised');

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

const assert = sinon.assert;
const expect = chai.expect;

function defineModel(name, options) {
    options = options || {};

    this.Client = this.odm.define(name, {
        type: 'object',
        properties: {
            name: {
                type: 'string'
            }
        }
    }, {
        timestamps: options.timestamps,
        paranoid: options.paranoid,
        indexes: {
            refDocs: {
                name: {
                    keys: ['name']
                }
            }
        }
    });
}

describe('CRUD operations', function() {
    before('Initialize bucket & Build Models', function() {
        var cluster = new couchbase.Cluster();
        this.bucket = cluster.openBucket('crud');
        this.odm = new ODM({bucket: this.bucket});
    });

    describe('no timestamps', function() {

        before(function() {
            return defineModel.call(this, 'Client');
        });

        after(function() {
            this.odm.Model.validator.removeSchema(/.*/);
        });

        return defineTests();
    });

    describe('with timestamps=true', function() {

        before(function() {
            return defineModel.call(this, 'Client2', {timestamps: true});
        });

        after(function() {
            this.odm.Model.validator.removeSchema(/.*/);
        });

        return defineTests();
    });

    describe('with paranoid=true', function() {

        before(function() {
            return defineModel.call(this, 'Client3', {paranoid: true});
        });

        after(function() {
            this.odm.Model.validator.removeSchema(/.*/);
        });

        return defineTests();
    });

});

function defineTests() {
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

        it('should fail when we try to save invalid data', function() {
            return this.Client.create({
                name: {invalid: 'data'} //invalid
            }).should.be.rejectedWith(ODM.errors.ValidationError);
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

    describe('destroy', function() {
        before(function() {
            return this.Client.create({name: 'destroy'}).bind(this).then(function(client) {
                this.client = client;
            });
        });

        it('should destroy the client document and all its reference documents', function() {
            let message = /key not found/;

            return this.client.destroy().bind(this).then(function() {
                return this.client.getRefDocs();
            }).map(function(refDoc) {
                return refDoc.refresh().should.be.rejectedWith(ODM.errors.StorageError, message);
            }).then(function() {
                if (this.Client.options.paranoid) {
                    this.client.deleted_at.should.instanceof(Date);
                    return this.client.refresh();
                } else {
                    return this.client.refresh().should.be.rejectedWith(ODM.errors.StorageError, message);
                }
            });
        });
    });
}
