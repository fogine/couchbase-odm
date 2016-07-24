var Model              = require("./model.js");
var ModelNotFoundError = require('./error/modelNotFoundError.js');
var ModelManagerError  = require('./error/modelManagerError.js');

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
 * @throws {ModelManagerError}
 * @return {undefined}
 */
ModelManager.prototype.add = function(model) {
    if (!(model instanceof Model)) {
        throw new ModelManagerError("Not instance of Model");
    }

    if (this.models.hasOwnProperty(model.name)) {
        throw new ModelManagerError("Model's name must be unique. Another Model is already registered under the name: " + model.name);
    }
    this.models[model.name] = model;
}

/**
 * get
 *
 * @param {string} name
 * @throws {ModelNotFoundError}
 * @throws {ModelManagerError}
 * @return {Model}
 */
ModelManager.prototype.get = function(name) {

    var type = typeof name;
    if (type == 'string') {
        if (!this.models.hasOwnProperty(name)) {
            throw new ModelNotFoundError("Model `" + name + "` not found.");
        }
        return this.models[name];
    } else {
        throw new ModelManagerError("Expected string name of the Model");
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
