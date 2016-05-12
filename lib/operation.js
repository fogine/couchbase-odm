/**
 * @typedef Operation
 * @type {Object}
 * @property {string} INSERT
 * @property {string} REPLACE
 * @property {string} REMOVE
 * @property {string} GET
 */
var operation = Object.freeze({
    INSERT  : "INSERT",
    REPLACE : "REPLACE",
    REMOVE  : "REMOVE",
    GET     : "GET"
});

module.exports = operation;
