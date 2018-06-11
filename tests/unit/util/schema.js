const sinon     = require('sinon');
const chai      = require('chai');
const sinonChai = require("sinon-chai");
const couchbase = require('couchbase').Mock;

const schemaUtils = require('../../../lib/util/schema.js');
const ODM         = require('../../../index.js');


chai.use(sinonChai);
chai.should();

const assert = sinon.assert;
const expect = chai.expect;

describe('schema utils', function() {
    describe('extractAssociations', function() {

        it('should fail if schema definition is not defined (or is not hash table)', function() {
            const fn = schemaUtils.extractAssociations;
            expect(fn.bind(fn, null)).to.throw(Error);
            expect(fn.bind(fn, new Date)).to.throw(Error);
            expect(fn.bind(fn, undefined)).to.throw(Error);
            expect(fn.bind(fn, '')).to.throw(Error);
        });

        describe("Model's relations/associations", function() {
            it("should return an object with gathered collection of Model's relations/associations", function() {
                const schema = {
                    type: 'object',
                    properties: {
                        user: {
                            type: 'object',
                            $relation: {
                                type: 'User',
                                method: 'reference'
                            }
                        },
                        connections: {
                            type: 'object',
                            properties: {
                                friends: {
                                    type: 'array',
                                    items: {
                                        $relation: { type: 'User' }
                                    }
                                }
                            }
                        }
                    }
                };

                const data = schemaUtils.extractAssociations(schema);

                data.should.be.instanceof(Array);
                data.should.have.lengthOf(2, "Unexpected number of `associations` gathered from `schema` definition");
                data.should.have.deep.property('[0].path').that.is.eql(['user']);
                data.should.have.deep.property('[0].type', 'User');
                data.should.have.deep.property('[1].path').that.is.eql(['connections', 'friends']);
                data.should.have.deep.property('[1].type', 'User');
            });

            it('should properly handle associations defined as specific array elements', function() {
                const schema = {
                    type: 'object',
                    properties: {
                        connections: {
                            type: 'array',
                            items: [
                                {$relation: {type: 'User'}},
                                {$relation: {type: 'Country', method: 'reference'}},
                            ]
                        }
                    }
                };

                const data = schemaUtils.extractAssociations(schema);

                data.should.be.instanceof(Array);
                data.should.have.lengthOf(2, "Unexpected number of `associations` gathered from `schema` definition");
                data.should.have.deep.property('[0].path').that.is.eql(['connections', 0]);
                data.should.have.deep.property('[0].type', 'User');
                data.should.have.deep.property('[1].path').that.is.eql(['connections', 1]);
                data.should.have.deep.property('[1].type', 'Country');
                data.should.have.deep.property('[1].method', 'reference');
            });

            it('should allow to define `$relation` as root data type', function() {
                const schema = {
                    $relation: {
                        type: 'User'
                    },
                };

                const data = schemaUtils.extractAssociations(schema);

                data.should.have.lengthOf(1, "Unexpected number of `associations` gathered from `schema` definition");
                data.should.have.deep.property('[0].path').that.is.eql([]);
                data.should.have.deep.property('[0].type', 'User');
                data.should.have.deep.property('[0].method', undefined);
            });
        });
    });

    describe('extractDefaults', function() {

        it('should fail if schema definition is not defined (or is not hash table)', function() {
            const fn = schemaUtils.extractDefaults;
            expect(fn.bind(fn, null)).to.throw(Error);
            expect(fn.bind(fn, new Date)).to.throw(Error);
            expect(fn.bind(fn, undefined)).to.throw(Error);
            expect(fn.bind(fn, '')).to.throw(Error);
        });

        it('should return an object with default object property values', function() {
            const cluster = new couchbase.Cluster();
            const bucket = cluster.openBucket('test');
            const odm = new ODM({bucket: bucket});
            const model = odm.define('Test', {
                type: 'object'
            });

            const schema = {
                type: 'object',
                properties: {
                    name: {
                        type: 'string',
                        default: 'John'
                    },
                    connections: {
                        type: 'object',
                        properties: {
                            test: {
                                type: 'object',
                                relation: { type: 'Test' },
                                default: model.build({})
                            }
                        }
                    }
                }
            };

            const data = schemaUtils.extractDefaults(schema);

            data.should.be.eql({
                name: schema.properties.name.default,
                connections: {
                    test: schema.properties.connections.properties.test.default
                }
            });
        });

        it('should correctly resolve default schema values (0)', function() {
            const schema = {
                type: 'object',
                properties: {
                    apps: {
                        type: 'object',
                        default: {},
                        properties: {
                            prop: {type: 'integer', default: 10},
                        }
                    }
                }
            };

            const defaults = schemaUtils.extractDefaults(schema);

            const expectedDefaults = {
                apps: {
                    prop: 10
                }
            };

            expect(defaults).to.be.eql(expectedDefaults);
            expect(defaults.apps).to.not.have.property('_requiresMergeTarget');
        });

        it('should correctly resolve default schema values (1)', function() {
            const schema = {
                type: 'object',
                properties: {
                    apps: {
                        type: 'array',
                        default: [{}],
                        items: {
                            type: 'object',
                            properties: {
                                prop: {type: 'string', default: 'value'}
                            }
                        }
                    }
                }
            };

            const defaults = schemaUtils.extractDefaults(schema);

            const expectedDefaults = {
                apps: [{}]
            };
            expectedDefaults.apps.itemDefaults = {prop: 'value'};

            expect(defaults).to.be.eql(expectedDefaults);
            expect(defaults.apps.itemDefaults)
                .to.be.eql(expectedDefaults.apps.itemDefaults);
            expect(defaults.apps).to.not.have.property('_requiresMergeTarget');
        });

        it('should correctly resolve default schema values (2)', function() {
            const schema = {
                type: 'object',
                properties: {
                    apps: {
                        type: 'array',
                        default: [{}],
                        items: [
                            {
                                type: 'object',
                                properties: {
                                    prop: {type: 'integer', default: 1}
                                }
                            },
                            {
                                type: 'object',
                                properties: {
                                    prop2: {type: 'integer', default: 2}
                                }
                            }
                        ]
                    }
                }
            };

            const defaults = schemaUtils.extractDefaults(schema);

            const expectedDefaults = {
                apps: [{prop: 1}, {prop2: 2}]
            };

            expect(defaults).to.be.eql(expectedDefaults);
            expect(defaults.apps[0]).to.have.property('_requiresMergeTarget', true);
            expect(defaults.apps[1]).to.have.property('_requiresMergeTarget', true);
        });

        it('should correctly resolve default schema values (3)', function() {
            const schema = {
                type: 'object',
                properties: {
                    apps: {
                        type: 'array',
                        default: ['test1'],
                        items: [
                            {
                                type: 'string',
                                default: 'test2'
                            },
                            {
                                type: 'string',
                                default: 'test3'
                            }
                        ]
                    }
                }
            };

            const defaults = schemaUtils.extractDefaults(schema);

            const expectedDefaults = {
                //TODO
                apps: ['', 'test3']
            };

            expect(defaults).to.be.eql(expectedDefaults);
        });

        it('should extract default array item values when items schema is an array', function() {
            const schema = {
                type: 'array',
                items: [
                    {type: 'string', default: 'test'},
                    {type: 'integer', default: 1},
                    {type: 'object', default: {test: 'test'}},
                    {
                        type: 'object',
                        properties: {
                            prop: {
                                type: 'string',
                                default: 'value'
                            }
                        }
                    },
                    {
                        type: 'object',
                        default: {prop2: 'initial'},
                        properties: {
                            prop2: {
                                type: 'string',
                                default: 'value'
                            }
                        }
                    }
                ]
            };

            const defaults = schemaUtils.extractDefaults(schema);

            defaults.should.be.eql([
                'test',
                1,
                {test: 'test'},
                {prop: 'value'},
                {prop2: 'initial'}
            ]);

            defaults[2].should.not.have.property('_requiresMergeTarget');
            defaults[3].should.have.property('_requiresMergeTarget', true);
            defaults[4].should.not.have.property('_requiresMergeTarget');

        });

        it('should extract default object values for each of items of an array', function() {
            const schema = {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        name: {
                            type: 'string',
                            default: 'value'
                        }
                    }
                }
            };

            const defaults = schemaUtils.extractDefaults(schema);

            const expectedDefaults = [];
            expectedDefaults.itemDefaults = {
                name: 'value'
            };

            expect(defaults).to.be.eql(expectedDefaults);
            expect(defaults).to.have.property('itemDefaults')
                .that.is.eql(expectedDefaults.itemDefaults);

        });

        it('should NOT support dafault value definition outside object properties & array items schemas', function() {
            const schema = {
                type: 'array',
                default: ['some', 'values']
            };

            const data = schemaUtils.extractDefaults(schema);
            expect(data).to.be.equal(undefined);
        });

        it('should NOT support dafault value definition outside object properties & array items schemas (2)', function() {
            const schema = {
                type: 'array',
                items: {
                    type: 'string',
                    default: 'invalid'
                }
            };

            const data = schemaUtils.extractDefaults(schema);
            expect(data).to.be.equal(undefined);
        });

        it('should NOT support dafault value definition outside object properties & array items schemas (3)', function() {
            const schema = {
                type: 'array',
                items: {
                    type: 'object',
                    default: {test: 'invalid'}
                }
            };

            const data = schemaUtils.extractDefaults(schema);
            expect(data).to.be.equal(undefined);
        });

        it('should NOT support default value definition for primitive types', function() {
            const schema = {
                type: 'string',
                default: 'test'
            };

            const data = schemaUtils.extractDefaults(schema);
            expect(data).to.be.equal(undefined);
        });
    });
});
