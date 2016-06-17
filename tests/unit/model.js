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

    describe('$init', function() {
        it('should add internal properties to schema if "root" data type is object and if a property is not disabled by option set', function() {
            var model1 = this.buildModel('Test1', {
                type: DataTypes.HASH_TABLE
            }, {timestamps: true});

            var model2 = this.buildModel('Test1a', {
                type: DataTypes.HASH_TABLE
            }, {paranoid: true});

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

            var stub = sinon.stub(ODM.Sanitizer, 'sanitizeSchema').returns(new ODM.Sanitizer.Report);
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
                        getByNameAndEmail: {
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
        });
    });

    describe('build', function() {

        before(function() {
            this.model = this.buildModel('Test9', {
                type: DataTypes.BOOLEAN
            });
            this.model.$init(this.modelManager);
        });

        it('should call `instance.sanitize()` if method`s `options.sanitize` === true ', function() {
            var sanitizeStub = sinon.stub(this.model.Instance.prototype, 'sanitize');
            var instance = this.model.build('somedatastrng', {
                sanitize: true
            });
            var instance2 = this.model.build('somedatastrng');

            instance.should.be.an.instanceof(this.model.Instance);
            instance2.should.be.an.instanceof(this.model.Instance);

            sanitizeStub.should.have.been.calledOnce;
            sanitizeStub.restore();
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

    describe('getById', function() {
        before(function() {
            this.model = this.buildModel('Test10', {
                type: DataTypes.HASH_TABLE
            }, {
                indexes: {
                    refDocs: {
                        getByEmail: {
                            keys: ['email']
                        }
                    }
                }
            });
            this.model.$init(this.modelManager);
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

        after(function() {
            delete this.model;
        });

        it('should accept instance of `Key` in place of `id` string (dynamic part of key)', function() {
            var self = this;
            var key = this.model.buildKey('3e5d622e-5786-4d79-9062-b4e2b48ce541');
            var promise = this.model.getById(key);

            return promise.should.be.fulfilled.then(function(){
                self.getStub.should.have.been.calledOnce;
                self.getStub.should.have.been.calledWith(key);
            });
        });

        it('should return resolved Promise with raw data from bucket if method`s `options.plain` option is set', function() {
            var self = this;
            var promise = this.model.getById('3e5d622e-5786-4d79-9062-b4e2b48ce541', {
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
            var promise = this.model.getById('3e5d622e-5786-4d79-9062-b4e2b48ce541', options);

            return promise.should.be.fulfilled.then(function(doc){
                self.getStub.should.have.been.calledOnce;
                hookStub.firstCall.should.have.been.calledWith(ODM.Hook.types.beforeGet, doc.getKey(), options);
                //does not work for some misterious reason.. probably bug
                //expect(hookStub.firstCall).to.have.been.calledBefore(self.getStub);
                hookStub.secondCall.should.have.been.calledWith(ODM.Hook.types.afterGet, doc, options);
                hookStub.should.have.been.calledTwice;
                hookStub.restore();
            });
        });

        it('should call `getAndLock` instead of `get` if `options.lockTime` is set', function() {
            var self = this;
            var opt = { lockTime: 15 };
            var key = this.model.buildKey('3e5d622e-5786-4d79-9062-b4e2b48ce541');
            var promise = this.model.getById(key, opt);

            return promise.should.be.fulfilled.then(function(doc){
                self.getStub.should.have.callCount(0);
                self.getAndLockStub.should.have.been.calledOnce;
                self.getAndLockStub.should.have.been.calledWith(key, opt);
            });
        });

        it('should call `touch` method for every ref docs if `options.expiry` option is set', function() {
            var self = this;
            var opt = { expiry: 3600 };
            var promise = this.model.getById('3e5d622e-5786-4d79-9062-b4e2b48ce541', opt);

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
            var promise = this.model.getById(key, opt);

            return promise.should.be.fulfilled.then(function(doc){
                self.getStub.should.have.callCount(0);
                self.getAndTouchStub.should.have.been.calledOnce;
                self.getAndTouchStub.should.have.been.calledWith(key, opt.expiry);
            });
        });

        it('should NOT run hooks if `options.hooks` is false', function() {
            var self = this;

            var hookStub = sinon.stub(this.model, 'runHooks').returns(Promise.resolve());

            var promise = this.model.getById('3e5d622e-5786-4d79-9062-b4e2b48ce541', {
                hooks: false
            });

            return promise.should.be.fulfilled.then(function(doc){
                hookStub.should.have.callCount(0);
                hookStub.restore();
            });
        });

        it('TODO should return rejected promise with "storage not found error" if model\'s `options.paranoid` option === true and a document is soft-deleted', function() {
            //TODO
        })

        it('TODO should return fulfilled promise with soft-deleted document if `getById` method\'s `options.paranoid===false`', function() {
            //TODO
        })
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

        it('should return fulfilled promise with id/key indexed list of results', function() {
            var self = this;
            var key = this.model.buildKey('090d4df4-e5f7-4dda-8e78-1fe3e4c5156a');
            var id = '35854458-4b27-4433-8a38-df2ea405e067';

            var pool = [key, id];
            var promise = this.model.getMulti(pool);

            return promise.should.be.fulfilled.then(function(results) {
                self.getStub.should.have.been.calledTwice;
                expect(results).to.have.property(key.getId()).that.is.an.instanceof(self.model.Instance);
                expect(results).to.have.property(id).that.is.an.instanceof(self.model.Instance);
            });

        });

        it('should return rejected promise with `StorageMultiError` when no `key`/`id` is found', function() {
            var key = this.model.buildKey('090d4df4-e5f7-4dda-8e78-1fe3e4c5156a');
            var id = '35854458-4b27-4433-8a38-df2ea405e067';

            this.getStub.returns(Promise.reject(new ODM.errors.StorageError('')));
            var pool = [key, id];
            var promise = this.model.getMulti(pool);

            return promise.should.be.rejectedWith(ODM.errors.StorageMultiError).then(function() {
                return promise.catch(function(err){
                    expect(err.errors).to.have.property(key.getId());
                    expect(err.errors).to.have.property(id);
                });
            });
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
});
