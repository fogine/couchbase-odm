const _       = require("lodash");
const Instance  = require("../instance");

module.exports.applyDefaults = applyDefaults;
module.exports.cloneDefaults = cloneDefaults;

/**
 * @param {Array<Object>} defaults
 * @param {mixed} data
 *
 * @return {mixed} data
 */
function applyDefaults(defaults, data) {

    defaults.forEach(function(setting) {
        if (data === undefined && !setting.path.length) {
            data = cloneDefaults(setting.default);
        }

        if (setting.path[setting.path.length-1] instanceof Array) {
            let col;
            if (setting.path.length == 1) {
                col = data;
            } else {
                col = _.get(data, setting.path.slice(0, -1));
            }

            if (col instanceof Array) {
                col.forEach(function(item) {
                    return applyDefaults([
                        {
                            path: setting.path[setting.path.length -1],
                            default: cloneDefaults(setting.default)
                        }
                    ], item);
                });
            }
        } else {
            let parentData = _.get(data, setting.path.slice(0, -1));

            if ((setting.path.length == 1
                || (typeof parentData === 'object' && parentData !== null))
                && _.get(data, setting.path) === undefined
            ) {
                _.set(data, setting.path, cloneDefaults(setting.default));
            }
        }
    });

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
