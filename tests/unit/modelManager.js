const _              = require("lodash");
const Promise        = require('bluebird');
const sinon          = require('sinon');
const chai           = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinonChai      = require("sinon-chai");
const couchbase      = require('couchbase').Mock;
const ODM            = require('../../index.js');

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised');

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

const assert = sinon.assert;
const expect = chai.expect;

describe('Model Manager', function() {

    before(function() {
        const cluster = new couchbase.Cluster();
        const bucket = cluster.openBucket('test');

        const odm = new ODM({bucket: bucket});

        this.buildModel = function(name, schema, options) {
            options = _.merge({}, odm.options, options || {});
            const model = new ODM.Model(name, schema, options);
            return model;
        };
    });

    beforeEach(function() {
        this.modelManager = new ODM.ModelManager();
    })

    describe('ModelManager.add', function() {
        it('should throw `ModelManagerError` if provided argument value is not instance of `Model`', function() {
            const self = this;

            const invalidValues = [
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
            const self = this;
            const model1 = this.buildModel('test1', {type: 'string'});

            this.modelManager.add(model1);

            function test() {
                self.modelManager.add(model1);
            }

            expect(test).to.throw(ODM.errors.ModelManagerError)
        })

        it('should register `Model` object', function() {
            const model1 = this.buildModel('test1', {type: 'string'});
            this.modelManager.add(model1);

            this.modelManager.models.should.have.property('test1').which.is.equal(model1);
        })
    })

    describe('ModelManager.get', function() {
        it('should throw `ModelNotFoundError` when we try to get a model object with a name that is not registered', function() {
            const self = this;

            function test() {
                self.modelManager.get('test1');
            }

            expect(test).to.throw(ODM.errors.ModelNotFoundError);
        })

        it('should throw `ModelManagerError` when we provide non-string argument as `name` of a model to the `get` method', function() {
            const self = this;

            const invalidValues = [
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
            const self = this;
            const model1 = this.buildModel('test1', {type: 'string'});

            this.modelManager.add(model1);

            this.modelManager.get('test1').should.be.equal(model1);
        })
    })

    describe('ModelManager.getAll', function() {
        it('should return hash table with all registered model objects', function() {
            const self = this;
            const model1 = this.buildModel('test1', {type: 'string'});
            const model2 = this.buildModel('test2', {type: 'string'});

            this.modelManager.add(model1);
            this.modelManager.add(model2);

            const models = this.modelManager.getAll();

            models.should.have.property('test1', model1);
            models.should.have.property('test2', model2);
        })
    })
});
