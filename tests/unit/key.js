var Promise        = require('bluebird');
var sinon          = require('sinon');
var chai           = require('chai');
var chaiAsPromised = require('chai-as-promised');
var sinonChai      = require("sinon-chai");
var Key            = require("../../lib/key/key.js");
var UUID4Key       = require("../../lib/key/uuid4Key.js");
var IncrementalKey = require("../../lib/key/incrementalKey.js");
var RefDocKey      = require("../../lib/key/refDocKey.js");
var DataType       = require("../../lib/dataType.js");
var KeyError       = require("../../lib/error/keyError.js");

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised');

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

var assert = sinon.assert;
var expect = chai.expect;

describe('Keys', function() {

    before(function beforeFn() {
        this.instanceMock = {
            getStorageAdapter: sinon.stub(),
            getData: sinon.stub(),
        };
    });

    beforeEach(function beforeEachFn() {
        this.instanceMock.getStorageAdapter.reset();
        this.instanceMock.getData.reset();
    });

    describe('Key', function() {
        it('should throw an Error when we try to directly create object of `Key` (eg.: `new Key(options)`)', function() {
            function test() {
                return new Key({
                    prefix: "Test",
                    postfix: "",
                    delimiter: "_"
                });
            }

            expect(test).to.throw(Error);
        });

        it('should throw an Error when we try to generate an id on an object which does not implement the `generate` method', function() {
            function CustomKey(options) {
                Key.call(this, options);
            }
            CustomKey.prototype = Object.create(Key.prototype);
            CustomKey.prototype.constructor = CustomKey;

            var key = new CustomKey({
                prefix: "Test",
                postfix: "",
                delimiter: "_"
            });

            return key.generate().should.be.rejectedWith(Error);
        });
    });

    describe('UUID4Key', function() {

        it('should expose static `dataType` property', function() {
            expect(UUID4Key.dataType).to.be.a('string');
            expect(DataType.exists(UUID4Key.dataType)).to.be.true;
        });

        describe('generate', function() {
            it('should return a Promise with fulfillment value being generated `key` instance', function() {
                var key = new UUID4Key({
                    prefix: "Test",
                    postfix: "",
                    delimiter: "_"
                });

                var promise = key.generate();

                promise.should.be.an.instanceof(Promise);
                return promise.should.be.fulfilled.then(function(generatedKey) {
                    generatedKey.should.be.equal(key);
                    generatedKey.should.be.an.instanceof(UUID4Key);

                    var regx = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
                        expect(generatedKey.getId().match(regx)).to.not.be.null;
                });
            });
        });

        describe('parse', function() {
            it('should throw when parsed `id` from `key` string is not valid uuidv4', function() {
                var key = new UUID4Key({
                    prefix: "Test",
                    postfix: "",
                    delimiter: "_"
                });

                function parse() {
                    key.parse("Test_some-non-uid-value");
                }
                return expect(parse).to.throw(KeyError);
            });
        });

        describe('inspect', function() {
            it('should return correctly formated string', function() {
                var key = new UUID4Key({
                    prefix: "Test",
                    postfix: "",
                    delimiter: "_"
                });

                return key.generate().then(function() {
                    key.inspect().should.be.equal(
                        '[object UUID4Key: "Test_' + key.getId()  + '" ]'
                    );
                });
            });
        });

        describe('toString', function() {
            it('should apped `postfix` part of the key if the `postfix` option is set', function() {
                var key = new UUID4Key({
                    prefix: "Test",
                    postfix: "postfix",
                    delimiter: "_",
                });

                key.toString().should.be.equal('Test_undefined_postfix');
            });

            it("should convert it's id value to lowecase when the `caseSensitive=false`", function() {
                var key = new UUID4Key({
                    prefix: "Test",
                    postfix: "postfix",
                    delimiter: "_",
                    caseSensitive: false
                });

                var id = '885AD3C0-47B9-4D3F-9EF0-8B025E324E47';
                key.setId(id);
                key.toString().should.be.equal('Test_' + id.toLowerCase() + '_postfix');
            });

            it('should NOT throw an Error when we call the method on ungenerated key object AND the `caseSensitive=false`', function() {
                var key = new UUID4Key({
                    prefix: "Test",
                    postfix: "postfix",
                    delimiter: "_",
                    caseSensitive: false
                });

                function test() {
                    return key.toString();
                }

                expect(test).to.not.throw(Error);
            });
        });
    });

    describe('IncrementalKey', function() {
        it('should expose static `dataType` property', function() {
            expect(IncrementalKey.dataType).to.be.a('string');
            expect(DataType.exists(IncrementalKey.dataType)).to.be.true;
        });

        describe('generate', function() {
            it('should return a Promise with fulfillment value being generated `key` instance', function() {
                var key = new IncrementalKey({
                    prefix: "Test",
                    postfix: "",
                    delimiter: "_"
                });

                //mock storageAdapter.counter()
                var storageAdapterCounterStub = sinon.stub();
                storageAdapterCounterStub.returns(Promise.resolve({value: 100}));

                this.instanceMock.getStorageAdapter.returns({
                    counter: storageAdapterCounterStub
                });

                var promise = key.generate(this.instanceMock);

                promise.should.be.an.instanceof(Promise);
                return promise.should.be.fulfilled.then(function(generatedKey) {
                    storageAdapterCounterStub.should.have.been.called;
                    generatedKey.should.be.equal(key);
                    generatedKey.should.be.an.instanceof(IncrementalKey);

                    expect(generatedKey.getId()).to.be.a('number');
                });
            });
        });

        describe('parse', function() {
            it('should throw when parsed `id` from `key` string is not valid integer', function() {
                var key = new IncrementalKey({
                    prefix: "Test",
                    postfix: "",
                    delimiter: "_"
                });

                function parse() {
                    key.parse("Test_100abc");
                }
                return expect(parse).to.throw(KeyError);
            });

            it('should not throw an Error', function() {
                var key = new IncrementalKey({
                    prefix: "Test",
                    postfix: "postfix",
                    delimiter: "_"
                });

                function parse() {
                    key.parse("Test_100_postfix");
                }
                return expect(parse).to.not.throw(KeyError);
            });
        });

        describe('inspect', function() {
            it('should return correctly formated string', function() {
                var key = new IncrementalKey({
                    prefix: "Test",
                    postfix: "",
                    delimiter: "_"
                });

                key.inspect().should.be.equal(
                    '[object IncrementalKey: "Test_' + key.getId()  + '" ]'
                );
            });
        });
    });

    describe('RefDocKey', function() {
        describe('setRef', function() {
            it("should throw a KeyError when we don't provide valid property references", function() {
                function case1() {
                    return new RefDocKey({
                        prefix: "Test",
                        postfix: "",
                        delimiter: "_",
                    });
                }

                function case2() {
                    return new RefDocKey({
                        prefix: "Test",
                        postfix: "",
                        delimiter: "_",
                        ref: []
                    });
                }

                expect(case1).to.throw(KeyError);
                expect(case2).to.throw(KeyError);
            });
        });

        describe('generate', function() {
            it('should convert generated id value to lowercase when `caseSensitive=false`', function() {
                var key = new RefDocKey({
                    prefix: "Test",
                    postfix: "",
                    delimiter: "_",
                    ref: ['username'],
                    caseSensitive: false
                });

                var instanceData = {
                    username: 'TEST'
                };

                var getDataStub = this.instanceMock.getData.returns(instanceData);

                return key.generate(this.instanceMock).then(function() {
                    key.getId().should.be.equal('test');
                });
            });

            it('should return a Promise with fulfillment value being generated `key` instance', function() {
                var ref = [
                        'user.email',
                        'color'
                ];
                var key = new RefDocKey({
                    prefix: "Test",
                    postfix: "",
                    delimiter: "_",
                    ref: ref
                });

                //mock instance.getData
                var instanceData = {
                    user: {
                        email: 'test@test.com'
                    },
                    color: 'red'
                };

                var getDataStub = this.instanceMock.getData.returns(instanceData);

                var promise = key.generate(this.instanceMock);

                promise.should.be.an.instanceof(Promise);
                return promise.should.be.fulfilled.then(function(generatedKey) {
                    getDataStub.should.have.been.called;
                    generatedKey.should.be.equal(key);
                    generatedKey.should.be.an.instanceof(RefDocKey);

                    var expectedId = instanceData.user.email + "_" + instanceData.color;
                    expect(generatedKey.getId()).to.be.equal(expectedId);
                });
            });

            it('should return rejected promise with `KeyError` if value of a data `property` which should make up document key is empty', function() {
                var ref = [
                        'user.email',
                        'color'
                ];
                var key = new RefDocKey({
                    prefix: "Test",
                    postfix: "",
                    delimiter: "_",
                    ref: ref
                });

                //mock instance.getData
                var instanceData = {
                    user: {
                        email: null//should cause `generate` to throw
                    },
                    color: 'red'
                };

                var getDataStub = this.instanceMock.getData.returns(instanceData);

                var promise = key.generate(this.instanceMock);

                promise.should.be.an.instanceof(Promise);
                return promise.should.be.rejectedWith(KeyError);
            });
        });

        describe('inspect', function() {
            it('should return correctly formated string', function() {
                var key = new RefDocKey({
                    prefix: "Test",
                    postfix: "",
                    delimiter: "_",
                    ref: ['username']
                });

                var instanceData = {
                    username: 'test'
                };

                var getDataStub = this.instanceMock.getData.returns(instanceData);

                return key.generate(this.instanceMock).then(function() {
                    key.inspect().should.be.equal(
                        '[object RefDocKey: "Test_username_' + key.getId()  + '" ]'
                    );
                });
            });
        });

        describe('toString', function() {
            it('should apped `postfix` part of the key if the `postfix` option is set', function() {
                var key = new RefDocKey({
                    prefix: "Test",
                    postfix: "postfix",
                    delimiter: "_",
                    ref: ['username']
                });

                key.toString().should.be.equal('Test_username_undefined_postfix');
            });
        });
    });
});

