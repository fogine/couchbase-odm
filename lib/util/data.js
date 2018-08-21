const _       = require("lodash");
const Instance  = require("../instance");

module.exports.cloneDefaults = cloneDefaults;

/**
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
    }

    if (data.hasOwnProperty('_requiresMergeTarget')) {
        Object.defineProperty(
            cloned,
            '_requiresMergeTarget',
            {
                value: data._requiresMergeTarget,
                writable: false,
                enumerable: false
            }
        );
    }

    return cloned;
}
