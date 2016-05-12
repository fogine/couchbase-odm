'use strict';

var RelationType = require('./relationType.js');
var _            = require('lodash');

/**
 * Possible data types
 *
 * @example
 * //Model's schema property data type definition
 * {
 *     type: DataTypes.HASH_TABLE,
 *     schema: {
 *         username: {
 *             type: DataTypes.STRING
 *         },
 *         sex: {
 *             type: DataTypes.ENUM,
 *             enum: ['male', 'female']
 *         },
 *         friends: {
 *             type: DataTypes.ARRAY,
 *             schema: {
 *                 type: DataTypes.COMPLEX('User')
 *             }
 *         }
 *     }
 * }
 *
 * @typedef DataTypes
 * @type {Object}
 * @property {string} STRING
 * @property {string} NUMBER
 * @property {string} HASH_TABLE
 * @property {string} ARRAY
 * @property {string} BOOLEAN
 * @property {string} INT
 * @property {string} FLOAT
 * @property {string} DATE
 * @property {string} ENUM
 * @property {Funtion<type, options>} COMPLEX - always must be called as a function. Defines a relation to another Model
 */
var dataType = Object.freeze({
    STRING     : "STRING",
    NUMBER     : "NUMBER",
    HASH_TABLE : "HASH_TABLE",
    ARRAY      : "ARRAY",
    BOOLEAN    : "BOOLEAN",
    INT        : "INT",
    FLOAT      : "FLOAT",
    DATE       : "DATE",
    ENUM       : "ENUM",
    COMPLEX    : function(type, options) {
        var complex = new Complex(type, options);
        return complex;
    }
});

module.exports.types = dataType;
module.exports.Complex = Complex;

/*
 * exists
 *
 * check if given type is supported by ODM and therefore is valid data type
 *
 * @param {mixed} type
 * @return {boolean}
 */
module.exports.exists = function(type) {
    var result = dataType.hasOwnProperty(type.toString());

    if (!result) {
        return false;
    } else if (type.toString() === Complex.toString() && !(type instanceof Complex)) {
        return false;
    }
    return true;
}

/*
 * Complex
 *
 * constructor of complex data type = another Model relation
 *
 * @param {string} type
 * @param {Object} [options]
 *        {string} [options.relation] - see RelationType for available property values
 */
function Complex(type, options) {

    var defaults = {
        relation: RelationType.REFERENCE
    };

    Object.defineProperty(this, '$model', {
        writable: true,
        value: null
    });

    Object.defineProperty(this, 'type', {
        writable: false,
        value: type
    });

    Object.defineProperty(this, 'options', {
        writable: false,
        value:  _.merge(defaults, options)
    });

    Object.seal(this);
}

/*
 * getModel
 *
 * @param {ModelManager} modelManager
 * @return {Model}
 */
Complex.prototype.getModel = function(modelManager) {
    if (this.$model === null) {
        this.$model = modelManager.get(this.type);
    }
    return this.$model;
}

/*
 * toString
 *
 * @return {string}
 */
Complex.prototype.toString = Complex.toString = function() {
    return "COMPLEX";
}


/*
 * inspect
 *
 * @return {string}
 */
Complex.prototype.inspect = function() {
    return '[object ComplexType: "' + this.type + '" ]';
};
