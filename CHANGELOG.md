## FUTURE

* [BUGFIX] `Model.prototype.unlock` was not accepting `cas` argument thus the unlock operation could not succeed
* [CHANGED] `Document.prototype.touch` returns self (Document object)
* [ADDED] `Instance.prototype.touch` which operates on all reference documents in addition to the main document
* [ADDED] new public method `Instance.prototype.getRefDocs` which has been part of private API
* [CHANGED] `Instance.prototype.update` method behaves as one would expect, that is more or less its syntax sugar for `instance.setData()` followed by `instance.save()`. This also fixes the method design issue which broke update hooks.
* [BUGFIX] `storageAdapter` methods should always clone received `options` object as native `couchbase` sdk does not do that and we need to be sure options objects are not shared and mutated between individual operations
* [REMOVED] unused `debug` module dependency
* [BUGFIX] updated `bluebird` module dependency

## v2.0.0-rc.1

* [REMOVED] support for callback based hook listeners. All async hook listeners are expected to return a Promise
* [BUGFIX] corner case with Model definition which has Model association defined as it's root data type - association data was being incorrectly serialized when saving to a bucket
* [BUGFIX] the `toJSON` method on `Model's Instance` object was failing to throw an `InstanceError` in case you tried to convert model with primitive root data type to JSON
* [BUGFIX] the `caseSensitive`option on `Key` object was being owerwritten by `true` boolean
* [BUGFIX] default Model's property values of Array type are cloned before they are applied to a model instance
* [BUGFIX] the `Model.build` method should initialize instance's associations before data sanitization/validation
* [CHANGED] `Instance.cloneData` method has been made part of private (renamed to `Instance.$cloneData`)
* [CHANGED] `Instance.destroy` & `Instance.update` methods will return rejected promise with an `InstanceError` when calling the methods on a Model instance object with no `cas` value set (the operation can be forced by the `force=true`)
* [CHANGED] format of the second argument of the `Model.buildKey` method has changed. The method accepts `options` object instead of boolean argument
* [CHANGED] the `afterFailedIndexRemoval` hook type is triggered not just for `StorageError` but also for any other error that occurs while removing outdated reference document indexes
* [CHANGED] defined default values are always applied when creating new Instance via `Model.build` method
* [CHANGED] the `Model.build` method does not clone data values passed to it anymore
* [CHANGED] `Model.getById` and `Model.getByRefDoc` methods returns resolved promise with the `null` value when a document is not found in a bucket
* [CHANGED] `Model.getMulti` method always returns resolved promise
* [ADDED] new `skipInternalProperties` option to the Instance.sanitize method
* [ADDED] support for defining default array item values in a schema definition
* [ADDED] new `Instance.populate` method - handles loading of Model's associations
* [ADDED] new `Model.getByIdOrFail` which returns rejected promise with `StorageError` when a document is not found in a bucket
* [ADDED] new `Model.buildRefDocKey` method (Model's private method `$buildRefDocKey` has been updated and made public)
* [ADDED] new `getByRefDocOrFail` method for every defined refDoc index. The method returns rejected promise with `StorageError` when a document is not found in a bucket
* [ADDED] new `lean` option to `Model` "getByRefDoc" methods - if true, the method returns document's `Key` object instead of fetched document's data
* [ADDED] new `refDocKey` Model option which allows us to provide custom constructor object used for generating reference document keys
* [ADDED] new `key` option  to `Model.create` method which can be an `Key` object or `id` string value
* [ADDED] new `Model.exists` method
* [ADDED] new `indexed` option to `Model.getMulti` method which if false, causes method to return an Array instead of Object (default=true)
* [BUGFIX] Model's `update` instance method did recursive merge with provided data on data being updated, now,  object's properties are overridden by assignment.
* [BUGFIX] Model's `update` method works on Models with primitive root data structures
* [ADDED] new `EMBEDDED` Model association relation type

## v1.0.1

* [BUGFIX] - Default values of an object type should be cloned before they are assigned to an `Instance`
* [BUGFIX] - `Model.getById` was throwing synchronous exeption when building of document's `Key` object failed. See #12
* [BUGFIX] - Setting Model's association default value on schema definition property of `Complex` type was throwing unexpected `ValidationError`/`TypeError`. See #19
* [BUGFIX] - It was not possible to update `refDoc` index of already persisted `Instance` with no index value present yet. See #15
* [BUGFIX] - Semantic error - `Instance.update` method was trowing "Cannot read property '$buildRefDocument' of null". See #14

## v1.0.0

* [BUGFIX] - ModelManager throws `ModelManagerError` & `ModelNotFoundError` instead of generic `Error` object
* [BUGFIX] - Model "getByRefDoc" methods ignored provided options object
* [BUGFIX] - `expiry` option was ignored in `Model.touch` method
* [BUGFIX] - documentation clarifications

## v1.0.0-rc.3

* [BUGFIX] a `refDoc` with compound `RefDocKey` was not found when searching a document because of invalid refDoc key generation
* [BUGFIX] Instance `isNewRecord` option was not set on constructor call  
* [BUGFIX] deleted_at schema property should be set as "not required" for a Model with `paranoid=true` option  
* [BUGFIX] `afterFailedRollback` hook is called with actual error which caused the rollback process to fail  
* [BUGFIX] fixed incorrect determination whether asynchronous hook function has defined callback fn or it returns a Promise.  
* [BUGFIX] validation of REQUIRED schema properties did not fail when the properties were not defined in data being validated  
* [BUGFIX] bucket object option on a Model definition should overwrite definition on `CouchbaseODM` object  
* [BUGFIX] fixed reference error when single hook function is being registered on `CouchbaseODM` object  
* [ADDED] `beforeCreate`, `afterCreate`, `beforeUpdate`, `afterUpdate`, `beforeGet`, `afterGet`, `beforeDestroy`, `afterDestroy` hook functions are given `options` object argument with which a storage method was called  
* [ADDED] unit tests for top level `CouchbaseODM` object  
* [ADDED] CouchbaseODM now accepts a `bucket` object from external `couchbase sdk` module. Till now a `bucket` object could be created only with `kouchbase-odm/node_modules/couchbase` sdk  

#### v1.0.0-rc.2  

* mainly repository/npm setup

#### v1.0.0-rc.1g  

* mainly repository/npm setup

#### v1.0.0-rc.1f  

* mainly repository/npm setup
