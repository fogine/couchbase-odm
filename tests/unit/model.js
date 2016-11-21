var util           = require('util');
var _              = require("lodash");
var Promise        = require('bluebird');
var sinon          = require('sinon');
var chai           = require('chai');
var chaiAsPromised = require('chai-as-promised');
var sinonChai      = require("sinon-chai");
var couchbase      = require('couchbase').Mock;

var ODM        = require('../../index.js');
var ModelError = require('../../lib/error/modelError.js')

var DataTypes = ODM.DataTypes;

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised');

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

var assert = sinon.assert;
var expect = chai.expect;

describe('Model', function() {

    before(function() {
        var cluster = new couchbase.Cluster();
        var bucket = cluster.openBucket('test');

        var odm = new ODM({bucket: bucket});

        this.modelManager = odm.modelManager;
        this.buildModel = function(name, schema, options) {
            options = _.merge({}, odm.options, options || {});
            var model = new ODM.Model(name, schema, options);
            return model;
        };
    });

    describe('constructor', function() {
        it("should throw a ModelError when invalid model's name is provided", function() {
            var self = this;

            function case1() {
                self.buildModel('', {
                    type: DataTypes.STRING
                });
            }

            function case2() {
                self.buildModel({}, {
                    type: DataTypes.STRING
                });
            }

            expect(case1).to.throw(ModelError);
            expect(case2).to.throw(ModelError);
        });

        it("should throw a ModelError when we don't provide valid `options.key` option", function() {
            var self = this;

            function case1() {
                self.buildModel('name', {
                    type: DataTypes.STRING
                }, {
                    key: function() {}
                });
            }

            function case2() {
                self.buildModel('name', {
                    type: DataTypes.STRING
                }, {
                    key: {}
                });
            }

            expect(case1).to.throw(ModelError);
            expect(case2).to.throw(ModelError);
        });
    });

    describe('$init', function() {
        it('should add internal properties to schema if "root" data type is object and if a property is not disabled by option set', function() {
            var model1 = this.buildModel('Test1', {
                type: DataTypes.HASH_TABLE
            }, {timestamps: true});

            var model2 = this.buildModel('Test1a', {
                type: DataTypes.HASH_TABLE
            }, {paranoid: true, timestamps:false});

            var model3 = this.buildModel('Test1b', {
                type: DataTypes.HASH_TABLE
            }, {camelCase: true});

            var model4 = this.buildModel('Test1c', {
                type: DataTypes.HASH_TABLE
            }, {camelCase: true, paranoid: true});

            var model5 = this.buildModel('Test1d', {
                type: DataTypes.HASH_TABLE
            }, {timestamps: false});

            model1.$init(this.modelManager);
            model2.$init(this.modelManager);
            model3.$init(this.modelManager);
            model4.$init(this.modelManager);
            model5.$init(this.modelManager);

            model1.options.schema.schema.should.have.property('_id');
            model1.options.schema.schema.should.have.property('_type');
            model1.options.schema.schema.should.have.property('created_at');
            model1.options.schema.schema.should.have.property('updated_at');

            model2.options.schema.schema.should.have.property('_id');
            model2.options.schema.schema.should.have.property('_type');
            model2.options.schema.schema.should.have.property('created_at');
            model2.options.schema.schema.should.have.property('updated_at');
            model2.options.schema.schema.should.have.property('deleted_at');

            model3.options.schema.schema.should.have.property('_id');
            model3.options.schema.schema.should.have.property('_type');
            model3.options.schema.schema.should.have.property('createdAt');
            model3.options.schema.schema.should.have.property('updatedAt');

            model4.options.schema.schema.should.have.property('_id');
            model4.options.schema.schema.should.have.property('_type');
            model4.options.schema.schema.should.have.property('createdAt');
            model4.options.schema.schema.should.have.property('updatedAt');
            model4.options.schema.schema.should.have.property('deletedAt');

            model5.options.schema.schema.should.have.property('_id');
            model5.options.schema.schema.should.have.property('_type');
            model5.options.schema.schema.should.not.have.property('createdAt');
            model5.options.schema.schema.should.not.have.property('updatedAt');
            model5.options.schema.schema.should.not.have.property('deletedAt');
            model5.options.schema.schema.should.not.have.property('created_at');
            model5.options.schema.schema.should.not.have.property('updated_at');
            model5.options.schema.schema.should.not.have.property('deleted_at');
        });

        it('should NOT add internal schema properties if "root" data type is NOT an `Object`', function() {
            var  types = ['NUMBER', 'INT', 'FLOAT', 'ARRAY', 'STRING', 'BOOLEAN', 'DATE', 'ENUM'];
            var self = this;

            types.forEach(function(type, index) {
                var schema = {
                    type: DataTypes[type]
                };
                if (type === 'ENUM') {
                    schema.enum = [];
                }

                var model = self.buildModel('Test2' + index, schema, {timestamps: true});

                model.$init(self.modelManager);

                if (model.options.schema.schema) {
                    model.options.schema.schema.should.not.have.property('createdAt');
                    model.options.schema.schema.should.not.have.property('updatedAt');
                    model.options.schema.schema.should.not.have.property('deletedAt');
                    model.options.schema.schema.should.not.have.property('created_at');
                    model.options.schema.schema.should.not.have.property('updated_at');
                    model.options.schema.schema.should.not.have.property('deleted_at');
                }
            });
        });

        it('should sanitize `Model`s schema difinition', function() {
            var model = this.buildModel('Test3', {
                type: DataTypes.HASH_TABLE
            }, {});

            var stub = sinon.stub(ODM.SchemaSanitizer, 'sanitize');
            model.$init(this.modelManager);

            stub.should.have.been.calledOnce;
            stub.should.have.been.calledWith(model.options.schema);
            stub.restore();//important!
        });

        it('should fail the initialization if defined `options.key` constructor does not expose valid `dataType` property', function() {
            var self = this;
            function KeyMock() {}
            KeyMock.prototype = Object.create(ODM.Key.prototype);
            KeyMock.prototype.constructor = KeyMock;

            var model = this.buildModel('Test4', {
                type: DataTypes.HASH_TABLE
            }, {key: KeyMock});

            function init() {
                model.$init(self.modelManager);
            }

            expect(init).to.throw(ODM.errors.ModelError);
        });

        it('should add defined `classMethods` to the Model', function() {

            var classMethodSpy = sinon.spy(getAndHash);

            var model = this.buildModel('Test5', {
                type: DataTypes.STRING
            }, {
                classMethods: {
                    getAndHash: classMethodSpy
                }
            });

            model.$init(this.modelManager);

            model.should.have.property('getAndHash').that.is.a('function');
            model.getAndHash();

            function getAndHash() {
                this.should.be.equal(model);
            }
        });

        it('should add defined `instanceMethods` to Instance prototype', function() {

            var instanceMethodSpy = sinon.spy(function() {
                this.should.be.instanceof(ODM.Instance);
            });

            var model = this.buildModel('Test6', {
                type: DataTypes.STRING
            }, {
                instanceMethods: {
                    hash: instanceMethodSpy
                }
            });

            model.$init(this.modelManager);

            var instance = model.build('sometext');

            instance.should.have.property('hash').that.is.a('function');
            instance.hash();
            instanceMethodSpy.should.have.been.calledOnce;
        });

        it('should allow to override already defined `classMethods`', function() {
            var classMethodSpy = sinon.spy(function(originalMethod) {
                originalMethod();
            });

            var model = this.buildModel('Test5', {
                type: DataTypes.STRING
            }, {
                classMethods: {
                    getById: classMethodSpy
                }
            });

            var getByIdStub = sinon.stub(model, 'getById');

            model.$init(this.modelManager);

            model.should.have.property('getById').that.is.a('function');
            model.getById();

            classMethodSpy.should.be.calledOnce;
            classMethodSpy.should.be.calledWith(getByIdStub);
            getByIdStub.should.be.calledOnce;

            getByIdStub.restore();
        });

        it('should allow to override already defined `instanceMethods`', function() {
            var instanceMethodSpy = sinon.spy(function(originalMethod) {
                originalMethod();
            });

            var model = this.buildModel('Test5', {
                type: DataTypes.STRING
            }, {
                instanceMethods: {
                    save: instanceMethodSpy
                }
            });

            var saveStub = sinon.stub(ODM.Instance.prototype, 'save');

            model.$init(this.modelManager);

            var instance = model.build('test');

            instance.should.have.property('save').that.is.a('function');
            instance.save();

            instanceMethodSpy.should.be.calledOnce;
            instanceMethodSpy.should.be.calledWith(saveStub);
            saveStub.should.be.calledOnce;

            saveStub.reset();
            instanceMethodSpy.reset();

            //Test that when we build new Model, the instances of that Model
            //won't have the save method overriden,
            //it should be only Model specific

            var model2 = this.buildModel('Test20', {
                type: DataTypes.STRING
            });
            model2.$init(this.modelManager);

            var instance2 = model2.build('test2');
            instance2.save();

            instanceMethodSpy.should.have.callCount(0);
            saveStub.restore();
        });

        it('should attach `getByRefDoc` methods to the Model object according to `options.indexes.refDocs` options', function() {

            var model = this.buildModel('Test7', {
                type: DataTypes.HASH_TABLE,
                schema: {
                    name: {
                        type: DataTypes.STRING
                    },
                    personalData: {
                        type: DataTypes.HASH_TABLE,
                        schema: {
                            email: {
                                type: DataTypes.STRING
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

            model.$init(this.modelManager);

            var stub = sinon.stub(model.storage, 'get');
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

            model.should.have.property('getByNameAndEmail').that.is.a('function');
            var promise = model.getByNameAndEmail(['testname', 'test@test.com']);

            return promise.should.be.fulfilled.then(function() {
                stub.should.have.been.calledTwice;
                stub.restore();
            });

        });
    });

    describe('buildKey', function() {
        it('should accept whole `key` string in place of `id` (dynamic part of key)', function() {
            var model = this.buildModel('Test8', {
                type: DataTypes.STRING
            }, {key: ODM.UUID4Key});
            model.$init(this.modelManager);

            var stub = sinon.stub(ODM.UUID4Key.prototype, 'parse');

            var keyString = 'Test8_3e5d622e-5786-4d79-9062-b4e2b48ce541';
            var key = model.buildKey(keyString, true);
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
                type: DataTypes.HASH_TABLE,
                schema: {
                    name: {
                        type: DataTypes.STRING
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

            this.model.$init(this.modelManager);
            this.modelWithCustomRefDocKey.$init(this.modelManager);

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
                isWholeKey: true
            });

            refDocKey.getId().should.be.equal('john');
        });
    });

    describe('build', function() {

        it("should return new model's Instance object", function() {
            var model = this.buildModel('BuildInstanceTestModelName', {
                type: DataTypes.BOOLEAN
            });
            model.$init(this.modelManager);

            var instance = model.build(true);

            instance.should.be.an.instanceof(model.Instance);
        });

        describe('`sanitize` option', function() {
            before(function() {
                this.model = this.buildModel('Test9', {
                    type: DataTypes.BOOLEAN
                });
                this.model.$init(this.modelManager);

                this.sanitizeSpy = sinon.spy(this.model.Instance.prototype, 'sanitize');
            });

            beforeEach(function() {
                this.sanitizeSpy.reset();
            });

            after(function() {
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

            it('should sanitize builded data insatnce by default', function() {
                this.model.build(true);

                this.sanitizeSpy.should.have.been.calledOnce;
            });
        });

        describe('default Instance values', function() {
            before(function() {
                this.ownerModel = this.buildModel('Owner', {
                    type: DataTypes.STRING
                });
                this.modelManager.add(this.ownerModel);
                this.ownerModel.$init(this.modelManager);

                this.model = this.buildModel('Car', {
                    type: DataTypes.HASH_TABLE,
                    schema: {
                        color: {
                            type: DataTypes.STRING,
                            default: 'black'
                        },
                        brand: {
                            type: DataTypes.STRING,
                            allowEmptyValue: true
                        },
                        owner: {
                            type: DataTypes.COMPLEX('Owner'),
                            default: this.ownerModel.build('David')
                        },
                        dimensions: {
                            type: DataTypes.HASH_TABLE,
                            schema: {
                                height: {
                                    type: DataTypes.INT,
                                    default: 170
                                },
                                width: {
                                    type: DataTypes.INT,
                                    default: 300
                                },
                                length: {
                                    type: DataTypes.INT,
                                    allowEmptyValue: true
                                },
                            }
                        },
                        accessTypes: {
                            type: DataTypes.ARRAY,
                            default: ['ground', 'air', 'space']
                        },
                        apps: {
                            type: DataTypes.ARRAY,
                            allowEmptyValue: true,
                            schema: {
                                type: DataTypes.STRING,
                                default: 'app_name'
                            }
                        }
                    }
                });

                this.modelManager.add(this.model);
                this.model.$init(this.modelManager);
            });

            after(function() {
                this.modelManager.models = {};
            });

            it('should assign default values to properties with undefined values', function() {
                var instance = this.model.build();
                var data = instance.getData();

                data.should.have.property('color', 'black');
                data.should.have.property('dimensions').that.is.eql({
                    height: 170,
                    width: 300
                });
                data.should.have.property('accessTypes').that.is.eql([
                        'ground', 'air', 'space'
                ]);
                data.should.have.property('owner').that.is.instanceof(this.ownerModel.Instance);
            });

            it('should assign default values to properties with null values', function() {
                var instance = this.model.build({
                    color: null,
                    dimensions: null,
                });
                var data = instance.getData();

                data.should.have.property('color', 'black');
                data.should.have.property('dimensions').that.is.eql({
                    height: 170,
                    width: 300
                });
            });

            it('should assign cloned default owner instance object', function() {
                var instance = this.model.build();
                var data = instance.getData();

                data.should.have.property('owner').that.is.not.equal(this.model.defaults.owner);
                data.owner.getData().should.be.equal(this.model.defaults.owner.getData());
            });

            it('(default values) should not overwrite provided instance data values', function() {
                var instance = this.model.build({
                    accessTypes: ['ground'],
                    dimensions: {
                        length: 350,
                        width: 250
                    },
                    color: 'red'
                });
                var data = instance.getData();

                data.should.have.property('color', 'red');
                data.should.have.property('dimensions').that.is.eql({
                    length: 350,
                    width: 250,
                    height: 170
                });
                data.should.have.property('accessTypes').that.is.eql(['ground']);
            });

            it('should not assign default value to the `apps` collection', function() {
                var instance = this.model.build({});
                var data = instance.getData();

                data.should.have.property('apps', undefined);
            });
        });
    });

    describe('create', function() {
        it('should return fulfilled promise with persisted instance', function() {
            var model = this.buildModel('Test9', {
                type: DataTypes.INT
            });
            model.$init(this.modelManager);
            var saveStub = sinon.stub(model.Instance.prototype, 'save').returns(Promise.resolve());

            var promise = model.create(5);
            return promise.should.have.been.fulfilled.then(function(instance) {
                instance.should.have.been.an.instanceof(model.Instance);
            });
        });

        it('should allow to define a `Key` object under which document should be created', function() {
            var model = this.buildModel('Test11', {
                type: DataTypes.INT
            });
            model.$init(this.modelManager);
            var insertStub = sinon.stub(model.storage, 'insert').returns(Promise.resolve({}));

            var key = model.buildKey('4f1d7ac5-7555-43cc-8699-5e5efa23cd68');

            var promise = model.create(5, {key: key});
            return promise.should.have.been.fulfilled.then(function(instance) {
                insertStub.should.have.been.calledWith(key);
            });
        });

        it('should allow to define an `id` string value a document should be saved with', function() {
            var model = this.buildModel('Test11', {
                type: DataTypes.INT
            });
            model.$init(this.modelManager);
            var insertStub = sinon.stub(model.storage, 'insert').returns(Promise.resolve({}));

            var id = '4f1d7ac5-7555-43cc-8699-5e5efa23cd68';

            var promise = model.create(5, {key: id});
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
                    type: DataTypes.HASH_TABLE
                }, {
                    indexes: {
                        refDocs: {
                            email: {
                                keys: ['email']
                            }
                        }
                    }
                });
                this.model.$init(this.modelManager);
            });

            after(function() {
                delete this.model;
            });

            beforeEach(function() {
                var doc = {
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
                var self = this;
                var key = this.model.buildKey('3e5d622e-5786-4d79-9062-b4e2b48ce541');
                var promise = this.model.getByIdOrFail(key);

                return promise.should.be.fulfilled.then(function(){
                    self.getStub.should.have.been.calledOnce;
                    self.getStub.should.have.been.calledWith(key);
                });
            });

            it('should return resolved Promise with raw data from bucket if method`s `options.plain` option is set', function() {
                var self = this;
                var promise = this.model.getByIdOrFail('3e5d622e-5786-4d79-9062-b4e2b48ce541', {
                    plain:true
                });

                return promise.should.be.fulfilled.then(function(doc){
                    doc.should.not.be.an.instanceof(self.model.Instance);
                    doc.should.have.property('cas');
                    doc.should.have.property('value');
                });
            });

            it('should run defined `beforeGet` and `afterGet` hooks before and after `get` operation', function() {
                var self = this;

                var hookStub = sinon.stub(this.model, 'runHooks').returns(Promise.resolve());

                var options = {
                    hooks: true,
                    paranoid: false
                };

                var optionsMatcher = sinon.match(function(opt) {
                    return opt.hooks === true && opt.paranoid === false;
                });

                var promise = this.model.getByIdOrFail('3e5d622e-5786-4d79-9062-b4e2b48ce541', options);

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
                var self = this;
                var opt = { lockTime: 15 };
                var key = this.model.buildKey('3e5d622e-5786-4d79-9062-b4e2b48ce541');
                var promise = this.model.getByIdOrFail(key, opt);

                return promise.should.be.fulfilled.then(function(doc){
                    self.getStub.should.have.callCount(0);
                    self.getAndLockStub.should.have.been.calledOnce;
                    self.getAndLockStub.should.have.been.calledWith(key, opt);
                });
            });

            it('should call `touch` method for every ref docs if `options.expiry` option is set', function() {
                var self = this;
                var opt = { expiry: 3600 };
                var promise = this.model.getByIdOrFail('3e5d622e-5786-4d79-9062-b4e2b48ce541', opt);

                return promise.should.be.fulfilled.then(function(doc){
                    self.getStub.should.have.callCount(0);
                    self.touchStub.should.have.been.calledOnce;
                    expect(self.touchStub.args[0]).to.have.deep.property('[1]', opt.expiry);
                });
            });

            it('should call `getAndTouch` method on instance if `options.expiry` options is set', function() {
                var self = this;
                var opt = { expiry: 31 };
                var key = this.model.buildKey('3e5d622e-5786-4d79-9062-b4e2b48ce541');
                var promise = this.model.getByIdOrFail(key, opt);

                return promise.should.be.fulfilled.then(function(doc){
                    self.getStub.should.have.callCount(0);
                    self.getAndTouchStub.should.have.been.calledOnce;
                    self.getAndTouchStub.should.have.been.calledWith(key, opt.expiry);
                });
            });

            it('should NOT run hooks if `options.hooks` is false', function() {
                var self = this;

                var hookStub = sinon.stub(this.model, 'runHooks').returns(Promise.resolve());

                var promise = this.model.getByIdOrFail('3e5d622e-5786-4d79-9062-b4e2b48ce541', {
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
                var self = this;

                this.model = this.buildModel('Test20', {
                    type: DataTypes.HASH_TABLE
                }, {
                    paranoid:true,
                    timestamps: true,
                });
                this.model.$init(this.modelManager);

                return this.model.create({some: 'data'}).then(function(doc) {
                    self.doc = doc;
                    return doc.destroy();
                });
            });

            after(function() {
                delete this.model;
                delete this.doc;
            });

            it('should NOT call the `getAndLock` method if the `lockTime` option is set AND the relevant document IS soft-deleted', function() {
                var getAndLockSpy = sinon.spy(this.model.storage, 'getAndLock');
                return this.model.getByIdOrFail(this.doc.getKey(), {lockTime: 20})
                    .should.be.rejected.then(function() {
                        getAndLockSpy.should.have.callCount(0);
                        getAndLockSpy.restore();
                    });
            });

            it('should NOT call the `getAndTouch` method if the `expiry` option is set AND the relevant document IS soft-deleted', function() {
                var getAndTouchSpy = sinon.spy(this.model.storage, 'getAndTouch');
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
                var self = this;

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
            var self = this;

            this.model = this.buildModel('Test20', {
                type: DataTypes.HASH_TABLE
            }, {
                paranoid:true,
                timestamps: true,
            });
            this.model.$init(this.modelManager);

            return this.model.create({some: 'data'}).then(function(doc) {
                self.doc = doc;
                return doc.destroy();
            });
        });

        after(function() {
            delete this.model;
            delete this.doc;
        });

        it('should return resolved promise with `null` if model\'s `options.paranoid` option === true and a document is soft-deleted', function() {
            return this.model.getById(this.doc.getKey()).should.become(null);
        });

        it('should return resolved promise with `null` value if keyNotFound error occurs', function() {
            return this.model.getById('c72714e3-f540-499b-be1c-9d1ab8c991b0').should.become(null);
        });
    });

    describe('getMulti', function() {
        before(function() {
            this.model = this.buildModel('Test11', {
                type: DataTypes.STRING
            }, {});
            this.model.$init(this.modelManager);
        });

        beforeEach(function() {

            var doc = {
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
        });

        it("should return fulfilled promise with data object containing indexed list of results by document's id (indexed=true)", function() {
            var self = this;
            var key = this.model.buildKey('090d4df4-e5f7-4dda-8e78-1fe3e4c5156a');
            var id = '35854458-4b27-4433-8a38-df2ea405e067';

            var pool = [key, id];
            var promise = this.model.getMulti(pool);

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
            var self = this;
            var key = this.model.buildKey('090d4df4-e5f7-4dda-8e78-1fe3e4c5156a');
            var id = '35854458-4b27-4433-8a38-df2ea405e067';

            var pool = [key, id];
            var promise = this.model.getMulti(pool, {indexed: false});

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
            var key = this.model.buildKey('090d4df4-e5f7-4dda-8e78-1fe3e4c5156a');
            var id = '35854458-4b27-4433-8a38-df2ea405e067';

            var keyNotFoundErr = new ODM.errors.StorageError('Key was not found ');
            keyNotFoundErr.code = ODM.StorageAdapter.errorCodes.keyNotFound;

            var networkErr = new ODM.errors.StorageError('Network error');
            networkErr.code = ODM.StorageAdapter.errorCodes.networkError;

            this.getStub.onFirstCall().returns(Promise.reject(keyNotFoundErr));
            this.getStub.onSecondCall().returns(Promise.reject(networkErr));
            var pool = [key, id];
            var promise = this.model.getMulti(pool);

            var expectedOutput = {
                data: {},
                failed: [key.getId(), id],
                resolved: []
            };
            expectedOutput.data[key.getId()] = keyNotFoundErr;
            expectedOutput.data[id] = networkErr;

            return promise.should.become(expectedOutput);
        });

        it('should run hooks only once per `getMulti` operation if `options.individualHooks` option is not set', function() {
            var self = this;
            var key = this.model.buildKey('090d4df4-e5f7-4dda-8e78-1fe3e4c5156a');
            var id = '35854458-4b27-4433-8a38-df2ea405e067';
            var pool = [key, id];

            var hookStub = sinon.stub(this.model, 'runHooks').returns(Promise.resolve());

            var promise = this.model.getMulti(pool, {individualHooks: false});

            return promise.should.be.fulfilled.then(function(results){
                hookStub.should.have.callCount(2);
                hookStub.restore();
            });
        });

        it('should run hooks for each get request if `options.individualHooks` is true', function() {
            var self = this;
            var key = this.model.buildKey('090d4df4-e5f7-4dda-8e78-1fe3e4c5156a');
            var id = '35854458-4b27-4433-8a38-df2ea405e067';
            var pool = [key, id];

            var hookStub = sinon.stub(this.model, 'runHooks').returns(Promise.resolve());

            var promise = this.model.getMulti(pool, {individualHooks: true});

            return promise.should.be.fulfilled.then(function(results){
                hookStub.should.have.callCount(4);
                hookStub.restore();
            });
        });
    });

    describe('remove', function() {
        it('should find a document which should be removed and then call `destroy` method on the instance object', function() {
            var model = this.buildModel('Test12', {
                type: DataTypes.INT
            });
            model.$init(this.modelManager);

            var instance = model.build(5);
            var id = '4f1d7ac5-7555-43cc-8699-5e5efa23cd68';

            var getByIdStub = sinon.stub(ODM.Model.prototype, 'getById').returns(Promise.resolve(instance));
            var destroyStub = sinon.stub(model.Instance.prototype, 'destroy').returns(instance);

            var promise = model.remove(id);

            return promise.should.have.been.fulfilled.then(function(instanceObject) {
                getByIdStub.should.have.been.calledWith(id);
                destroyStub.should.have.been.calledOnce;
                instanceObject.should.be.equal(instance);
                getByIdStub.restore();
                destroyStub.restore();
            });
        });
    });

    describe('touch', function() {
        it('should call `StorageAdapter.touch` method with provided `Key` object and other options', function() {
            var model = this.buildModel('Test13', {
                type: DataTypes.INT
            });
            model.$init(this.modelManager);

            var key = model.buildKey('4f1d7ac5-7555-43cc-8699-5e5efa23cd68');
            var expiry = 50;

            var touchStub = sinon.stub(model.storage, 'touch').returns(Promise.resolve({}));

            var promise = model.touch(key, expiry);

            return promise.should.have.been.fulfilled.then(function() {
                touchStub.should.have.been.calledWithExactly(key, expiry);
                touchStub.should.have.been.calledOnce;
            });
        });

        it('should allow to provide an `id` value instead of whole `Key` object', function() {
            var model = this.buildModel('Test14', {
                type: DataTypes.INT
            });
            model.$init(this.modelManager);

            var id = '4f1d7ac5-7555-43cc-8699-5e5efa23cd68';

            var touchStub = sinon.stub(model.storage, 'touch').returns(Promise.resolve({}));

            var promise = model.touch(id);

            return promise.should.have.been.fulfilled.then(function() {
                var keyArg = touchStub.args[0][0];
                keyArg.should.be.an.instanceof(model.Key);
                keyArg.getId().should.be.equal(id);
                touchStub.should.have.been.calledOnce;
            });
        });
    });

    describe('unlock', function() {
        it('should call `StorageAdapter.unlock` method with provided `Key` object', function() {
            var model = this.buildModel('Test15', {
                type: DataTypes.INT
            });
            model.$init(this.modelManager);

            var key = model.buildKey('4f1d7ac5-7555-43cc-8699-5e5efa23cd68');

            var unlockStub = sinon.stub(model.storage, 'unlock').returns(Promise.resolve({}));

            var promise = model.unlock(key);

            return promise.should.have.been.fulfilled.then(function() {
                unlockStub.should.have.been.calledWith(key);
                unlockStub.should.have.been.calledOnce;
            });
        });

        it('should allow to provide an `id` value instead of whole `Key` object', function() {
            var model = this.buildModel('Test16', {
                type: DataTypes.INT
            });
            model.$init(this.modelManager);

            var id = '4f1d7ac5-7555-43cc-8699-5e5efa23cd68';

            var unlockStub = sinon.stub(model.storage, 'unlock').returns(Promise.resolve({}));

            var promise = model.unlock(id);

            return promise.should.have.been.fulfilled.then(function() {
                var keyArg = unlockStub.args[0][0];
                keyArg.should.be.an.instanceof(model.Key);
                keyArg.getId().should.be.equal(id);
                unlockStub.should.have.been.calledOnce;
            });
        });
    });

    describe('exists', function() {
        it('should call `StorageAdapter.exists` method with provided `Key` object', function() {
            var model = this.buildModel('Test17', {
                type: DataTypes.INT
            });
            model.$init(this.modelManager);

            var key = model.buildKey('4f1d7ac5-7555-43cc-8699-5e5efa23cd68');

            var existsStub = sinon.stub(model.storage, 'exists').returns(Promise.resolve({}));

            var promise = model.exists(key);

            return promise.should.have.been.fulfilled.then(function() {
                existsStub.should.have.been.calledWith(key);
                existsStub.should.have.been.calledOnce;
            });
        });

        it('should allow to provide an `id` value instead of whole `Key` object', function() {
            var model = this.buildModel('Test18', {
                type: DataTypes.INT
            });
            model.$init(this.modelManager);

            var id = '4f1d7ac5-7555-43cc-8699-5e5efa23cd68';

            var existsStub = sinon.stub(model.storage, 'exists').returns(Promise.resolve({}));

            var promise = model.exists(id);

            return promise.should.have.been.fulfilled.then(function() {
                var keyArg = existsStub.args[0][0];
                keyArg.should.be.an.instanceof(model.Key);
                keyArg.getId().should.be.equal(id);
                existsStub.should.have.been.calledOnce;
            });
        });
    });

    describe('getByRefDoc', function() {
        before(function() {
            var modelName = 'Test17';
            var model = this.buildModel(modelName, {
                type: DataTypes.HASH_TABLE,
                schema: {
                    username: {
                        type: DataTypes.STRING
                    }
                }
            }, {
                indexes: {
                    refDocs: {
                        username: {keys: ['username']}
                    }
                }
            });

            model.$init(this.modelManager);

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
        });

        it("should call `Model.getById` with correct document's key and options", function() {

            var self = this;
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

            var getByIdSpy = sinon.spy(this.model, 'getById');

            var options = {
                paranoid: false
            };

            var promise = this.model.getByUsername(username, options);

            promise.catch(function(err) {
                console.error(err);
                throw err;
            })

            return promise.should.have.been.fulfilled.then(function(instance) {
                var keyArg = getByIdSpy.args[0][0];
                self.getStub.should.have.been.calledTwice;

                keyArg.should.be.an.instanceof(self.model.Key);
                keyArg.toString().should.be.equal(key);

                getByIdSpy.should.have.been.calledOne;
                getByIdSpy.should.have.been.calledWith(instance.getKey(), options);

                getByIdSpy.restore();
            });
        })

        it("should return parent's document `Key` object instead of document's data if the `lean` option is set (true)", function() {
            var self = this;
            var id = '4f1d7ac5-7555-43cc-8699-5e5efa23cd68';
            var key = this.modelName + '_' + id;

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
            var self = this;
            var error = new Error('test error');

            //on first call it returns parent document key
            this.getStub.onFirstCall().returns(Promise.reject(error));

            return this.model.getByUsername('happie').should.be.rejectedWith(error);
        });
    });

    describe('toString', function() {
        it('should return correctly formated string', function() {
            var model = this.buildModel('Test21', {
                type: DataTypes.INT
            });
            model.$init(this.modelManager);

            model.toString().should.be.equal('[object CouchbaseModel:Test21]');
        });
    });
});
