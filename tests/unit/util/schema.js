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
                            relation: {
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
                                        relation: { type: 'User' }
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
                                {relation: {type: 'User'}},
                                {relation: {type: 'Country', method: 'reference'}},
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

            it('should allow to define `relation` as root data type', function() {
                const schema = {
                    relation: {
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
});
