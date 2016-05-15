var sinon          = require('sinon');
var chai           = require('chai');
var chaiAsPromised = require('chai-as-promised');
var sinonChai      = require("sinon-chai");
var couchbase      = require('couchbase').Mock;
var ODM            = require('../../index.js');
var UUID4Key       = require("../../lib/key/uuid4Key.js");
var IncrementalKey = require("../../lib/key/incrementalKey.js");
var ModelManager   = require("../../lib/modelManager.js");
var Model          = require("../../lib/model.js");
var DataTypes      = ODM.DataTypes;

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised');

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

describe('CouchbaseODM', function() {

    before(function() {
        var cluster = new couchbase.Cluster();
        var bucket = cluster.openBucket('coubhasetest');

        this.cluster = cluster;
        this.bucket = bucket;
    });

    it('should implement Hook API', function() {
        var odm = new ODM({});

        odm.should.have.property('runHooks').that.is.a('function');
        odm.should.have.property('addHook').that.is.a('function');
        odm.should.have.property('removeHook').that.is.a('function');

        Object.keys(ODM.Hook.types).forEach(function(hookType) {
            odm.should.have.property(hookType).that.is.a('function');
        });
    });

    it('should assure that all defined hooks are items of an array', function() {
        var beforeValidateHook = sinon.spy();
        var afterValidateHook = sinon.spy();

        var odm = new ODM({
            hooks: {
                beforeValidate: beforeValidateHook,
                afterValidate: [
                    afterValidateHook
                ]
            }
        });

        odm.options.hooks.should.have.property('beforeValidate').that.is.an.instanceof(Array);
        odm.options.hooks.beforeValidate.should.have.lengthOf(1);
        odm.options.hooks.beforeValidate.pop().should.be.equal(beforeValidateHook);

        odm.options.hooks.should.have.property('afterValidate').that.is.an.instanceof(Array);
        odm.options.hooks.afterValidate.should.have.lengthOf(1);
        odm.options.hooks.afterValidate.pop().should.be.equal(afterValidateHook);
    });

    it('should set default options to a Model if options are not set', function() {
        var odm = new ODM({});

        odm.options.should.have.property('key', UUID4Key);
        odm.options.should.have.property('schemaSettings').that.is.eql({
            key: {
                postfix: '',
                delimiter: '_'
            },
            doc: {
                idPropertyName: '_id',
                typePropertyName: '_type'
            }
        });
        odm.options.should.have.property('hooks').that.is.eql({});
        odm.options.should.have.property('timestamps').that.is.equal(true);
        odm.options.should.have.property('paranoid').that.is.equal(false);
        odm.options.should.have.property('camelCase').that.is.equal(false);
        odm.options.should.have.property('classMethods').that.is.eql({});
        odm.options.should.have.property('instanceMethods').that.is.eql({});
        odm.options.should.have.property('bucket').that.is.equal(null);
        odm.options.should.have.property('indexes').that.is.eql({
            refDocs: {}
        });

        odm.should.have.property('modelManager').that.is.an.instanceof(ModelManager);
    });

    describe('define', function() {
        before(function() {
            this.odm = new ODM({
                key: IncrementalKey,
                hooks: {
                    beforeCreate: sinon.spy()
                },
                timestamps: false,
                bucket: this.bucket
            });
        });

        it('should return new Model object with default options inherited from global definition', function() {
            var ModelObject = this.odm.define('ModelName', {
                type: DataTypes.HASH_TABLE
            }, {
                camelCase: true
            });

            ModelObject.should.be.an.instanceof(Model);
            ModelObject.options.should.have.property('key', IncrementalKey);
            ModelObject.options.should.have.property('hooks').that.is.eql(this.odm.options.hooks);
            ModelObject.options.should.have.property('camelCase', true);
            ModelObject.options.should.have.property('bucket', this.bucket);
            ModelObject.options.should.have.property('paranoid', false);
        });

        it('should register created Model object in cache', function() {
            var ModelObject = this.odm.define('ModelName2', {
                type: DataTypes.HASH_TABLE
            }, {
                camelCase: true
            });

            this.odm.modelManager.get('ModelName2').should.be.equal(ModelObject);
        });

        it('should call `Model.$init` with `ModelManager` instance', function() {
            var initSpy = sinon.spy(Model.prototype, '$init');

            var ModelObject = this.odm.define('ModelName3', {
                type: DataTypes.HASH_TABLE
            });

            initSpy.should.have.been.calledOne;
            initSpy.should.have.been.calledWith(this.odm.modelManager);
        });
    });
});
