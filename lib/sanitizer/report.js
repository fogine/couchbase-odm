
module.exports = Report;

/**
 * Report
 *
 * @constructor
 * @private
 */
function Report() {
    this.relations = [];
    this.data = null;
}

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
