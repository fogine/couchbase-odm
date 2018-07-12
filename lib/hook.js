var _           = require("lodash");
var Promise     = require('bluebird');
var HookError   = require('./error/hookError.js');

/**
 * @name CouchbaseODM.prototype.errors
 * @type {ErrorList}
 */

/**
 * @name CouchbaseODM.errors
 * @type {ErrorList}
 */

/**
 * @typedef HookType
 * @type {Object}
 * @property {Hook} beforeValidate
 * @property {Hook} afterValidate
 * @property {Hook} beforeCreate
 * @property {Hook} afterCreate
 * @property {Hook} beforeDestroy
 * @property {Hook} afterDestroy
 * @property {Hook} beforeRollback
 * @property {Hook} afterRollback
 * @property {Hook} afterFailedRollback
 * @property {Hook} afterFailedIndexRemoval
 * @property {Hook} beforeUpdate
 * @property {Hook} afterUpdate
 * @property {Hook} beforeGet
 * @property {Hook} afterGet
 */
var HookType = Object.freeze({
    beforeValidate          : {type: 'beforeValidate', sync : true},
    afterValidate           : {type: 'afterValidate', sync : true},
    beforeCreate            : {type: 'beforeCreate'},
    afterCreate             : {type: 'afterCreate'},
    beforeDestroy           : {type: 'beforeDestroy'},
    afterDestroy            : {type: 'afterDestroy'},
    beforeRollback          : {type: 'beforeRollback'},
    afterRollback           : {type: 'afterRollback'},
    afterFailedRollback     : {type: 'afterFailedRollback', sync: true},
    afterFailedIndexRemoval : {type: 'afterFailedIndexRemoval', sync: true},
    beforeUpdate            : {type: 'beforeUpdate'},
    afterUpdate             : {type: 'afterUpdate'},
    beforeGet               : {type: 'beforeGet'},
    afterGet                : {type: 'afterGet'}
});

var HookValues = [];
Object.keys(HookType).forEach(function(hookName) {
    HookValues.push(HookType[hookName]);
});

/**
 * @abstract
 * @private
 * @constructor
 */
var Hook = {};

/**
 * addHook
 *
 * @throws {HookError}
 *
 * @param {string}   `hookType` - see {@link HookType} for available types
 * @param {function} fn - hook function
 * @param {string}   name - the identificator
 *
 * @name Hook#addHook
 * @function
 * @return this
 *
 */
Hook.addHook = function(hookType, fn, name) {
    if (HookValues.indexOf(HookType[hookType]) === -1) {
        throw new HookError('Attempted to attach hook of invalid hook type.');
    }

    if (typeof fn !== 'function') {
        throw new HookError('Attempted to register hook which is not a function');
    }

    this.options.hooks[hookType] = this.options.hooks[hookType] || [];
    var hooks = this.options.hooks[hookType];
    if (!name) {
        hooks.push(fn);
    } else {
        hooks.push({
            name: name,
            fn: fn
        });
    }

    return this;
};

/**
 * listenerCount
 *
 * @param {String} hookType - see {@link HookType} for available types
 *
 * @name Hook#listenerCount
 * @function
 * @return {Integer}
 */
Hook.listenerCount = function(hookType) {
    if (!Array.isArray(this.options.hooks[hookType])) {
        return 0;
    }
    return this.options.hooks[hookType].length;
};

/**
 * removeHook
 *
 * @throws {HookError}
 *
 * @param {string} hookType - see {@link HookType} for available types
 * @param {string} name - the identificator
 *
 * @name Hook#removeHook
 * @function
 * @return this
 *
 */
Hook.removeHook = function(hookType, name) {
    if (HookValues.indexOf(HookType[hookType]) === -1) {
        throw new HookError('Attempted to remove hook: ' + name + ' of invalid hook type.');
    }

    var hooks = (this.options.hooks && this.options.hooks[hookType]) || [];
    this.options.hooks[hookType] = hooks.filter(function(value) {
        if (_.isPlainObject(value) && value.name === name) {
            return false;
        }
        return true;
    });
    return this;
};

/**
 * runHooks
 *
 * additional arguments passed to the function will be passed to the hook function
 *
 * @throws {HookError}
 *
 * @param {string|Object} hookType
 *
 * @name Hook#runHooks
 * @function
 * @return Promise
 */
