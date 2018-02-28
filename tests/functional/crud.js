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

var DataTypes = ODM.DataTypes;

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

var assert = sinon.assert;
var expect = chai.expect;

describe('CRUD operations', function() {
    before('Initialize bucket & Build Models', function() {
        var cluster = new couchbase.Cluster();
        this.bucket = cluster.openBucket('crud');
        this.odm = new ODM({bucket: this.bucket});

        this.Client = this.odm.define('Client', {
            type: DataTypes.HASH_TABLE,
            schema: {
                name: {
                    type: DataTypes.STRING
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
        });

        after(function() {
            this.Client.removeHook('beforeUpdate', 'beforeUpdate');
        });

        it('should update document with data mutations applied in `beforeUpdate` hook', function() {
            return this.Client.create({name: 'test2'}).then(function(client) {
                return client.update({name: 'test2_updated'});
            }).then(function(client) {
                var nameValueBeforeRefresh = client.getData('name');
                return client.refresh().then(function(client) {
                    client.getData('name').should.be.equal('changed_in_before_update_hook');
                    nameValueBeforeRefresh.should.be.equal('changed_in_before_update_hook');
                });
            });
        });
    });

});
