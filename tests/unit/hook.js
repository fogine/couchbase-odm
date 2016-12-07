var Promise        = require('bluebird');
var sinon          = require('sinon');
var chai           = require('chai');
var chaiAsPromised = require('chai-as-promised');
var sinonChai      = require("sinon-chai");
var Hook           = require("../../lib/hook.js");
var HookError      = require('../../lib/error/hookError.js');

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised');

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

var assert = sinon.assert;
var expect = chai.expect;

describe('Hook', function() {

    before(function() {
        function ModelMock(hooks) {
            this.options = {
                hooks: hooks || {}
            };
        }
        Hook.applyTo(ModelMock);

        this.ModelMock = ModelMock;
        this.buildModel = function(hooks) {

            return new ModelMock(hooks);
        };
    });

    it('should have hook methods attached according to existing hook types', function() {
        var model = this.buildModel();
        var self = this;

        Object.keys(Hook.types).forEach(function(hookType){
            model.should.have.property(hookType).that.is.a('function');
        });

        self.ModelMock.should.have.property('runHooks').that.is.a('function');
        self.ModelMock.should.have.property('removeHook').that.is.a('function');
        self.ModelMock.should.have.property('addHook').that.is.a('function');
    });

    describe('addHook', function() {
        it('should register provided hook function under defined `type` and `name`', function() {
            var model = this.buildModel();

            Object.keys(Hook.types).forEach(function(hookType, index) {
                model.addHook(hookType, function() {}, 'hookName' + index);
            });

            Object.keys(model.options.hooks).should.have.lengthOf(Object.keys(Hook.types).length);
        });

        it('should allow to register unnamed hook function ', function() {
            var model = this.buildModel();

            var hook = function() {};
            model.addHook('beforeValidate', hook);

            Object.keys(model.options.hooks).should.have.lengthOf(1);
            model.options.hooks.beforeValidate.pop().should.be.equal(hook);
        });

        it('should throw `HookError` if invalid `hookType` is supplied', function() {
            var model = this.buildModel();

            function test() {
                var hook = function() {};
                model.addHook('invalidHookType', hook);
            }

            expect(test).to.throw(HookError);
        });

        it('should throw `HookError` if hook is not a function', function() {
            var model = this.buildModel();

            function test() {
                var hook = function() {};
                model.addHook('beforeValidate', null);
            }

            expect(test).to.throw(HookError);
        });
    });

    describe('listenerCount', function() {
        it('should return `0` if there is listener registered', function() {
            var model = this.buildModel({});
            model.listenerCount('beforeValidate').should.be.equal(0);
        });

        it('should return number of registered listeners', function() {
            var model = this.buildModel({
                beforeValidate: [{ name: 'testHook', fn: function(){} }]
            });
            model.listenerCount('beforeValidate').should.be.equal(1);
        });
    });

    describe('removeHook', function() {
        it('should remove registered named-only hook', function() {
            var model = this.buildModel({
                beforeValidate: [
                    { name: 'testHook', fn: function(){} },
                    { name: 'anotherTestHook', fn: function(){} }
                ]
            });

            model.options.hooks.beforeValidate[0].should.have.property('name', 'testHook');
            model.removeHook('beforeValidate', 'testHook');
            model.options.hooks.beforeValidate.should.have.lengthOf(1);
        });

        it('should throw `HookError` if invalid `hookType` is supplied', function() {
            var model = this.buildModel({
                beforeValidate: [
                    { name: 'testHook', fn: function(){} }
                ]
            });

            function test() {
                model.removeHook('beforeValid', 'testHook');
            }

            expect(test).to.throw(HookError);
        });
    });

    describe('runHooks', function() {

        it('should call all registered hooks of given type', function() {
            var hookSpyAsync1 = sinon.spy();
            var hookSpyAsync2 = sinon.spy();

            var hookSpySync1 = sinon.spy();
            var hookSpySync2 = sinon.spy();

            var model = this.buildModel({
                beforeCreate: [
                    { name: 'testHookAsync', fn: hookSpyAsync1 },
                    hookSpyAsync2,
                ],
                beforeValidate: [
                    { name: 'testHookSync', fn: hookSpySync1 },
                    hookSpySync2
                ]
            });

            var obj = {};

            model.runHooks('beforeValidate', obj);
            model.runHooks(Hook.types.beforeValidate, obj);

            hookSpySync1.should.have.been.calledTwice;
            hookSpySync1.should.have.been.calledWith(obj);
            hookSpySync2.should.have.been.calledTwice;
            hookSpySync2.should.have.been.calledWith(obj);

            var promise = model.runHooks('beforeCreate', obj, {});
            return promise.should.be.fulfilled.then(function() {

                hookSpyAsync1.should.have.been.calledOnce;
                hookSpyAsync1.should.have.been.calledWith(obj);
                hookSpyAsync2.should.have.been.calledOnce;
                hookSpyAsync2.should.have.been.calledWith(obj);

                var promise2 = model.runHooks(Hook.types.beforeCreate, obj, {});

                return promise2.should.be.fulfilled.then(function() {

                    hookSpyAsync1.should.have.been.calledTwice;
                    hookSpyAsync1.should.have.been.calledWith(obj);
                    hookSpyAsync2.should.have.been.calledTwice;
                    hookSpyAsync2.should.have.been.calledWith(obj);
                });
            });
        });

        it('should throw `HookError` if invalid `hookType` is supplied', function() {
            var model = this.buildModel({
                beforeValidate: [{ name: 'testHook', fn: function(){} }]
            });

            function test() {
                model.runHooks('beforeValid');
            }

            expect(test).to.throw(HookError);
        });
    });
});
