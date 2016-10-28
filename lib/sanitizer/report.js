var _ = require('lodash');

module.exports = Report;

/**
 * Report
 *
 * @constructor
 * @private
 */
function Report() {
    this.relations = [];
    this.defaultData = {};
}

/**
 * setSchemaPropertyDefaultValue
 *
 * @param {mixed} value
 * @param {String} path
 *
 * @return {undefined}
 */
Report.prototype.setSchemaPropertyDefaultValue = function(value, path) {
    if (path === undefined) {
        return;
    }

    if (path === null) {
        this.defaultData = value;
        return;
    }
    _.set(this.defaultData, path, value);
};


/**
 * getSchemaDefaults
 *
 * @return {Object}
 */
Report.prototype.getSchemaDefaults = function() {
    return this.defaultData;
};

/**
 * addRelation
 *
 * @param {Complex} type
 * @param {string}  path - full path to `property` of the `data` object which points to a
 *                              relation
 * @return {undefined}
 */
Report.prototype.addRelation = function(type, path) {
    this.relations.push({
        path : path,
        type : type
    });
}

/**
 * getRelations
 *
 * @return {Object} - hash table
 */
Report.prototype.getRelations = function() {
    return this.relations;
}
