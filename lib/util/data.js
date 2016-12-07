var _       = require("lodash");

var Instance  = require("../instance");
var DataTypes = require("../dataType").types;


module.exports.applyDefaults = applyDefaults;
module.exports.cloneDefaults = cloneDefaults;

/**
 * applyDefaults
 *
 * @param {mixed} defaults
 * @param {mixed} data
 *
 * @return {mixed} data
 */
function applyDefaults(defaults, data) {

    defaults = cloneDefaults(defaults);

    if (defaults === undefined) {
        return data;
    }

    if (_.isNil(data)) {
        if (defaults instanceof Array && defaults.bindedByForce === true) {
            return data;
        }
        return defaults;
    }

    if (_.isPlainObject(data) && _.isPlainObject(defaults)) {
        //we can't currently use assignWith because it skips data properties which
        //resolves to undefined. But we need to iterate over undefined properties
        //because of default array item values and associated flags (bindedByForce)
        //data = _.assignWith(defaults, data, applyDefaults);
        Object.keys(defaults).forEach(function(name) {
            data[name] = applyDefaults(defaults[name], data[name]);
        });
    } else if (   data instanceof Array
               && defaults instanceof Array
               && defaults.hasOwnProperty('itemDefaults')
               && defaults.itemDefaults !== undefined
    ) {
        for (var i = 0, len = data.length; i < len; i++) {
            data[i] = applyDefaults(defaults.itemDefaults, data[i]);
        }
    }

    return data;
}


/**
 * cloneDefaults
 *
 * @param {mixed} data
 *
 * @return {mixed}
 */
function cloneDefaults(data) {
    var cloned;

    if (!_.isPlainObject(data) && !Array.isArray(data)) {
        if (data instanceof Instance) {
            return data.clone();
        }
        return data;
    }

    if (data instanceof Array) {
        cloned = [];
        for (var i = 0, len = data.length; i < len; i++) {
            cloned.push(cloneDefaults(data[i]));
        }
    } else {
        cloned = _.cloneDeepWith(data, function customizer(val) {
            if (val instanceof Instance) return val.clone();
            if (val instanceof Array) {
                return cloneDefaults(val);
            }
        });
    }

    if (cloned instanceof Array) {
        if (data.hasOwnProperty('itemDefaults')) {
            cloned.itemDefaults = cloneDefaults(data.itemDefaults);
        }
        if (data.hasOwnProperty('bindedByForce')) {
            cloned.bindedByForce = data.bindedByForce;
        }
    }

    return cloned;
}
