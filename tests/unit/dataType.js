var sinon          = require('sinon');
var chai           = require('chai');
var sinonChai      = require("sinon-chai");

var dataType = require("../../lib/dataType.js");

chai.use(sinonChai);
chai.should();

var assert = sinon.assert;
var expect = chai.expect;

describe('Complex TYPE', function() {
    describe('inspect', function() {
        it('should return correct string value', function() {
            var complex = new dataType.Complex('User');
            complex.inspect().should.be.equal('[object ComplexType: "User" ]');
        });
    });
});
