var sinon     = require('sinon');
var chai      = require('chai');
var sinonChai = require("sinon-chai");
var couchbase = require('couchbase').Mock;

var Report           = require('../../lib/sanitizer/report.js');
var dataSanitizer    = require('../../lib/sanitizer/data.js');
var schemaSanitizer  = require('../../lib/sanitizer/schema.js');
var DataTypes        = require('../../lib/dataType.js').types;
var ComplexDataType  = require('../../lib/dataType.js').Complex;
var ValidationError  = require("../../lib/error/validationError.js");
var ODM              = require('../../index.js');


chai.use(sinonChai);
chai.should();

var DataTypes  = ODM.DataTypes;
var sanitizers = dataSanitizer.sanitizers;
var assert     = sinon.assert;
var expect     = chai.expect;

describe("Sanitizer", function() {
    before(function() {
        // Build testing Model
        var cluster = new couchbase.Cluster();
        var bucket = cluster.openBucket('test');

        var odm = new ODM({bucket: bucket});

        this.model = odm.define('Test', {
            type: DataTypes.HASH_TABLE,
            default: {}, // should support setting default root empty value
             schema: {
                 prop: {
                     type: DataTypes.STRING,
                     default: 'test'
                 }
             }
        }, {timestamps: true});

        this.odm = odm;
    });

    describe("Validation", function() {
        before(function() {
            this.numVal     = sanitizers[DataTypes.NUMBER];
            this.intVal     = sanitizers[DataTypes.INT];
            this.floatVal     = sanitizers[DataTypes.FLOAT];
            this.booleanVal = sanitizers[DataTypes.BOOLEAN];
            this.stringVal  = sanitizers[DataTypes.STRING];
            this.arrayVal   = sanitizers[DataTypes.ARRAY];
            this.dateVal    = sanitizers[DataTypes.DATE];
            this.enumVal    = sanitizers[DataTypes.ENUM];
            this.complexVal = sanitizers[ComplexDataType.toString()];
        });

        describe("Number & Float", function() {
            it("should throw an error if input is not float or integer or could not be parsed as float or integer", function() {
                var numVal = this.numVal;


                //"3a" => value would be parsed by `parseFloat` to float as "3", but it's INVALID number thus it should throw
                var values = [{}, [], new Date, new Object];

                values.forEach(function(val) {
                    expect(numVal.bind(numVal, val, {
                        propPath: 'testprop'
                    })).to.throw(ValidationError);
                });
            });

            it("should pass validation and return float or integer", function() {
                var numVal = this.numVal;

                var validInt = 4;
                var validFloat = 0.5;

                expect(numVal(validInt, {propPath: 'testprop'}))
                    .to.be.equal(validInt);

                expect(numVal(validFloat, {propPath:'testprop'}))
                    .to.be.equal(validFloat);
            });

            it("should pass validation and parse string and return float or integer", function() {
                var numVal = this.numVal;

                var validStringInt = "65";
                var validStringFloat = "34.2";

                expect(numVal(validStringInt, {propPath: 'testprop'}))
                    .to.be.equal(parseInt(validStringInt));

                expect(numVal(validStringFloat, {propPath: 'testprop'}))
                    .to.be.equal(parseFloat(validStringFloat));
            });
        });

        describe("Integer", function() {
            it("should throw an error if input is not integer or could not be parsed as integer", function() {
                var intVal = this.intVal;

                var values = ['3a', '1.0', 1.2, '2.9'];

                values.forEach(function(val) {
                    expect(intVal.bind(intVal, val, {propPath: 'testprop'}))
                        .to.throw(ValidationError);
                });
            });

            it("should pass the validation and return (parsed) integer", function() {
                var intVal = this.intVal;

                var values   = [4.0, 10, '5', 1.0];
                var expected = [4, 10, 5, 1];

                values.forEach(function(val, index) {
                    expect(intVal(val, {propPath: 'testprop'}))
                        .to.be.equal(expected[index]);
                });
            });
        });

        describe("String", function() {

            it('should throw an error if input is not instance of String or is not of type `string`', function() {
                var stringVal = this.stringVal;

                expect(stringVal.bind(stringVal, new Object, {propPath: 'testprop'}))
                    .to.throw(ValidationError);

                expect(stringVal.bind(stringVal, 3, {propPath: 'testprop'}))
                    .to.throw(ValidationError);

                expect(stringVal(new String("test"), {propPath: 'testprop'}))
                    .to.be.equal("test");
            });

            it("should NOT pass validation when `isNullable` options is set to `false` and `null` input value is provided", function() {
                var stringVal = this.stringVal;

                expect(stringVal.bind(stringVal, null, {propPath: 'testprop'}))
                    .to.throw(ValidationError);
            });
        });

        describe("Boolean", function() {
            it('should throw an error if input can not be parsed as boolean or is not boolean-integer value (0,1)', function() {
                var booleanVal = this.booleanVal;

                expect(booleanVal.bind(booleanVal, "true", {propPath: 'testprop'}))
                    .to.throw(ValidationError);

                expect(booleanVal.bind(booleanVal, {}, {propPath: 'testprop'}))
                    .to.throw(ValidationError);

                expect(booleanVal.bind(booleanVal, [], {propPath: 'testprop'}))
                    .to.throw(ValidationError);

                expect(booleanVal.bind(booleanVal, new Object, {propPath: 'testprop'}))
                    .to.throw(ValidationError);

                expect(booleanVal.bind(booleanVal, 2, {propPath: 'testprop'}))
                    .to.throw(ValidationError);
            });

            it('should pass the validation when input is boolean or integer of value `1` or `0`', function() {

                var booleanVal = this.booleanVal;

                expect(booleanVal(1, {propPath: 'testprop'}))
                    .to.be.equal(true);

                expect(booleanVal(0, {propPath: 'testprop'}))
                    .to.be.equal(false);
            });
        });

        describe("Date", function() {

            it('should throw an error if input is not valid date or date/date-time string or is not valid instance of Date', function() {
                var dateVal = this.dateVal;

                expect(dateVal.bind(dateVal, "", {propPath: 'testprop'}))
                    .to.throw(ValidationError);

                expect(dateVal.bind(dateVal, undefined, {propPath: 'testprop'}))
                    .to.throw(ValidationError);

                expect(dateVal.bind(dateVal, null, {propPath: 'testprop'}))
                    .to.throw(ValidationError);

                expect(dateVal.bind(dateVal, 'invalid date value', {propPath: 'testprop'}))
                    .to.throw(ValidationError);

                expect(dateVal(new String("Thu Mar 24 2016 13:40:30 GMT+0100"), {propPath: 'testprop'}))
                    .to.be.a('string');
            });

            it("should NOT pass validation when `isNullable` options is set to `false` and `null` input value is provided", function() {
                var dateVal = this.dateVal;

                expect(dateVal.bind(dateVal, null, {propPath: 'testprop'}))
                    .to.throw(ValidationError);
            });
        });

        describe('Enum', function() {
            it('should fail if input value is not present in enumerated allowed values', function() {
                var enumVal = this.enumVal;
                var schema = {
                    enum: [1]
                };

                expect(enumVal.bind(enumVal, 4, {
                    propPath: 'testprop',
                    schema: schema
                })).to.throw(ValidationError);

                expect(enumVal.bind(enumVal, null, {
                    propPath: 'testprop',
                    schema: schema
                })).to.throw(ValidationError);
            });

            it('should pass the validation if input value is present in enumerated collection', function() {
                var enumVal = this.enumVal;
                var schema = {
                    enum: [1,null,undefined, 'false']
                };

                expect(enumVal(1, {
                    propPath: 'testprop',
                    schema: schema
                })).to.be.equal(1);

                expect(enumVal(null, {
                    propPath: 'testprop',
                    schema: schema
                })).to.be.equal(null);

                expect(enumVal(undefined, {
                    propPath: 'testprop',
                    schema: schema
                })).to.be.equal(undefined);

                expect(enumVal('false', {
                    propPath: 'testprop',
                    schema: schema
                })).to.be.equal('false');
            });

        });

        describe("Array", function() {

            before(function(){
                this.booleanValSpy = sinon
                    .spy(sanitizers, DataTypes.BOOLEAN);
            });

            after(function(){
                delete this.booleanValSpy;
            });

            it('should call defined validator for every item of array', function() {
                var arrayVal = this.arrayVal;
                var propName = 'testprop';
                var schema = {
                    schema: {
                        type: DataTypes.BOOLEAN
                    }
                };
                var data = [1,0,false];

                arrayVal.apply(sanitizers, [data.slice(0), {
                    propPath: propName,
                    schema: schema
                }]);

                var optMatcher = sinon.match(function(val) {
                    return val && val.propPath === propName && val.schema === schema.schema;
                });

                this.booleanValSpy.should.have.been.calledWith( data[0], optMatcher);

                this.booleanValSpy.should.have.been.calledWith(data[1], optMatcher);

                this.booleanValSpy.should.have.been.calledWith(data[2], optMatcher);
            });

            it("should NOT pass validation when value is not an array and `property` being validated is not nullable and `default` option value is not defined", function() {
                var arrayVal = this.arrayVal;
                var options = {
                    propPath: 'testprop',
                    schema: {
                        isNullable: false,
                        schema: {
                            type: DataTypes.BOOLEAN
                        }
                    }
                };

                expect(arrayVal.bind(sanitizers, null, options))
                    .to.throw(ValidationError);

                expect(arrayVal.bind(sanitizers, undefined, options))
                    .to.throw(ValidationError);

                expect(arrayVal.bind(sanitizers, {}, options))
                    .to.throw(ValidationError);

                expect(arrayVal.bind(sanitizers, "", options))
                    .to.throw(ValidationError);
            });
        });

        describe('Complex', function() {
            before(function() {
                function InstanceMock() {}

                function ModelMock() {
                    this.Instance = function() {
                        InstanceMock.call(this);
                    }
                    this.Instance.prototype = new InstanceMock();
                    this.Instance.prototype.constructor = this.Instance.constructor;
                }
                ModelMock.prototype.name = 'UserTestModel';

                var model = new ModelMock;

                function ModelManagerMock() {
                    this.get = function() {
                        return model;
                    }
                }

                this.InstanceMock     = InstanceMock;
                this.ModelManagerMock = ModelManagerMock;
                this.Model            = model;
            });

            it('should fail if input value is not instance of `Model.Instance`', function() {
                var complexVal = this.complexVal;
                var schema = {
                    type: DataTypes.COMPLEX(this.Model.name)
                };
                var modelManager = new this.ModelManagerMock;

                expect(complexVal.bind(complexVal, new Object, {
                    propPath: 'testprop',
                    schema: schema,
                    modelManager: modelManager
                })).to.throw(ValidationError);

                expect(complexVal.bind(complexVal, new Date, {
                    propPath: 'testprop',
                    schema: schema,
                    modelManager: modelManager
                })).to.throw(ValidationError);
            });

            it('should pass the validation if input value is instance of `Model.Instance`', function() {
                var complexVal = this.complexVal;
                var schema = {
                    type: DataTypes.COMPLEX(this.Model.name)
                };
                var modelManager = new this.ModelManagerMock;

                expect(complexVal(new this.Model.Instance, {
                    propPath: 'testprop',
                    schema: schema,
                    modelManager: modelManager
                })).to.be.an.instanceof(this.InstanceMock);
            });

        });
    });

    describe("Data sanitizer", function() {
        before(function() {

            var validatorFn = function(val, options){
                return val;
            }

            this.string = sinon.stub(sanitizers, DataTypes.STRING, validatorFn);
            this.number = sinon.stub(sanitizers, DataTypes.NUMBER, validatorFn);
            this.date   = sinon.stub(sanitizers, DataTypes.DATE, validatorFn);

            // explicitly bind context object of the sanitizerData method
            dataSanitizer.sanitize = dataSanitizer.sanitize.bind({
                $modelManager: this.odm.modelManager
            });

            // sanitizer schema definition
            this.schema = {
                type: DataTypes.HASH_TABLE,
                schema: {
                    username: {
                        type: DataTypes.STRING,
                        allowEmptyValue: true,
                        default: "default_username"
                    },
                    address: {
                        type: DataTypes.HASH_TABLE,
                        allowEmptyValue: true,
                        default: {
                            street: "some name",
                            zip: "123Z"
                        },
                        schema: {
                            street: {
                                type: DataTypes.STRING
                            },
                            zip: {
                                type: DataTypes.STRING
                            }
                        }
                    },
                    association: {
                        type: DataTypes.COMPLEX('Test'),
                        default: this.model.build()
                    },
                    age: {
                        type: DataTypes.NUMBER
                    },
                    created_at: {
                        type: DataTypes.DATE
                    }
                }
            };
        });

        after(function() {
            this.string.restore();
            this.number.restore();
            this.date.restore();
        });

        it("should return sanitized data object", function() {

            var data = {
                username: 'test',
                address: {
                    street: "St. Patrick",
                    zip: "1124"
                },
                age: 15,
                created_at: new Date()
            };

            var result = dataSanitizer.sanitize(this.schema, data);
            expect(result).to.deep.equal(data);
        });

        it("should assign defined `default` value to a data if the data are empty (null/undefined)", function() {

            var data = {
                username: null,
                address: undefined,
                age: 15,
                created_at: new Date()
            };

            var result = dataSanitizer.sanitize(this.schema, data);
            expect(result).to.have.property('username', this.schema.schema.username.default);
            expect(result.address).to.be.eql(this.schema.schema.address.default);

            // the default value must be cloned
            // before assigned to validated data object
            expect(result.address).to.not.be.equal(this.schema.schema.address.default);

            // Make sure that default association Instance object
            // are cloned before they are assigned
            expect(result.association).to.be.an.instanceof(this.model.Instance);
            expect(result.association).to.not.be.equal(this.schema.schema.association.default);
        });

        it("should fail the validation if `property` is empty (null/undefined) and `allowEmptyValue` options is NOT set", function() {

            var data = {
                username: null,
                address: undefined,
                //age: null,//this should throw when validating
                created_at: new Date()
            };

            expect(dataSanitizer.sanitize.bind(dataSanitizer.sanitize, this.schema, data))
                .to.throw(ValidationError);
        });

        it("should NOT include data which are not in schema definition if `includeUnlisted` options is NOT set", function() {
            var data = {
                username: 'test',
                address: {
                    street: "St. Patrick",
                    zip: "1124"
                },
                age: 15,
                created_at: new Date(),
                anotherproperty: "thisshouldnotbeincluded",
                country: {
                    name: "United Kingdom",
                    code: "UK"
                }
            };

            var result = dataSanitizer.sanitize(this.schema, data);
            expect(result).to.not.have.property("country");
            expect(result).to.not.have.property("anotherproperty");
        });

        it("should include data received from bucket which are not in schema definition if `includeUnlisted` options IS set", function() {
            var data = {
                username: 'test',
                address: {
                    street: "St. Patrick",
                    zip: "1124"
                },
                age: 15,
                created_at: new Date(),
                anotherproperty: "thisshouldnotbeincluded",
                country: {
                    name: "United Kingdom",
                    code: "UK"
                }
            };

            var result = dataSanitizer.sanitize(this.schema, data, {includeUnlisted: true});
            expect(result).to.have.property("country");
            expect(result).to.have.property("anotherproperty");
        });
    });

    describe('Schema Sanitizer', function() {
        it('should return instance of `Report` with gathered information about Model`s relations/associations', function() {
            var schema = {
                type: DataTypes.HASH_TABLE,
                schema: {
                    user: {
                        type: DataTypes.COMPLEX('User'),
                    },
                    connections: {
                        type: DataTypes.HASH_TABLE,
                        schema: {
                            friends: {
                                type: DataTypes.ARRAY,
                                schema: {
                                    type: DataTypes.COMPLEX('User')
                                }
                            }
                        }
                    }
                }
            };

            var report = schemaSanitizer.sanitize(schema);

            report.should.be.an.instanceof(Report);
            report.getRelations().should.have.lengthOf(2, "Unexpected number of `associations` gathered from `schema` definition");
            report.getRelations().should.have.deep.property('[0].path', 'user');
            report.getRelations().should.have.deep.property('[1].path', 'connections.friends');
        });

        //it('should return instance of `Report` with gathered default schema property values', function() {
            //var schema = {
                //type: DataTypes.HASH_TABLE,
                //schema: {
                    //name: {
                        //type: DataTypes.STRING,
                        //default: 'John'
                    //},
                    //connections: {
                        //type: DataTypes.HASH_TABLE,
                        //schema: {
                            //test: {
                                //type: DataTypes.COMPLEX('Test'),
                                //default: this.model.build({})
                            //}
                        //}
                    //}
                //}
            //};

            //var report = schemaSanitizer.sanitize(schema);

            //report.should.be.an.instanceof(Report);

            //report.getSchemaDefaults().should.be.eql({
                //name: schema.schema.name.default,
                //connections: {
                    //test: schema.schema.connections.schema.test.default
                //}
            //});
        //});

        //it('should return instance of `Report` with gathered default schema property values (case 2)', function() {
            //var schema = {
                //type: DataTypes.ARRAY,
                //default: ['some', 'values']
            //};

            //var report = schemaSanitizer.sanitize(schema);

            //report.should.be.an.instanceof(Report);

            //report.getSchemaDefaults().should.be.equal(schema.default);
        //});

        //it('should return instance of `Report` with gathered default schema property values (case 3)', function() {
            //var schema = {
                //type: DataTypes.STRING,
                //default: 'test'
            //};

            //var report = schemaSanitizer.sanitize(schema);

            //report.should.be.an.instanceof(Report);

            //report.getSchemaDefaults().should.be.equal(schema.default);
        //});

        it('should allow to define default value for `DataType.COMPLEX()` data type', function() {
            var schema = {
                type: DataTypes.HASH_TABLE,
                schema: {
                    test: {
                        type: DataTypes.COMPLEX('Test'),
                        default: this.model.build({})
                    }
                }
            };

            var complexValSpy = sinon.spy(sanitizers, ComplexDataType.toString());

            var report = schemaSanitizer.sanitize(schema, this.odm.modelManager);

            report.should.be.an.instanceof(Report);
            report.getRelations().should.have.lengthOf(1, "Unexpected number of `associations` gathered from `schema` definition");
            report.getRelations().should.have.deep.property('[0].path', 'test');
            complexValSpy.should.have.been.calledOnce;
            complexValSpy.should.have.been.calledWith(
                    schema.schema.test.default,
                    {
                        propPath: 'test.default',
                        schema: schema.schema.test,
                        modelManager: this.odm.modelManager
                    }
            );
            complexValSpy.restore();
        });

        it('should allow to define `DataType.COMPLEX()` as root data type', function() {
            var schema = {
                type: DataTypes.COMPLEX('User'),
            };

            var report = schemaSanitizer.sanitize(schema);

            report.should.be.an.instanceof(Report);
            report.getRelations().should.have.lengthOf(1, "Unexpected number of `associations` gathered from `schema` definition");
            report.getRelations().should.have.deep.property('[0].path', null);
        });

        it('should fail if schema definition is not defined (or is not hash table)', function() {
            var sanitize = schemaSanitizer.sanitize;
            expect(sanitize.bind(sanitize, null)).to.throw(ValidationError);
            expect(sanitize.bind(sanitize, new Date)).to.throw(ValidationError);
            expect(sanitize.bind(sanitize, undefined)).to.throw(ValidationError);
            expect(sanitize.bind(sanitize, '')).to.throw(ValidationError);
        });

        it('should fail if schema contains property of type `DataTypes.ENUM` and has not defined enumerated collection `schema.enum`', function() {
            var sanitize = schemaSanitizer.sanitize;

            var schema = {
                type: DataTypes.ENUM
            };

            expect(sanitize.bind(sanitize, schema)).to.throw(ValidationError);
        });

        it('should call correct sanitizer function for every `default` value option of property definition in schema', function() {
            var sanitize = schemaSanitizer.sanitize;

            var intSpy = sinon.spy(sanitizers, DataTypes.INT);
            var objSpy = sinon.spy(sanitizers, DataTypes.HASH_TABLE);

            var schema = {
                type: DataTypes.HASH_TABLE,
                schema: {
                    age: {
                        type: DataTypes.INT,
                        default: 1
                    },
                    dimensions: {
                        type: DataTypes.HASH_TABLE,
                        schema: {
                            metric: {
                                type: DataTypes.HASH_TABLE,
                                default: {}
                            }
                        }
                    }
                }
            };

            sanitize(schema);

            intSpy.should.have.been.calledWith(
                    schema.schema.age.default,
                    {
                        propPath: 'age.default',
                        schema: schema.schema.age,
                        modelManager: undefined
                    }
            );
            objSpy.should.have.been.calledWith(
                    schema.schema.dimensions.schema.metric.default,
                    {
                        propPath:'dimensions.metric.default',
                        schema: schema.schema.dimensions.schema.metric,
                        modelManager: undefined
                    }
            );

            intSpy.restore();
            objSpy.restore();
        });

        it('should fail when `DataTypes.COMPLEX` function value is set as property `type` instead of `DataTypes.COMPLEX("name")` object', function() {

            var sanitize = schemaSanitizer.sanitize;
            var schema = {
                type: DataTypes.COMPLEX
            };

            expect(sanitize.bind(sanitize, schema)).to.throw(ValidationError);
        });

        it('should fail when nested `schema` definition is defined as anything else than Object (Hash table) ', function() {

            var sanitize = schemaSanitizer.sanitize;
            var schema = {
                type: DataTypes.HASH_TABLE,
                schema: null
            };

            expect(sanitize.bind(sanitize, schema)).to.throw(ValidationError);
        });

        it('should fail when invalid item `type` of `ARRAY` type is set', function() {

            var sanitize = schemaSanitizer.sanitize;
            var schema = {
                type: DataTypes.ARRAY,
                schema: {
                    type: 'bla'
                }
            };

            expect(sanitize.bind(sanitize, schema)).to.throw(ValidationError);
        });
    });
});
