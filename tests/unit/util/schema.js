var sinon     = require('sinon');
var chai      = require('chai');
var sinonChai = require("sinon-chai");
var couchbase = require('couchbase').Mock;

var schemaUtils      = require('../../../lib/util/schema.js');
var DataTypes        = require('../../../lib/dataType.js').types;
var ODM              = require('../../../index.js');


chai.use(sinonChai);
chai.should();

var DataTypes  = ODM.DataTypes;
var assert     = sinon.assert;
var expect     = chai.expect;

describe('schema utils', function() {
    describe('extractAssociations', function() {

        it('should fail if schema definition is not defined (or is not hash table)', function() {
            var fn = schemaUtils.extractAssociations;
            expect(fn.bind(fn, null)).to.throw(Error);
            expect(fn.bind(fn, new Date)).to.throw(Error);
            expect(fn.bind(fn, undefined)).to.throw(Error);
            expect(fn.bind(fn, '')).to.throw(Error);
        });

        describe("Model's relations/associations", function() {
            it("should return an object with gathered collection of Model's relations/associations", function() {
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

                var data = schemaUtils.extractAssociations(schema);

                data.should.be.instanceof(Array);
                data.should.have.lengthOf(2, "Unexpected number of `associations` gathered from `schema` definition");
                data.should.have.deep.property('[0].path', 'user');
                data.should.have.deep.property('[1].path', 'connections.friends');
            });

            it('should allow to define `DataType.COMPLEX()` as root data type', function() {
                var schema = {
                    type: DataTypes.COMPLEX('User'),
                };

                var data = schemaUtils.extractAssociations(schema);

                data.should.have.lengthOf(1, "Unexpected number of `associations` gathered from `schema` definition");
                data.should.have.deep.property('[0].path', null);
            });
        });
    });

    describe('extractDefaults', function() {

        it('should fail if schema definition is not defined (or is not hash table)', function() {
            var fn = schemaUtils.extractDefaults;
            expect(fn.bind(fn, null)).to.throw(Error);
            expect(fn.bind(fn, new Date)).to.throw(Error);
            expect(fn.bind(fn, undefined)).to.throw(Error);
            expect(fn.bind(fn, '')).to.throw(Error);
        });

        it('should return an object with default schema property values', function() {
            var cluster = new couchbase.Cluster();
            var bucket = cluster.openBucket('test');
            var odm = new ODM({bucket: bucket});
            var model = odm.define('Test', {
                type: DataTypes.HASH_TABLE
            });

            var schema = {
                type: DataTypes.HASH_TABLE,
                schema: {
                    name: {
                        type: DataTypes.STRING,
                        default: 'John'
                    },
                    connections: {
                        type: DataTypes.HASH_TABLE,
                        schema: {
                            test: {
                                type: DataTypes.COMPLEX('Test'),
                                default: model.build({})
                            }
                        }
                    }
                }
            };

            var data = schemaUtils.extractDefaults(schema);

            data.should.be.eql({
                name: schema.schema.name.default,
                connections: {
                    test: schema.schema.connections.schema.test.default
                }
            });
        });

        it('should return an object with gathered map of default schema property values (case 2)', function() {
            var schema = {
                type: DataTypes.ARRAY,
                default: ['some', 'values']
            };

            var data = schemaUtils.extractDefaults(schema);
            data.should.be.equal(schema.default);
        });

        it('should return an object with gathered map of default schema property values (case 3)', function() {
            var schema = {
                type: DataTypes.STRING,
                default: 'test'
            };

            var data = schemaUtils.extractDefaults(schema);
            data.should.be.equal(schema.default);
        });

        //it('should return an object with gathered default array item value', function() {
            //var schema = {
                //type: DataTypes.ARRAY,
                //schema: {
                    //type: DataTypes.HASH_TABLE,
                    //schema: {
                        //prop: {
                            //type: DataTypes.STRING,
                            //default: 'test'
                        //},
                        //items: {
                            //type: DataTypes.ARRAY,
                            //schema: {
                                //type: DataTypes.HASH_TABLE,
                                //schema: {
                                    //prop: {
                                        //type: DataTypes.STRING,
                                        //default: 'test'
                                    //}
                                //}
                            //}
                        //}
                    //}
                //}
            //};

            //var data = schemaUtils.extractDefaults(schema);
            //data.should.be.eql({
                //prop: 'test',
                //items: {
                    //prop: 'test'
                //}
            //});
        //});
    });
});
