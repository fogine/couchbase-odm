const _         = require('lodash');
const sinon     = require('sinon');
const chai      = require('chai');
const sinonChai = require("sinon-chai");
const couchbase = require('couchbase').Mock;

const dataUtils = require('../../../lib/util/data.js');
const ODM       = require('../../../index.js');


chai.use(sinonChai);
chai.should();

const DataTypes  = ODM.DataTypes;
const assert     = sinon.assert;
const expect     = chai.expect;

describe('data utils', function() {
    describe('applyDefaults', function() {
        it('should apply missing default values to data object', function() {
            const defaults = {
                apps: {
                    prop: 10,
                    prop2: {name: 'value'}
                },
                col: [{}],
                prop3: false
            };

            const data = {};

            const dataWithDefaults = dataUtils.applyDefaults(defaults, data);

            expect(dataWithDefaults).to.be.eql({
                apps: {
                    prop: 10,
                    prop2: {name: 'value'}
                },
                col: [{}],
                prop3: false
            });
        });

        it('should apply missing default values to data object (2)', function() {
            const defaults = {
                apps: {
                    prop: 10,
                    prop2: {name: 'value'}
                },
                col: [{}],
                prop3: false
            };

            const data = {
                apps: {
                    prop: 22,
                    prop2: {age: 12}
                },
                col: []
            };

            const dataWithDefaults = dataUtils.applyDefaults(defaults, data);

            expect(dataWithDefaults).to.be.eql({
                apps: {
                    prop: 22,
                    prop2: {name: 'value', age: 12}
                },
                col: [{}],
                prop3: false
            });
        });

        it('should apply array item default values to array object elements', function() {
            const defaults = {
                col: [{}]
            };
            defaults.col.itemDefaults = {
                prop: 'value'
            };

            Object.defineProperty(
                defaults.col.itemDefaults,
                '_requiresMergeTarget',
                {
                    value: true,
                    writable: false,
                    enumerable: false
                }
            );

            const col = [];
            col[1] = {prop2: 'value2'};
            col[2] = null;

            const data = {
                col: col
            };

            const dataWithDefaults = dataUtils.applyDefaults(defaults, data);

            expect(dataWithDefaults).to.be.eql({
                col: [
                    {prop: 'value'},
                    {prop: 'value', prop2: 'value2'},
                    null
                ]
            });
        });

        it('should apply missing default values to array object elements', function() {
            const defaults = [];
            defaults.itemDefaults = {
                prop: 'value',
                obj: {prop: 'value'}
            };

            const data = [{}, {prop: 'different'}];

            const dataWithDefaults = dataUtils.applyDefaults(defaults, data);

            expect(dataWithDefaults).to.be.eql([
                {prop: 'value', obj: {prop: 'value'}},
                {prop: 'different', obj: {prop: 'value'}}
            ]);
        });


        it('should NOT apply defaults when target object does not exist and default source object is tagged with _requiresMergeTarget flag', function() {
            const defaults = {
                col: [{prop: 'value'}]
            };

            Object.defineProperty(defaults.col[0], '_requiresMergeTarget', {
                enumerable: false,
                value: true,
                writable: false
            });

            [
                { col: [null] },
                { col: [] },
                { col: [undefined] },
                { col: [1] },
                { col: [[]] },
            ].forEach(function(data, index) {
                const dataWithDefaults = dataUtils.applyDefaults(defaults, data);

                expect(dataWithDefaults).to.be.eql(
                    data,
                    `failed with dataset: ${index}`
                );
            });
        });

        it('should clone data before they are applied to the data object', function() {
            const defaults = {
                prop1: ['test', 'test'],
                prop2: {
                    prop5: 2,
                    prop6: false
                }
            };
            Object.defineProperty(defaults.prop1, 'itemDefaults', {
                enumerable: false,
                value: 'test',
                writable: true
            });
            Object.defineProperty(defaults.prop1, '_requiresMergeTarget', {
                enumerable: false,
                value: true,
                writable: false
            });

            const data = {prop1: []};

            const dataWithDefaults = dataUtils.applyDefaults(defaults, data);

            dataWithDefaults.prop1.should.be.eql(defaults.prop1);
            dataWithDefaults.prop1.should.be.eql(defaults.prop1);

            dataWithDefaults.prop1.should.not.be.equal(defaults.prop1);
            dataWithDefaults.prop2.should.not.be.equal(defaults.prop2);
        });

        it('should not treat null type as empty value (aka. undefined)', function() {
            const defaults = {
                apps: {
                    prop: 10,
                    prop2: {name: 'value'}
                },
                col: [{}],
                prop3: false
            };

            const data = {
                apps: {
                    prop: null,
                    prop2: null
                },
                col: [null],
                prop3: null
            };

            const dataClone = _.cloneDeep(data);

            const dataWithDefaults = dataUtils.applyDefaults(defaults, data);

            expect(dataWithDefaults).to.be.eql(dataClone);
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

        it('should copy the `_requiresMergeTarget` property on array objects', function() {
            var defaults = {
                props: []
            };
            defaults.props._requiresMergeTarget = true;

            var cloned = dataUtils.cloneDefaults(defaults);

            cloned.props.should.have.property('_requiresMergeTarget', true);
        });
    });
});