Hook.runHooks = function(hookType) {

    if (   (typeof hookType === 'string' && !HookType.hasOwnProperty(hookType))
        && HookValues.indexOf(hookType) === -1
       ) {
        throw new HookError('Attempted ro run hooks of invalid type.');
    }

    var hookOptions;

    if (typeof hookType === 'string') {
        hookOptions = HookType[hookType];
    } else {
        hookOptions = hookType;
        hookType = hookType.type;
    }

    var self = this;
    var hooks = this.options.hooks[hookType] || [];
    var fnArgs = Array.apply(this, arguments).slice(1);
    var promises = [];

    hooks = hooks.map(function(hook) {
        if (_.isPlainObject(hook)) {
            return hook.fn;
        }
        return hook;
    });

    //run hooks as sync functions if flagged as sync
    if (hookOptions.sync) {
        hooks.forEach(function(hook) {
            //if (_.isPlainObject(hook)) hook = hook.fn;
            return hook.apply(self, fnArgs);
        });
        return;
    }

    // run hooks async
    return Promise.each(hooks, function (hook) {
        //if (_.isPlainObject(hook)) {
            //hook = hook.fn;
        //}

        return hook.apply(self, fnArgs);
    }).return();
};

module.exports = {
    /**
     */
    types: HookType,
    /**
     */
    applyTo: function(Model) {
        _.mixin(Model, Hook);
        _.mixin(Model.prototype, Hook);

        var allHooks = Object.keys(HookType);
        allHooks.forEach(function(hook) {
            Model.prototype[hook] = function(fn, name) {
                return this.addHook(hook, fn, name);
            };
        });
    }
};
/**
 * adds hook function to the stack
 * @name Hook#beforeValidate
 * @function
 * @param {function} fn - hook function
 * @param {string}   name - the identificator
 * @return {this}
 */

/**
 * adds hook function to the stack
 * @name Hook#afterValidate
 * @function
 * @param {function} fn - hook function
 * @param {string}   name - the identificator
 * @return {this}
 */

/**
 * adds hook function to the stack
 * @name Hook#beforeCreate
 * @function
 * @param {function} fn - hook function
 * @param {string}   name - the identificator
 * @return {this}
 */

/**
 * adds hook function to the stack
 * @name Hook#afterCreate
 * @function
 * @param {function} fn - hook function
 * @param {string}   name - the identificator
 * @return {this}
 */

/**
 * adds hook function to the stack
 * @name Hook#beforeDestroy
 * @function
 * @param {function} fn - hook function
 * @param {string}   name - the identificator
 * @return {this}
 */

/**
 * adds hook function to the stack
 * @name Hook#afterDestroy
 * @function
 * @param {function} fn - hook function
 * @param {string}   name - the identificator
 * @return {this}
 */

/**
 * adds hook function to the stack
 * @name Hook#beforeRollback
 * @function
 * @param {function} fn - hook function
 * @param {string}   name - the identificator
 * @return {this}
 */

/**
 * adds hook function to the stack
 * @name Hook#afterRollback
 * @function
 * @param {function} fn - hook function
 * @param {string}   name - the identificator
 * @return {this}
 */

/**
 * adds hook function to the stack
 * @name Hook#beforeValidate
 * @function
 * @param {function} fn - hook function
 * @param {string}   name - the identificator
 * @return {this}
 */

/**
 * adds hook function to the stack
 * @name Hook#afterFailedRollback
 * @function
 * @param {function} fn - hook function
 * @param {string}   name - the identificator
 * @return {this}
 */

/**
 * adds hook function to the stack
 * @name Hook#afterFailedIndexRemoval
 * @function
 * @param {function} fn - hook function
 * @param {string}   name - the identificator
 * @return {this}
 */

/**
 * adds hook function to the stack
 * @name Hook#beforeUpdate
 * @function
 * @param {function} fn - hook function
 * @param {string}   name - the identificator
 * @return {this}
 */

/**
 * adds hook function to the stack
 * @name Hook#afterUpdate
 * @function
 * @param {function} fn - hook function
 * @param {string}   name - the identificator
 * @return {this}
 */

/**
 * adds hook function to the stack
 * @name Hook#beforeGet
 * @function
 * @param {function} fn - hook function
 * @param {string}   name - the identificator
 * @return {this}
 */

/**
 * adds hook function to the stack
 * @name Hook#afterGet
 * @function
 * @param {function} fn - hook function
 * @param {string}   name - the identificator
 * @return {this}
 */
