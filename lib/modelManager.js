var Model = require("./model.js");

module.exports = ModelManager;

/**
 * ModelManager
 *
 * @constructor
 */
function ModelManager() {
    this.models = {};
}

/**
 * add
 *
 * adds Model instance to list of registered models
 *
 * @param {Model} model
 * @return {undefined}
 */
ModelManager.prototype.add = function(model) {
    if (!(model instanceof Model)) {
        throw new Error("Not instance of Model");
    }

    if (this.models.hasOwnProperty(model.name)) {
        throw new Error("Model's name must be unique. Another Model is already registered under name: " + model.name);
    }
    this.models[model.name] = model;
}

/**
 * get
 *
 * @param {string} name
 * @return {Model}
 */
ModelManager.prototype.get = function(name) {

    var type = typeof name;
    if (type == 'string') {
        if (!this.models.hasOwnProperty(name)) {
            throw new Error("Model `" + name + "` not found.");
        }
        return this.models[name];
    } else {
        throw new Error("Expected string name of the Model");
    }
}

/**
 * getAll
 *
 * @return {Object<string, Model>}
 */
ModelManager.prototype.getAll = function() {
    return this.models;
}
