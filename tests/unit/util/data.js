var sinon     = require('sinon');
var chai      = require('chai');
var sinonChai = require("sinon-chai");
var couchbase = require('couchbase').Mock;

var dataUtils = require('../../../lib/util/data.js');
var DataTypes = require('../../../lib/dataType.js').types;
var ODM       = require('../../../index.js');


chai.use(sinonChai);
chai.should();

var DataTypes  = ODM.DataTypes;
var assert     = sinon.assert;
var expect     = chai.expect;

describe('data utils', function() {
    describe('applyDefaults', function() {
        it("should correctly set default property values to object's properties which are empty (null/undefined)", function() {
            var defaults = {
                prop1: 'test',
                prop2: null,
                prop3: ['test', 'test'],
                prop4: {
                    prop5: 2,
                    prop6: false
                },
                prop7: ['test']
            };

            var data = {
                prop1: 'alreadyset',
                prop3: [],
                prop4: {}
            };

            var expected = {
                prop1: 'alreadyset',
                prop2: null,
                prop3: [],
                prop4: {
                    prop5: 2,
                    prop6: false
                },
                prop7: ['test']
            };

            var dataWithDefaults = dataUtils.applyDefaults(defaults, data);

            dataWithDefaults.should.be.eql(expected);
        });

        it('should clone data before they are applied to the data object', function() {
            var defaults = {
                prop1: ['test', 'test'],
                prop2: {
                    prop5: 2,
                    prop6: false
                }
            };
            defaults.prop1.itemDefaults = 'test';

            var data = {};

            var dataWithDefaults = dataUtils.applyDefaults(defaults, data);

            dataWithDefaults.prop1.should.be.eql(defaults.prop1);
            dataWithDefaults.prop1.should.be.eql(defaults.prop1);

            dataWithDefaults.prop1.should.not.be.equal(defaults.prop1);
            dataWithDefaults.prop2.should.not.be.equal(defaults.prop2);
        });

        it('should correctly apply default array item values to array items that have empty value', function() {
            var defaults = {
                props: []
            };
            defaults.props.itemDefaults = {
                prop1: 'test',
                prop2: null
            };

            var data = {
                props: [{prop1: 'alreadyset'}, null, undefined, '']
            };

            var dataWithDefaults = dataUtils.applyDefaults(defaults, data);

            dataWithDefaults.should.be.eql({
                props: [
                    {
                        prop1: 'alreadyset',
                        prop2: null
                    },
                    {
                        prop1: 'test',
                        prop2: null
                    },
                    {
                        prop1: 'test',
                        prop2: null
                    },
                    ''
                ]
            });
        });

        it('should correctly apply default array item values to array items that have empty value (2)', function() {
            var defaults = [];
            defaults.itemDefaults = 'test';

            var data = [null, undefined, ''];

            var dataWithDefaults = dataUtils.applyDefaults(defaults, data);

            dataWithDefaults.should.be.eql(['test', 'test', '']);
        });

        it("should not apply default array value if the value is marked as that it's been set by force (bindedByForce=true)", function() {
            var defaults = {
                props: []
            };

            defaults.props.bindedByForce = true;

            var dataWithDefaults = dataUtils.applyDefaults(defaults, {
                props: null
            });

            dataWithDefaults.should.be.eql({props: null});
        });
    });

    describe('cloneDefaults', function() {
        before(function() {
            var cluster = new couchbase.Cluster();
            var bucket = cluster.openBucket('test');
            var odm = new ODM({bucket: bucket});
            var model = odm.define('CloneDefaultsTestModel', {
                type: DataTypes.HASH_TABLE
            });

            this.model = model;
        });

        it('should correctly clone model Instance values by calling instance.clone()', function() {
            var instance = this.model.build();

            var instanceCloneSpy = sinon.spy(instance, 'clone');

            var defaults = {
                prop: instance,
                props: [instance]
            };

            var cloned = dataUtils.cloneDefaults(defaults);

            instanceCloneSpy.should.have.been.calledTwice;

            cloned.should.have.property('prop').that.is.instanceof(ODM.Instance);
            cloned.prop.should.not.be.equal(defaults.prop);

            cloned.should.have.property('props').that.is.instanceof(Array);
            cloned.props[0].should.be.instanceof(ODM.Instance);
            cloned.props[0].should.not.be.equal(defaults.props[0]);

            instanceCloneSpy.restore();
        });

        it('should has cloned `itemDefaults` property on array objects', function() {
            var defaults = [];
            defaults.itemDefaults = {
                props: []
            };
            defaults.itemDefaults.props.itemDefaults = 'test';

            var cloned = dataUtils.cloneDefaults(defaults);

            cloned.should.be.instanceof(Array);
            cloned.should.not.be.equal(defaults);

            var expectedRootArrayItemDefaults = {props: []};
            expectedRootArrayItemDefaults.props.itemDefaults = 'test';

            cloned.should.have.property('itemDefaults').that.is.eql(expectedRootArrayItemDefaults);

            cloned.itemDefaults.props.should.have.property('itemDefaults')
                .that.is.eql('test');
        });

        it('should copy the `bindedByForce` property on array objects', function() {
            var defaults = {
                props: []
            };
            defaults.props.bindedByForce = true;

            var cloned = dataUtils.cloneDefaults(defaults);

            cloned.props.should.have.property('bindedByForce', true);
        });
    });
});
