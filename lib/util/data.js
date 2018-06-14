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
        if (data === undefined && typeof setting.path === 'undefined') {
            data = cloneDefaults(setting.default);
        }

        if (setting.path instanceof Array) {

            if (data instanceof Array) {
                data.forEach(function(item) {
                    return applyDefaults([
                        {
                            path: setting.path[0],
                            default: cloneDefaults(setting.default)
                        }
                    ], item);
                });
            }
        } else if (setting.default !== undefined
            && typeof data === 'object'
            && data !== null
            && data[setting.path] === undefined
        ) {
            data[setting.path] = cloneDefaults(setting.default);
        }

        if (setting.defaults instanceof Array && setting.defaults.length) {
            applyDefaults(setting.defaults, data[setting.path]);
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
