const util           = require('util');
const _              = require("lodash");
const Promise        = require('bluebird');
const sinon          = require('sinon');
const chai           = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinonChai      = require("sinon-chai");
const couchbase      = require('couchbase').Mock;

const ODM        = require('../../index.js');
const ModelError = require('../../lib/error/modelError.js')

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised');

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

const assert = sinon.assert;
const expect = chai.expect;

describe('Model', function() {

    before(function() {
        const cluster = new couchbase.Cluster();
        const bucket = cluster.openBucket('test');

        const odm = new ODM({bucket: bucket});
        this.odm = odm;

        this.modelManager = odm.modelManager;
        this.buildModel = function(name, schema, options) {
            options = _.merge({}, odm.options, options || {});
            const model = new ODM.Model(name, schema, options);
            return model;
        };
    });

    describe('constructor', function() {
        after(function() {
            this.odm.Model.validator.removeSchema(/.*/);
        });

        it("should throw a ModelError when invalid model's name is provided", function() {
            const self = this;

            function case1() {
                self.buildModel('', {
                    type: 'string'
                });
            }

            function case2() {
                self.buildModel({}, {
                    type: 'string'
                });
            }

            expect(case1).to.throw(ModelError);
            expect(case2).to.throw(ModelError);
        });

        it("should throw a ModelError when we don't provide valid `options.key` option", function() {
            const self = this;

            function case1() {
                self.buildModel('name', {
                    type: 'string'
                }, {
                    key: function() {}
                });
            }

            function case2() {
                self.buildModel('name2', {
                    type: 'string'
                }, {
                    key: {}
                });
            }

            expect(case1).to.throw(ModelError);
            expect(case2).to.throw(ModelError);
        });
    });

    describe('_init', function() {
        afterEach(function() {
            this.odm.Model.validator.removeSchema(/.*/);
        });

        it('should add internal properties to schema if "root" data type is object and if a property is not disabled by option set', function() {
            const model1 = this.buildModel('Test1', {
                type: 'object'
            }, {timestamps: true});

            const model2 = this.buildModel('Test1a', {
                type: 'object'
            }, {paranoid: true, timestamps:false});

            const model3 = this.buildModel('Test1b', {
                type: 'object'
            }, {camelCase: true});

            const model4 = this.buildModel('Test1c', {
                type: 'object'
            }, {camelCase: true, paranoid: true});

            const model5 = this.buildModel('Test1d', {
                type: 'object'
            }, {timestamps: false});

            model1._init(this.modelManager);
            model2._init(this.modelManager);
            model3._init(this.modelManager);
            model4._init(this.modelManager);
            model5._init(this.modelManager);

            model1.options.schema.properties.should.have.property('_id');
            model1.options.schema.properties.should.have.property('_type');
            model1.options.schema.properties.should.have.property('created_at');
            model1.options.schema.properties.should.have.property('updated_at');

            model2.options.schema.properties.should.have.property('_id');
            model2.options.schema.properties.should.have.property('_type');
            model2.options.schema.properties.should.not.have.property('created_at');
            model2.options.schema.properties.should.not.have.property('updated_at');
            model2.options.schema.properties.should.have.property('deleted_at');

            model3.options.schema.properties.should.have.property('_id');
            model3.options.schema.properties.should.have.property('_type');
            model3.options.schema.properties.should.have.property('createdAt');
            model3.options.schema.properties.should.have.property('updatedAt');

            model4.options.schema.properties.should.have.property('_id');
            model4.options.schema.properties.should.have.property('_type');
            model4.options.schema.properties.should.have.property('createdAt');
            model4.options.schema.properties.should.have.property('updatedAt');
            model4.options.schema.properties.should.have.property('deletedAt');

            model5.options.schema.properties.should.have.property('_id');
            model5.options.schema.properties.should.have.property('_type');
            model5.options.schema.properties.should.not.have.property('createdAt');
            model5.options.schema.properties.should.not.have.property('updatedAt');
            model5.options.schema.properties.should.not.have.property('deletedAt');
            model5.options.schema.properties.should.not.have.property('created_at');
            model5.options.schema.properties.should.not.have.property('updated_at');
            model5.options.schema.properties.should.not.have.property('deleted_at');
        });

        it('should NOT add internal schema properties if "root" data type is NOT an `Object`', function() {
            const  types = ['number', 'integer', 'array', 'string', 'boolean', 'null'];
            const self = this;

            types.forEach(function(type, index) {
                const schema = {
                    type: type
                };

                const model = self.buildModel('Test2' + index, schema, {timestamps: true});

                model._init(self.modelManager);

                if (model.options.schema.properties) {
                    model.options.schema.properties.should.not.have.property('createdAt');
                    model.options.schema.properties.should.not.have.property('updatedAt');
                    model.options.schema.properties.should.not.have.property('deletedAt');
                    model.options.schema.properties.should.not.have.property('created_at');
                    model.options.schema.properties.should.not.have.property('updated_at');
                    model.options.schema.properties.should.not.have.property('deleted_at');
                }
            });
        });

        it('should register `Model`s schema difinition with Ajv validator', function() {
            const model = this.buildModel('Test3', {
                type: 'object'
            }, {});

            const stub = sinon.stub(ODM.Model.validator, 'addSchema');
            model._init(this.modelManager);

            stub.should.have.been.calledThrice;
            stub.getCall(0).should.have.been.calledWith(model.options.schema, model.name);
            stub.restore();//important!
        });

        it('should fail the initialization if defined `options.key` constructor does not expose valid `dataType` property', function() {
            const self = this;
            function KeyMock() {}
            KeyMock.prototype = Object.create(ODM.Key.prototype);
            KeyMock.prototype.constructor = KeyMock;

            const model = this.buildModel('Test4', {
                type: 'object'
            }, {key: KeyMock});

            function init() {
                model._init(self.modelManager);
            }

            expect(init).to.throw(ODM.errors.ModelError);
        });

        it('should add defined `classMethods` to the Model', function() {

            const classMethodSpy = sinon.spy(getAndHash);

            const model = this.buildModel('Test5', {
                type: 'string'
            }, {
                classMethods: {
                    getAndHash: classMethodSpy
                }
            });

            model._init(this.modelManager);

            model.should.have.property('getAndHash').that.is.a('function');
            model.getAndHash();

            function getAndHash() {
                this.should.be.equal(model);
            }
        });

        it('should add defined `instanceMethods` to Instance prototype', function() {

            const instanceMethodSpy = sinon.spy(function() {
                this.should.be.instanceof(ODM.Instance);
            });

            const model = this.buildModel('Test6', {
                type: 'string'
            }, {
                instanceMethods: {
                    hash: instanceMethodSpy
                }
            });

            model._init(this.modelManager);

            const instance = model.build('sometext');

            instance.should.have.property('hash').that.is.a('function');
            instance.hash();
            instanceMethodSpy.should.have.been.calledOnce;
        });

        it('should allow to override already defined `classMethods`', function() {
            const classMethodSpy = sinon.spy(function(originalMethod) {
                originalMethod();
            });

            const model = this.buildModel('Test5', {
                type: 'string'
            }, {
                classMethods: {
                    getById: classMethodSpy
                }
            });

            const getByIdStub = sinon.stub(model, 'getById');

            model._init(this.modelManager);

            model.should.have.property('getById').that.is.a('function');
            model.getById();

            classMethodSpy.should.be.calledOnce;
            classMethodSpy.should.be.calledWith(getByIdStub);
            getByIdStub.should.be.calledOnce;

            getByIdStub.restore();
        });

        it('should allow to override already defined `instanceMethods`', function() {
            const instanceMethodSpy = sinon.spy(function(originalMethod) {
                originalMethod();
            });

            const model = this.buildModel('Test5', {
                type: 'string'
            }, {
                instanceMethods: {
                    save: instanceMethodSpy
                }
            });

            const saveStub = sinon.stub(ODM.Instance.prototype, 'save');

            model._init(this.modelManager);

            const instance = model.build('test');

            instance.should.have.property('save').that.is.a('function');
            instance.save();

            instanceMethodSpy.should.be.calledOnce;
            instanceMethodSpy.should.be.calledWith(saveStub);
            instanceMethodSpy.should.be.calledOn(instance);
            saveStub.should.be.calledOnce;

            saveStub.reset();
            instanceMethodSpy.reset();

            //Test that when we build new Model, the instances of that Model
            //won't have the save method overriden,
            //it should be only Model specific

            const model2 = this.buildModel('Test20', {
                type: 'string'
            });
            model2._init(this.modelManager);

            const instance2 = model2.build('test2');
            instance2.save();

            instanceMethodSpy.should.have.callCount(0);
            saveStub.restore();
        });

        it('should attach `getByRefDoc` && `getByRefDocOrFail` methods to the Model object according to `options.indexes.refDocs` options', function() {

            const model = this.buildModel('Test7', {
                type: 'object',
                required: ['name', 'personalData'],
                properties: {
                    name: {
                        type: 'string'
                    },
                    personalData: {
                        type: 'object',
                        required: ['email'],
                        properties: {
                            email: {
                                type: 'string'
                            }
                        }
                    }
                }
            }, {
                indexes: {
                    refDocs: {
                        nameAndEmail: {
                            keys: ['name', 'personalData.email']
                        }
                    }
                }
            });

            model._init(this.modelManager);

            const stub = sinon.stub(model.storage, 'get');
            //on first call it finds refdoc and returns it's value which is
            //parent document key
            stub.onFirstCall().returns(Promise.resolve({
                cas: '12132',
                value: "Test7_3e5d622e-5786-4d79-9062-b4e2b48ce541"
            }));

            //on second call it returns the document data
            stub.onSecondCall().returns(Promise.resolve({
                cas: '23341',
                value: {
                    name: 'testname',
                    personalData: {
                        email: 'test@test.com'
                    }
                }
            }));

            model.should.have.property('getByNameAndEmailOrFail').that.is.a('function');
            model.should.have.property('getByNameAndEmail').that.is.a('function');
            const promise = model.getByNameAndEmail(['testname', 'test@test.com']);

            return promise.should.be.fulfilled.then(function() {
                stub.should.have.been.calledTwice;
                stub.restore();
            });

        });
    });

    describe('buildKey', function() {
        after(function() {
            this.odm.Model.validator.removeSchema(/.*/);
        });

        it('should accept whole `key` string in place of `id` (dynamic part of key)', function() {
            const model = this.buildModel('Test8', {
                type: 'string'
            }, {key: ODM.UUID4Key});
            model._init(this.modelManager);

            const stub = sinon.stub(ODM.UUID4Key.prototype, 'parse');

            var keyString = 'Test8_3e5d622e-5786-4d79-9062-b4e2b48ce541';
            var key = model.buildKey(keyString, {parse: true});
            key.should.be.an.instanceof(model.Key);
            stub.should.have.been.calledOnce;
            stub.should.have.been.calledWith(keyString);
            stub.restore();
        });
    });

    describe('buildRefDocKey', function() {

        before(function() {

            function CustomRefDocKey(options) {
                ODM.RefDocKey.call(this, options);
            }

            util.inherits(CustomRefDocKey, ODM.RefDocKey);

            var modelSchema = {
                type: 'object',
                required: ['name'],
                properties: {
                    name: {
                        type: 'string'
                    }
                }
            };

            var modelOptinos = {
                indexes: {
                    refDocs: {
                        name: {keys: ["name"]}
                    }
                }
            };

            this.model = this.buildModel('RefDocTestModel', modelSchema, modelOptinos);
            this.modelWithCustomRefDocKey = this.buildModel(
                    'RefDocTestModelWithCustomKey',
                    _.cloneDeep(modelSchema),
                    _.assign({refDocKey: CustomRefDocKey}, modelOptinos)
            );

            this.model._init(this.modelManager);
            this.modelWithCustomRefDocKey._init(this.modelManager);

            this.CustomRefDocKey = CustomRefDocKey;
            this.options = _.merge(
                    {},
                    this.model.options.schemaSettings.key,
                    {ref: ['name']}
            );
        });

        after(function() {
            delete this.model;
            delete this.modelWithCustomRefDocKey;
            delete this.options;
            delete this.CustomRefDocKey;
        });

        it("should return new instance of Model.RefDocKey object with correct initialization values assigned", function() {
            var refDocKey = this.model.buildRefDocKey(null, {
                index: 'name'
            });

            refDocKey.should.be.an.instanceof(this.model.RefDocKey);

            for (var opt in this.options){
                if (this.options.hasOwnProperty(opt)) {
                    refDocKey[opt].should.be.eql(this.options[opt]);
                }
            }
        });

        it("should always return new refDocKey object which includes generic RefDocKey & Key prototypes in it's prototype chain", function() {
            var refDocKey = this.model.buildRefDocKey(null, {index: 'name'});

            refDocKey.should.be.an.instanceof(ODM.RefDocKey);
            refDocKey.should.be.an.instanceof(ODM.Key);
        });

        it("should respect the refDocKey option (set on a Model) which allows to change default prototype object", function() {
            var refDocKey = this.modelWithCustomRefDocKey.buildRefDocKey(null, {
                index: 'name'
            });

            refDocKey.should.be.an.instanceof(this.CustomRefDocKey);
            refDocKey.should.be.an.instanceof(ODM.RefDocKey);
        });

        it('should set provided id argument on key object', function() {
            var refDocKey = this.modelWithCustomRefDocKey.buildRefDocKey('john', {
                index: 'name'
            });

            refDocKey.getId().should.be.equal('john');
        });

        it('should accept whole reference document key string instead just an id', function() {
            var key = 'RefDocTestModel_name_john';
            var refDocKey = this.model.buildRefDocKey(key, {
                index: 'name',
                parse: true
            });

            refDocKey.getId().should.be.equal('john');
        });
    });

    describe('build', function() {

        it("should return new model's Instance object", function() {
            const model = this.buildModel('BuildInstanceTestModelName', {
                type: 'boolean'
            });
            model._init(this.modelManager);

            const instance = model.build(true);

            instance.should.be.an.instanceof(model.Instance);
        });

        describe('`sanitize` option', function() {
            before(function() {
                this.model = this.buildModel('Test9', {
                    type: 'boolean'
                });
                this.model._init(this.modelManager);

                this.sanitizeSpy = sinon.spy(this.model.Instance.prototype, 'sanitize');
            });

            beforeEach(function() {
                this.sanitizeSpy.reset();
            });

            after(function() {
                this.odm.Model.validator.removeSchema(/.*/);
                this.sanitizeSpy.restore();
            });

            it('should call `instance.sanitize()` if method`s `options.sanitize` === true ', function() {
                this.model.build(true, {
                    sanitize: true
                });

                this.sanitizeSpy.should.have.been.calledOnce;
            });

            it("should NOT call `instance.sanitize()` if method's options.sanitize === false", function() {
                this.model.build(true, {
                    sanitize: false
                });

                this.sanitizeSpy.should.have.callCount(0);
            });

            it('should NOT sanitize data when building new insatnce by default', function() {
                this.model.build(true);

                this.sanitizeSpy.should.have.callCount(0);
            });
        });

        describe('default Instance values', function() {
            before(function() {
                this.ownerModel = this.buildModel('Owner', {
                    type: 'string'
                });
                this.modelManager.add(this.ownerModel);
                this.ownerModel._init(this.modelManager);

                this.model = this.buildModel('Car', {
                    type: 'object',
                    required: ['color', 'owner', 'dimensions', 'accessTypes'],
                    properties: {
                        color: {
                            type: 'string',
                            default: 'black'
                        },
                        brand: { type: 'string' },
                        owner: {
                            type: 'object',
                            relation: {type: 'Owner'}
                        },
                        dimensions: {
                            type: 'object',
                            default: {},
                            properties: {
                                height: {
                                    type: 'integer',
                                    default: 170
                                },
                                width: {
                                    type: 'integer',
                                    default: 300
                                },
                                length: { type: 'integer' },
                            }
                        },
                        accessTypes: {
                            type: 'array',
                            default: ['ground', 'air', 'space']
                        },
                        apps: {
                            type: 'array',
                            items: {
                                type: 'string'
                            }
                        }
                    }
                });

                this.modelManager.add(this.model);
                this.model._init(this.modelManager);
            });

            after(function() {
                this.modelManager.models = {};
                this.odm.Model.validator.removeSchema(/.*/);
            });

            it('should assign default values to properties with undefined values', function() {
                const instance = this.model.build();
                const data = instance.getData();

                data.should.have.property('color', 'black');
                data.should.have.property('dimensions').that.is.eql({
                    height: 170,
                    width: 300
                });
                data.should.have.property('accessTypes').that.is.eql([
                        'ground', 'air', 'space'
                ]);
            });

            it('should NOT assign default values to properties with null values', function() {
                const instance = this.model.build({
                    color: null,
                    dimensions: null,
                });
                const data = instance.getData();

                data.should.have.property('color', null);
                data.should.have.property('dimensions', null);
            });

            it('should assign default values to properties with undefined values', function() {
                const instance = this.model.build({
                    color: undefined,
                    dimensions: undefined,
                });
                const data = instance.getData();

                data.should.have.property('color', 'black');
                data.should.have.property('dimensions').that.is.eql({
                    height: 170,
                    width: 300
                });
            });

            it('(default values) should not overwrite provided instance data values', function() {
                const instance = this.model.build({
                    accessTypes: ['ground'],
                    dimensions: {
                        length: 350,
                        width: 250
                    },
                    color: 'red'
                });
                const data = instance.getData();

                data.should.have.property('color', 'red');
                data.should.have.property('dimensions').that.is.eql({
                    length: 350,
                    width: 250,
                    height: 170
                });
                data.should.have.property('accessTypes').that.is.eql(['ground']);
            });

            it('should not assign default value to the `apps` collection', function() {
                const instance = this.model.build({});
                const data = instance.getData();

                data.should.not.have.property('apps');
            });
        });
    });

    describe('create', function() {
        afterEach(function() {
            this.odm.Model.validator.removeSchema(/.*/);
        });

        it('should return fulfilled promise with persisted instance', function() {
            const model = this.buildModel('Test9', {
                type: 'integer'
            });
            model._init(this.modelManager);
            const saveStub = sinon.stub(model.Instance.prototype, 'save').returns(Promise.resolve());

            const promise = model.create(5);
            return promise.should.have.been.fulfilled.then(function(instance) {
                instance.should.have.been.an.instanceof(model.Instance);
            });
        });

        it('should allow to define a `Key` object under which document should be created', function() {
            const model = this.buildModel('Test11', {
                type: 'integer'
            });
            model._init(this.modelManager);
            const insertStub = sinon.stub(model.storage, 'insert').returns(Promise.resolve({}));

            const key = model.buildKey('4f1d7ac5-7555-43cc-8699-5e5efa23cd68');

            const promise = model.create(5, {key: key});
            return promise.should.have.been.fulfilled.then(function(instance) {
                insertStub.should.have.been.calledWith(key);
            });
        });

        it('should allow to define an `id` string value a document should be saved with', function() {
            const model = this.buildModel('Test11', {
                type: 'integer'
            });
            model._init(this.modelManager);
            const insertStub = sinon.stub(model.storage, 'insert').returns(Promise.resolve({}));

            const id = '4f1d7ac5-7555-43cc-8699-5e5efa23cd68';

            const promise = model.create(5, {key: id});
            return promise.should.have.been.fulfilled.then(function(instance) {
                expect(insertStub.args[0][0]).to.be.an.instanceof(model.Key);
                expect(insertStub.args[0][0].getId()).to.be.equal(id);
            });
        });
    });

    describe('getByIdOrFail', function() {
        describe('returns resolved document data', function() {

            before(function() {
                this.model = this.buildModel('Test10', {
                    type: 'object'
                }, {
                    indexes: {
                        refDocs: {
                            email: {
                                keys: ['email']
                            }
                        }
                    }
                });
                this.model._init(this.modelManager);
            });

            after(function() {
                delete this.model;
                this.odm.Model.validator.removeSchema(/.*/);
            });

            beforeEach(function() {
                const doc = {
                    cas: '12312312',
                    value: {
                        _id: '3e5d622e-5786-4d79-9062-b4e2b48ce541',
                        email: 'test@test.com',
                        name: 'test'
                    }
                }

                this.getStub = sinon.stub(this.model.storage, 'get').returns(Promise.resolve(doc));
                this.getAndLockStub = sinon.stub(this.model.storage, 'getAndLock').returns(Promise.resolve(doc));
                this.getAndTouchStub = sinon.stub(this.model.storage, 'getAndTouch').returns(Promise.resolve(doc));
                this.touchStub = sinon.stub(this.model.storage, 'touch').returns(Promise.resolve(doc));
            });

            afterEach(function() {
                this.getStub.restore();
                this.getAndLockStub.restore();
                this.getAndTouchStub.restore();
                this.touchStub.restore();
            });

            it('should accept instance of `Key` in place of `id` string (dynamic part of key)', function() {
                const self = this;
                const key = this.model.buildKey('3e5d622e-5786-4d79-9062-b4e2b48ce541');
                const promise = this.model.getByIdOrFail(key);

                return promise.should.be.fulfilled.then(function(){
                    self.getStub.should.have.been.calledOnce;
                    self.getStub.should.have.been.calledWith(key);
                });
            });

            it('should return resolved Promise with raw data from bucket if method`s `options.plain` option is set', function() {
                const self = this;
                const promise = this.model.getByIdOrFail('3e5d622e-5786-4d79-9062-b4e2b48ce541', {
                    plain:true
                });

                return promise.should.be.fulfilled.then(function(doc){
                    doc.should.not.be.an.instanceof(self.model.Instance);
                    doc.should.have.property('cas');
                    doc.should.have.property('value');
                });
            });

            it('should run defined `beforeGet` and `afterGet` hooks before and after `get` operation', function() {
                const self = this;

                const hookStub = sinon.stub(this.model, 'runHooks').returns(Promise.resolve());

                const options = {
                    hooks: true,
                    paranoid: false
                };

                const optionsMatcher = sinon.match(function(opt) {
                    return opt.hooks === true && opt.paranoid === false;
                });

                const promise = this.model.getByIdOrFail('3e5d622e-5786-4d79-9062-b4e2b48ce541', options);

                return promise.should.be.fulfilled.then(function(doc){
                    self.getStub.should.have.been.calledOnce;
                    hookStub.firstCall.should.have.been.calledWith(
                            ODM.Hook.types.beforeGet,
                            doc.getKey(),
                            optionsMatcher
                    );
                    //does not work for some misterious reason.. probably bug
                    //expect(hookStub.firstCall).to.have.been.calledBefore(self.getStub);
                    hookStub.secondCall.should.have.been.calledWith(
                            ODM.Hook.types.afterGet,
                            doc,
                            optionsMatcher
                    );
                    hookStub.should.have.been.calledTwice;
                    hookStub.restore();
                });
            });

            it('should call `getAndLock` instead of `get` if `options.lockTime` is set', function() {
                const self = this;
                const opt = { lockTime: 15 };
                const key = this.model.buildKey('3e5d622e-5786-4d79-9062-b4e2b48ce541');
                const promise = this.model.getByIdOrFail(key, opt);

                return promise.should.be.fulfilled.then(function(doc){
                    self.getStub.should.have.callCount(0);
                    self.getAndLockStub.should.have.been.calledOnce;
                    self.getAndLockStub.should.have.been.calledWith(key, opt);
                });
            });

            it('should call `touch` method for every ref docs if `options.expiry` option is set', function() {
                const self = this;
                const opt = { expiry: 3600 };
                const promise = this.model.getByIdOrFail('3e5d622e-5786-4d79-9062-b4e2b48ce541', opt);

                return promise.should.be.fulfilled.then(function(doc){
                    self.getStub.should.have.callCount(0);
                    self.touchStub.should.have.been.calledOnce;
                    expect(self.touchStub.args[0]).to.have.deep.property('[1]', opt.expiry);
                });
            });

            it('should call `getAndTouch` method on instance if `options.expiry` options is set', function() {
                const self = this;
                const opt = { expiry: 31 };
                const key = this.model.buildKey('3e5d622e-5786-4d79-9062-b4e2b48ce541');
                const promise = this.model.getByIdOrFail(key, opt);

                return promise.should.be.fulfilled.then(function(doc){
                    self.getStub.should.have.callCount(0);
                    self.getAndTouchStub.should.have.been.calledOnce;
                    self.getAndTouchStub.should.have.been.calledWith(key, opt.expiry);
                });
            });

            it('should NOT run hooks if `options.hooks` is false', function() {
                const self = this;

                const hookStub = sinon.stub(this.model, 'runHooks').returns(Promise.resolve());

                const promise = this.model.getByIdOrFail('3e5d622e-5786-4d79-9062-b4e2b48ce541', {
                    hooks: false
                });

                return promise.should.be.fulfilled.then(function(doc){
                    hookStub.should.have.callCount(0);
                    hookStub.restore();
                });
            });
        });

        describe('performs queries to mocked couchbase version', function() {

            before(function() {
                const self = this;

                this.model = this.buildModel('Test20', {
                    type: 'object'
                }, {
                    paranoid:true,
                    timestamps: true,
                });
                this.model._init(this.modelManager);

                return this.model.create({some: 'data'}).then(function(doc) {
                    self.doc = doc;
                    return doc.destroy();
                });
            });

            after(function() {
                delete this.model;
                delete this.doc;
                this.odm.Model.validator.removeSchema(/.*/);
            });

            it('should NOT call the `getAndLock` method if the `lockTime` option is set AND the relevant document IS soft-deleted', function() {
                const getAndLockSpy = sinon.spy(this.model.storage, 'getAndLock');
                return this.model.getByIdOrFail(this.doc.getKey(), {lockTime: 20})
                    .should.be.rejected.then(function() {
                        getAndLockSpy.should.have.callCount(0);
                        getAndLockSpy.restore();
                    });
            });

            it('should NOT call the `getAndTouch` method if the `expiry` option is set AND the relevant document IS soft-deleted', function() {
                const getAndTouchSpy = sinon.spy(this.model.storage, 'getAndTouch');
                return this.model.getByIdOrFail(this.doc.getKey(), {expiry: 1000})
                    .should.be.rejected.then(function() {
                        getAndTouchSpy.should.have.callCount(0);
                        getAndTouchSpy.restore();
                    });
            });

            it('should return rejected promise with a StorageError (keyNotFound) if model\'s `options.paranoid` option === true and a document is soft-deleted', function() {
                return this.model.getByIdOrFail(this.doc.getKey())
                    .should.be.rejected.then(function(error) {
                        error.should.be.instanceof(ODM.errors.StorageError);
                        error.code.should.be.equal(ODM.StorageAdapter.errorCodes.keyNotFound);
                    });
            });

            it('should return fulfilled promise with soft-deleted document if `getByIdOrFail` method\'s `options.paranoid===false`', function() {
                const self = this;

                return this.model.getByIdOrFail(this.doc.getKey(), {paranoid:false})
                    .should.be.fulfilled.then(function(doc) {
                        doc.getData().should.be.eql(self.doc.getData());
                    });
            });

            it('should return rejected promise with a StorageError code if keyNotFound error occurs', function() {
                return this.model.getByIdOrFail('c72714e3-f540-499b-be1c-9d1ab8c991b0')
                .should.be.rejected.then(function(error) {
                    error.should.be.instanceof(ODM.errors.StorageError);
                    error.code.should.be.equal(ODM.StorageAdapter.errorCodes.keyNotFound);
                });
            });
        });
    });

    describe('getById', function() {
        before(function() {
            const self = this;

            this.model = this.buildModel('Test20', {
                type: 'object'
            }, {
                paranoid:true,
                timestamps: true,
            });
            this.model._init(this.modelManager);

            return this.model.create({some: 'data'}).then(function(doc) {
                self.doc = doc;
                return doc.destroy();
            });
        });

        after(function() {
            delete this.model;
            delete this.doc;
            this.odm.Model.validator.removeSchema(/.*/);
        });

        it('should return resolved promise with `null` if model\'s `options.paranoid` option === true and a document is soft-deleted', function() {
            return this.model.getById(this.doc.getKey()).should.become(null);
        });

        it('should return resolved promise with `null` value if keyNotFound error occurs', function() {
            return this.model.getById('c72714e3-f540-499b-be1c-9d1ab8c991b0').should.become(null);
        });

        it('should return rejected promise with a `StorageError`', function() {
            const error = new ODM.errors.StorageError('getById test error');
            error.code = ODM.StorageAdapter.errorCodes.connectError;

            const getStub = sinon.stub(ODM.StorageAdapter.prototype, 'get');
            getStub.rejects(error);

            return this.model.getById('c72714e3-f540-499b-be1c-9d1ab8c991b0')
                .should.be.rejected.then(function(error) {
                    error.should.be.equal(error);
                    getStub.restore();
                });
        });
    });

    describe('getMulti', function() {
        before(function() {
            this.model = this.buildModel('Test11', {
                type: 'string'
            }, {});
            this.model._init(this.modelManager);
        });

        beforeEach(function() {

            const doc = {
                cas: '12312312',
                value: 'testvalue'
            }

            this.getStub = sinon.stub(this.model.storage, 'get').returns(Promise.resolve(doc));
        });

        afterEach(function() {
            this.getStub.restore();
        });

        after(function() {
            delete this.model;
            this.odm.Model.validator.removeSchema(/.*/);
        });

        it("should return fulfilled promise with data object containing indexed list of results by document's id (indexed=true)", function() {
            const self = this;
            const key = this.model.buildKey('090d4df4-e5f7-4dda-8e78-1fe3e4c5156a');
            const id = '35854458-4b27-4433-8a38-df2ea405e067';

            const pool = [key, id];
            const promise = this.model.getMulti(pool);

            return promise.should.be.fulfilled.then(function(results) {
                self.getStub.should.have.been.calledTwice;
                expect(results.data).to.have.property(key.getId()).that.is.an.instanceof(self.model.Instance);
                expect(results.data).to.have.property(id).that.is.an.instanceof(self.model.Instance);
                results.failed.should.be.eql([]);
                results.resolved.should.be.eql([
                        results.data[key.getId()],
                        results.data[id]
                ]);
            });

        });

        it('should return fulfilled promise with data object containing collection of results (indexed=false)', function() {
            const self = this;
            const key = this.model.buildKey('090d4df4-e5f7-4dda-8e78-1fe3e4c5156a');
            const id = '35854458-4b27-4433-8a38-df2ea405e067';

            const pool = [key, id];
            const promise = this.model.getMulti(pool, {indexed: false});

            return promise.should.be.fulfilled.then(function(results) {
                self.getStub.should.have.been.calledTwice;
                results.data.should.be.an.instanceof(Array);
                results.data.should.have.lengthOf(2);
                results.data[0].getKey().getId().should.be.equal(key.getId());
                results.data[1].getKey().getId().should.be.equal(id);
                results.failed.should.be.eql([]);
                results.resolved.should.be.eql([
                        results.data[0],
                        results.data[1]
                ]);
            });

        });

        it('should include catched errors in place of otherwise resolved values in resolved map object', function() {
            const key = this.model.buildKey('090d4df4-e5f7-4dda-8e78-1fe3e4c5156a');
            const id = '35854458-4b27-4433-8a38-df2ea405e067';

            const keyNotFoundErr = new ODM.errors.StorageError('Key was not found ');
            keyNotFoundErr.code = ODM.StorageAdapter.errorCodes.keyNotFound;

            const networkErr = new ODM.errors.StorageError('Network error');
            networkErr.code = ODM.StorageAdapter.errorCodes.networkError;

            this.getStub.onFirstCall().rejects(keyNotFoundErr);
            this.getStub.onSecondCall().rejects(networkErr);
            const pool = [key, id];
            const promise = this.model.getMulti(pool);

            const expectedOutput = {
                data: {},
                failed: [key.getId(), id],
                resolved: []
            };
            expectedOutput.data[key.getId()] = keyNotFoundErr;
            expectedOutput.data[id] = networkErr;

            return promise.should.become(expectedOutput);
        });

        it('should run hooks only once per `getMulti` operation if `options.individualHooks` option is not set', function() {
            const self = this;
            const key = this.model.buildKey('090d4df4-e5f7-4dda-8e78-1fe3e4c5156a');
            const id = '35854458-4b27-4433-8a38-df2ea405e067';
            const pool = [key, id];

            const hookStub = sinon.stub(this.model, 'runHooks').returns(Promise.resolve());

            const promise = this.model.getMulti(pool, {individualHooks: false});

            return promise.should.be.fulfilled.then(function(results){
                hookStub.should.have.callCount(2);
                hookStub.restore();
            });
        });

        it('should run hooks for each get request if `options.individualHooks` is true', function() {
            const self = this;
            const key = this.model.buildKey('090d4df4-e5f7-4dda-8e78-1fe3e4c5156a');
            const id = '35854458-4b27-4433-8a38-df2ea405e067';
            const pool = [key, id];

            const hookStub = sinon.stub(this.model, 'runHooks').returns(Promise.resolve());

            const promise = this.model.getMulti(pool, {individualHooks: true});

            return promise.should.be.fulfilled.then(function(results){
                hookStub.should.have.callCount(4);
                hookStub.restore();
            });
        });
    });

    describe('remove', function() {
        before(function() {
            this.model = this.buildModel('Test12', {
                type: 'integer'
            });
            this.model._init(this.modelManager);

            this.getByIdStub = sinon.stub(ODM.Model.prototype, 'getByIdOrFail');
        });

        beforeEach(function() {
            this.getByIdStub.reset();
        });

        after(function() {
            this.getByIdStub.restore();
            this.odm.Model.validator.removeSchema(/.*/);
        });

        it('should find a document which should be removed and then call `destroy` method on the instance object', function() {

            const self = this;
            const instance = this.model.build(5);
            const id = '4f1d7ac5-7555-43cc-8699-5e5efa23cd68';

            this.getByIdStub.returns(Promise.resolve(instance));
            const destroyStub = sinon.stub(this.model.Instance.prototype, 'destroy').returns(instance);

            const promise = this.model.remove(id);

            return promise.should.have.been.fulfilled.then(function(instanceObject) {
                self.getByIdStub.should.have.been.calledWith(id);
                destroyStub.should.have.been.calledOnce;
                instanceObject.should.be.equal(instance);
                destroyStub.restore();
            });
        });

        it('should return rejected promise with a `StorageError` when there is no such document in a bucket', function() {
            const keyNotFoundErr = new ODM.errors.StorageError('key not found test error');
            keyNotFoundErr.code = ODM.StorageAdapter.errorCodes.keyNotFound;

            this.getByIdStub.rejects(keyNotFoundErr);
            const promise = this.model.remove('4f1d7ac5-7555-43cc-8699-5e5efa23cd68');

            return promise.should.be.rejectedWith(keyNotFoundErr);
        });
    });

    describe('touch', function() {
        after(function() {
            this.odm.Model.validator.removeSchema(/.*/);
        });

        it('should call `StorageAdapter.touch` method with provided `Key` object and other options', function() {
            const model = this.buildModel('Test13', {
                type: 'integer'
            });
            model._init(this.modelManager);

            const key = model.buildKey('4f1d7ac5-7555-43cc-8699-5e5efa23cd68');
            const expiry = 50;

            const touchStub = sinon.stub(model.storage, 'touch').returns(Promise.resolve({}));

            const promise = model.touch(key, expiry);

            return promise.should.have.been.fulfilled.then(function() {
                touchStub.should.have.been.calledWithExactly(key, expiry);
                touchStub.should.have.been.calledOnce;
            });
        });

        it('should allow to provide an `id` value instead of whole `Key` object', function() {
            const model = this.buildModel('Test14', {
                type: 'integer'
            });
            model._init(this.modelManager);

            const id = '4f1d7ac5-7555-43cc-8699-5e5efa23cd68';

            const touchStub = sinon.stub(model.storage, 'touch').returns(Promise.resolve({}));

            const promise = model.touch(id);

            return promise.should.have.been.fulfilled.then(function() {
                const keyArg = touchStub.args[0][0];
                keyArg.should.be.an.instanceof(model.Key);
                keyArg.getId().should.be.equal(id);
                touchStub.should.have.been.calledOnce;
            });
        });
    });

    describe('unlock', function() {
        after(function() {
            this.odm.Model.validator.removeSchema(/.*/);
        });

        it('should call `StorageAdapter.unlock` method with provided `Key` object', function() {
            const model = this.buildModel('Test15', {
                type: 'integer'
            });
            model._init(this.modelManager);

            const key = model.buildKey('4f1d7ac5-7555-43cc-8699-5e5efa23cd68');
            const cas = '12345';

            const unlockStub = sinon.stub(model.storage, 'unlock').returns(Promise.resolve({}));

            const promise = model.unlock(key, cas);

            return promise.should.have.been.fulfilled.then(function() {
                unlockStub.should.have.been.calledWith(key, cas);
                unlockStub.should.have.been.calledOnce;
            });
        });

        it('should allow to provide an `id` value instead of whole `Key` object', function() {
            const model = this.buildModel('Test16', {
                type: 'integer'
            });
            model._init(this.modelManager);

            const id = '4f1d7ac5-7555-43cc-8699-5e5efa23cd68';
            const cas = '123';

            const unlockStub = sinon.stub(model.storage, 'unlock').returns(Promise.resolve({}));

            const promise = model.unlock(id, cas);

            return promise.should.have.been.fulfilled.then(function() {
                const keyArg = unlockStub.args[0][0];
                unlockStub.should.have.been.calledOnce;
                unlockStub.should.have.been.calledWith(
                    sinon.match.instanceOf(model.Key),
                    cas
                );
                keyArg.getId().should.be.equal(id);
            });
        });
    });

    describe('exists', function() {
        after(function() {
            this.odm.Model.validator.removeSchema(/.*/);
        });

        it('should call `StorageAdapter.exists` method with provided `Key` object', function() {
            const model = this.buildModel('Test17', {
                type: 'integer'
            });
            model._init(this.modelManager);

            const key = model.buildKey('4f1d7ac5-7555-43cc-8699-5e5efa23cd68');

            const existsStub = sinon.stub(model.storage, 'exists').returns(Promise.resolve({}));

            const promise = model.exists(key);

            return promise.should.have.been.fulfilled.then(function() {
                existsStub.should.have.been.calledWith(key);
                existsStub.should.have.been.calledOnce;
            });
        });

        it('should allow to provide an `id` value instead of whole `Key` object', function() {
            const model = this.buildModel('Test18', {
                type: 'integer'
            });
            model._init(this.modelManager);

            const id = '4f1d7ac5-7555-43cc-8699-5e5efa23cd68';

            const existsStub = sinon.stub(model.storage, 'exists').returns(Promise.resolve({}));

            const promise = model.exists(id);

            return promise.should.have.been.fulfilled.then(function() {
                const keyArg = existsStub.args[0][0];
                keyArg.should.be.an.instanceof(model.Key);
                keyArg.getId().should.be.equal(id);
                existsStub.should.have.been.calledOnce;
            });
        });
    });

    describe('getByRefDoc', function() {
        before(function() {
            const modelName = 'Test17';
            const model = this.buildModel(modelName, {
                type: 'object',
                required: ['username'],
                properties: {
                    username: {
                        type: 'string'
                    }
                }
            }, {
                indexes: {
                    refDocs: {
                        username: {keys: ['username']}
                    }
                }
            });

            model._init(this.modelManager);

            this.getStub = sinon.stub(model.storage, 'get');

            this.modelName = modelName;
            this.model = model;
        });

        beforeEach(function() {
            this.getStub.reset();
        });

        after(function() {
            delete this.model;
            delete this.modelName;

            this.getStub.restore();
            this.odm.Model.validator.removeSchema(/.*/);
        });

        describe('getByRefDocOrFail', function() {
            it('should return resolved promise', function() {
                const self = this;
                const id = '4f1d7ac5-7555-43cc-8699-5e5efa23cd68';
                var key = this.modelName + '_' + id;
                var username = 'happie';
                var expectedRefDocKey = this.modelName + '_username_' + username;

                //on first call it returns parent document key
                this.getStub.onFirstCall().returns(Promise.resolve({
                    value: key
                }));
                //on second call it returns parent document data
                this.getStub.onSecondCall().returns(Promise.resolve({
                    _id: id,
                    _type: this.modelName,
                    username: username
                }));

                var getByIdOrFailSpy = sinon.spy(this.model, 'getByIdOrFail');

                var options = {
                    paranoid: false
                };

                var promise = this.model.getByUsernameOrFail(username, options);

                return promise.should.have.been.fulfilled.then(function(instance) {
                    var keyArg = getByIdOrFailSpy.args[0][0];
                    self.getStub.should.have.been.calledTwice;

                    keyArg.should.be.an.instanceof(self.model.Key);
                    keyArg.toString().should.be.equal(key);

                    getByIdOrFailSpy.should.have.been.calledOne;
                    getByIdOrFailSpy.should.have.been.calledWith(instance.getKey(), options);

                    getByIdOrFailSpy.restore();
                });
            });
        });

        describe('getByRefDoc (or null)', function() {
            it("should call `Model.getByIdOrFail` with correct document's key and options", function() {

                const self = this;
                var id = '4f1d7ac5-7555-43cc-8699-5e5efa23cd68';
                var key = this.modelName + '_' + id;
                var username = 'happie';
                var expectedRefDocKey = this.modelName + '_username_' + username;

                //on first call it returns parent document key
                this.getStub.onFirstCall().returns(Promise.resolve({
                    value: key
                }));
                //on second call it returns parent document data
                this.getStub.onSecondCall().returns(Promise.resolve({
                    _id: id,
                    _type: this.modelName,
                    username: username
                }));

                var getByIdOrFailSpy = sinon.spy(this.model, 'getByIdOrFail');

                var options = {
                    paranoid: false
                };

                var promise = this.model.getByUsername(username, options);

                promise.catch(function(err) {
                    console.error(err);
                    throw err;
                })

                return promise.should.have.been.fulfilled.then(function(instance) {
                    var keyArg = getByIdOrFailSpy.args[0][0];
                    self.getStub.should.have.been.calledTwice;

                    keyArg.should.be.an.instanceof(self.model.Key);
                    keyArg.toString().should.be.equal(key);

                    getByIdOrFailSpy.should.have.been.calledOne;
                    getByIdOrFailSpy.should.have.been.calledWith(instance.getKey(), options);

                    getByIdOrFailSpy.restore();
                });
            })

            it("should return parent's document `Key` object instead of document's data if the `lean` option is set (true)", function() {
                const self = this;
                const id = '4f1d7ac5-7555-43cc-8699-5e5efa23cd68';
                const key = this.modelName + '_' + id;

                //on first call it returns parent document key
                this.getStub.onFirstCall().returns(Promise.resolve({
                    value: key
                }));

                return this.model.getByUsername('happie', {lean: true}).should.be.fulfilled.then(function(key) {
                    key.should.be.instanceof(self.model.Key);
                    key.getId().should.be.equal(id);
                })
            });

            it('should return rejected promise with an Error if unexpected Error (other than keyNotFound err) occurs while getting a refDoc document', function() {
                const self = this;
                const error = new Error('test error');

                //on first call it returns parent document key
                this.getStub.onFirstCall().returns(Promise.reject(error));

                return this.model.getByUsername('happie').should.be.rejectedWith(error);
            });
        });
    });

    describe('toString', function() {
        before(function() {
            this.odm.Model.validator.removeSchema(/.*/);
        });

        it('should return correctly formated string', function() {
            const model = this.buildModel('Test21', {
                type: 'integer'
            });
            model._init(this.modelManager);

            model.toString().should.be.equal('[object CouchbaseModel:Test21]');
        });
    });
});
