var sinon     = require('sinon');
var chai      = require('chai');
var sinonChai = require("sinon-chai");
var couchbase = require('couchbase').Mock;

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
            this.numVal       = sanitizers[DataTypes.NUMBER];
            this.intVal       = sanitizers[DataTypes.INT];
            this.floatVal     = sanitizers[DataTypes.FLOAT];
            this.booleanVal   = sanitizers[DataTypes.BOOLEAN];
            this.stringVal    = sanitizers[DataTypes.STRING];
            this.arrayVal     = sanitizers[DataTypes.ARRAY];
            this.dateVal      = sanitizers[DataTypes.DATE];
            this.enumVal      = sanitizers[DataTypes.ENUM];
            this.hashTableVal = sanitizers[DataTypes.HASH_TABLE];
            this.complexVal   = sanitizers[ComplexDataType.toString()];
        });

        describe("Number & Float", function() {
            it("should throw an error if input is not float or integer or could not be parsed as float or integer", function() {
                var numVal = this.numVal;


                //"3a" => value would be parsed by `parseFloat` to float as "3", but it's INVALID number thus it should throw
                var values = ['3a', {}, [], new Date, new Object];

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

            it("should NOT pass validation when `null` input value is provided", function() {
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

            it("should NOT pass validation when `null` input value is provided", function() {
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

        describe('HASH TABLE', function() {
            it('should throw a ValidationError when a value is not a plain object', function() {
                var hashTableVal = this.hashTableVal;
                var opt = {
                    model: {
                        name: 'Model',
                        $getInternalProperties: sinon.stub()
                    }
                };

                expect(hashTableVal.bind(sanitizers, [], opt))
                    .to.throw(ValidationError);
            });
        });

        describe('Complex', function() {
            before(function() {
                this.model = this.odm.define('Test_Complex_sanitizer', {
                    type: DataTypes.HASH_TABLE,
                });

                this.schema = {
                    type: DataTypes.COMPLEX(this.model.name)
                };
            });

            it('should fail if input value is not instance of `Model.Instance`', function() {
                var complexVal = this.complexVal;

                expect(complexVal.bind(complexVal, new Object, {
                    propPath: 'testprop',
                    schema: this.schema,
                    model: this.model
                })).to.throw(ValidationError);

                expect(complexVal.bind(complexVal, new Date, {
                    propPath: 'testprop',
                    schema: this.schema,
                    model: this.model
                })).to.throw(ValidationError);
            });

            it('should pass the validation if input value is instance of `Model.Instance`', function() {
                var complexVal = this.complexVal;
                var instance = new this.model.Instance({}, {
                    isNewRecord:true,
                    key: this.model.buildKey()
                });

                expect(complexVal(instance, {
                    propPath: 'testprop',
                    schema: this.schema,
                    model: this.model
                })).to.be.an.instanceof(this.model.Instance);
            });

        });
    });

    describe("Data sanitizer", function() {
        describe("schema 1", function() {
            before(function() {

                this.model = this.odm.define('DataSanitizerModel', {
                    type: DataTypes.HASH_TABLE,
                    schema: {
                        username: {
                            type: DataTypes.STRING,
                            allowEmptyValue: true,
                        },
                        address: {
                            type: DataTypes.HASH_TABLE,
                            allowEmptyValue: true,
                            schema: {
                                street: {
                                    type: DataTypes.STRING
                                },
                                zip: {
                                    type: DataTypes.STRING
                                }
                            }
                        },
                        age: {
                            type: DataTypes.NUMBER
                        },
                        created_at: {
                            type: DataTypes.DATE
                        }
                    }
                }, {timestamps: true});

                // sanitizer schema definition
                this.schema = this.model.options.schema;
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

                var result = dataSanitizer.sanitize.call(this.model, this.schema, data);
                expect(result).to.deep.equal(data);
            });

            it("should fail the validation if `property` is empty (null/undefined) and `allowEmptyValue` options is NOT set", function() {

                var data = {
                    username: null,
                    address: undefined,
                    //age: null,//this should throw when validating
                    created_at: new Date()
                };

                expect(dataSanitizer.sanitize.bind(this.model, this.schema, data))
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

                var result = dataSanitizer.sanitize.call(this.model, this.schema, data);
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

                var result = dataSanitizer.sanitize.call(this.model, this.schema, data, {includeUnlisted: true});
                expect(result).to.have.property("country");
                expect(result).to.have.property("anotherproperty");
            });

            it('should respect `skipInternalProperties=true` option', function() {
                var data = {
                    username: 'test',
                    address: {
                        street: "St. Patrick",
                        zip: "1124"
                    },
                    age: 15,
                };

                var result = dataSanitizer.sanitize.call(
                        this.model,
                        this.schema,
                        data,
                        {
                            skipInternalProperties: true
                        }
                );
                expect(result).to.deep.equal(data);
            });

            it('should respect `skipInternalProperties=false` option', function() {
                var self = this;

                var data = {
                    username: 'test',
                    address: {
                        street: "St. Patrick",
                        zip: "1124"
                    },
                    age: 15,
                };

                function test() {
                    var result = dataSanitizer.sanitize.call(
                            self.model,
                            self.schema,
                            data,
                            {
                                skipInternalProperties: false
                            }
                    );
                }
                expect(test).to.throw(ValidationError);
            });
        });

        describe('empty data received', function() {

            it('should return `null` value when the sanitizer is passed `null` data value with a schema definition (with HASH_TABLE root data type) that allows it', function() {
                var model = this.odm.define('DataSanitizerModel2', {
                    type: DataTypes.HASH_TABLE,
                    allowEmptyValue: true
                });

                var result = dataSanitizer.sanitize.call(
                        model,
                        model.options.schema,
                        null
                );
                expect(result).to.be.equal(null);
            });

            it('should return `null` value when the sanitizer is passed `null` data value with a schema definition (with STRING root data type) that allows it', function() {
                var model = this.odm.define('DataSanitizerModel4', {
                    type: DataTypes.STRING,
                    allowEmptyValue: true
                });

                var result = dataSanitizer.sanitize.call(
                        model,
                        model.options.schema,
                        null
                );
                expect(result).to.be.equal(null);
            });

            it('should return `undefined` value when the sanitizer is passed `undefined` data value with a schema definition that allows it', function() {
                var model = this.odm.define('DataSanitizerModel3', {
                    type: DataTypes.HASH_TABLE,
                    allowEmptyValue: true
                });

                var result = dataSanitizer.sanitize.call(
                        model,
                        model.options.schema,
                        undefined
                );
                expect(result).to.be.equal(undefined);
            });
        });
    });

    describe('Schema Sanitizer', function() {

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

            sanitize.call(this.model, schema);

            intSpy.should.have.been.calledWith(
                    schema.schema.age.default,
                    {
                        propPath: 'age.default',
                        schema: schema.schema.age,
                        model: this.model,
                        skipInternalProperties: true
                    }
            );
            objSpy.should.have.been.calledWith(
                    schema.schema.dimensions.schema.metric.default,
                    {
                        propPath:'dimensions.metric.default',
                        schema: schema.schema.dimensions.schema.metric,
                        model: this.model,
                        skipInternalProperties: true
                    }
            );

            intSpy.restore();
            objSpy.restore();
        });

        it('should successfully pass validation of default schema property values considering that default value has been correctly unified', function() {
            var self = this;

            var schemaList = [
                {
                    type: DataTypes.HASH_TABLE,
                    default: {},
                    schema: {
                        prop: {
                            type: DataTypes.STRING,
                            default: 'test'
                        }
                    }
                },
                {
                    type: DataTypes.ARRAY,
                    default: [{}],//each collection value is going to get default array item properties
                    schema: {
                        type: DataTypes.HASH_TABLE,
                        schema: {
                            props: {
                                type: DataTypes.ARRAY,
                                default: ['test']
                            }
                        }
                    }
                },
                {
                    type: DataTypes.ARRAY,
                    default: [{}],
                    schema: {
                        type: DataTypes.HASH_TABLE
                    }
                }
            ];

            schemaList.forEach(function(schema, index) {
                var model = self.odm.define(
                        'DefaultSchemaPropSanitizationModel' + index,
                        schema
                );
                function test() {
                    schemaSanitizer.sanitize.call(model, schema);
                }

                expect(test).to.not.throw(Error, 'Dataset: ' + index);
            });
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

        it('should set `$hasInternalPropsOnly` hiddien property on a schema object if the schema does not define any additional properties', function() {
            var sanitize = schemaSanitizer.sanitize;
            var schema = {
                type: DataTypes.HASH_TABLE,
                schema: {}
            };

            sanitize(schema);

            schema.should.have.property('$hasInternalPropsOnly', true);
        });
    });
});
