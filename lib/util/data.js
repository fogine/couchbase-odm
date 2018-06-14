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
        let path = setting.path;

        if (data === undefined && typeof path === 'undefined') {
            data = cloneDefaults(setting.default);
        } else if (typeof setting.default !== 'undefined'
            && typeof data === 'object'
            && data !== null
            && typeof path !== 'undefined'
            && typeof data[path] === 'undefined'
        ) {
            if (path instanceof Array) {
                data[path[0]] = cloneDefaults(setting.default);
            } else {
                data[path] = cloneDefaults(setting.default);
            }
        }

        if (setting.defaults instanceof Array && setting.defaults.length) {
            if (path instanceof Array) {
                let typeofPath = typeof path[0];
                if (typeofPath !== 'undefined'
                    && data[path[0]] instanceof Array
                ) {
                    data[path[0]].forEach(function(item) {
                        return applyDefaults(setting.defaults, item);
                    });
                } else if (typeofPath === 'undefined') {
                    data.forEach(function(item) {
                        return applyDefaults(setting.defaults, item);
                    });
                }
            } else {
                applyDefaults(setting.defaults, data[path]);
            }
        }
    });

    return data;
}


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
