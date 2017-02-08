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

});
