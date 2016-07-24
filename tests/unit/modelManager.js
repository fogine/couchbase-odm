var _              = require("lodash");
var Promise        = require('bluebird');
var sinon          = require('sinon');
var chai           = require('chai');
var chaiAsPromised = require('chai-as-promised');
var sinonChai      = require("sinon-chai");
var couchbase      = require('couchbase').Mock;
var ODM            = require('../../index.js');
var DataTypes      = ODM.DataTypes;

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised');

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

var assert = sinon.assert;
var expect = chai.expect;

describe('Model Manager', function() {

    before(function() {
        var cluster = new couchbase.Cluster();
        var bucket = cluster.openBucket('test');

        var odm = new ODM({bucket: bucket});

        this.buildModel = function(name, schema, options) {
            options = _.merge({}, odm.options, options || {});
            var model = new ODM.Model(name, schema, options);
            return model;
        };
    });

    beforeEach(function() {
        this.modelManager = new ODM.ModelManager();
    })

    describe('ModelManager.add', function() {
        it('should throw `ModelManagerError` if provided argument value is not instance of `Model`', function() {
            var self = this;

            var invalidValues = [
                null,
                undefined,
                '',
                'model',
                {},
                [],
                new Date
            ];

            function test(value) {
                self.modelManager.add(value);
            }

            invalidValues.forEach(function(val) {
                expect(test.bind(this, [val])).to.throw(ODM.errors.ModelManagerError);
            })
        })

        it('should throw `ModelManagerError` when we try to register a model object with a name that is already used for another model', function() {
            var self = this;
            var model1 = this.buildModel('test1', {type: DataTypes.STRING});

            this.modelManager.add(model1);

            function test() {
                self.modelManager.add(model1);
            }

            expect(test).to.throw(ODM.errors.ModelManagerError)
        })

        it('should register `Model` object', function() {
            var model1 = this.buildModel('test1', {type: DataTypes.STRING});
            this.modelManager.add(model1);

            this.modelManager.models.should.have.property('test1').which.is.equal(model1);
        })
    })

    describe('ModelManager.get', function() {
        it('should throw `ModelNotFoundError` when we try to get a model object with a name that is not registered', function() {
            var self = this;

            function test() {
                self.modelManager.get('test1');
            }

            expect(test).to.throw(ODM.errors.ModelNotFoundError);
        })

        it('should throw `ModelManagerError` when we provide non-string argument as `name` of a model to the `get` method', function() {
            var self = this;

            var invalidValues = [
                null,
                undefined,
                1,
                new Date,
                {},
                []
            ];

            function test(value) {
                self.modelManager.get(value);
            }

            invalidValues.forEach(function(val) {
                expect(test.bind(this, [val])).to.throw(ODM.errors.ModelManagerError);
            })
        })

        it('should return the Model object', function() {
            var self = this;
            var model1 = this.buildModel('test1', {type: DataTypes.STRING});

            this.modelManager.add(model1);

            this.modelManager.get('test1').should.be.equal(model1);
        })
    })

    describe('ModelManager.getAll', function() {
        it('should return hash table with all registered model objects', function() {
            var self = this;
            var model1 = this.buildModel('test1', {type: DataTypes.STRING});
            var model2 = this.buildModel('test2', {type: DataTypes.STRING});

            this.modelManager.add(model1);
            this.modelManager.add(model2);

            var models = this.modelManager.getAll();

            models.should.have.property('test1', model1);
            models.should.have.property('test2', model2);
        })
    })
});
