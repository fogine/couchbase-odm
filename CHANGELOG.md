## FUTURE

* [BUGFIX] default Model's property values of Array type are cloned before they are applied to a model instance
* [BUGFIX] the `Model.build` method should initialize instance's associations before data sanitization/validation
* [CHANGED] the `sanitize` Model.build method option which defaults to `true` instead of `false`
* [CHANGED] the `Model.build` method does not clone data values passed to it anymore
* [CHANGED] `Model.getById` and `Model.getByRefDoc` methods returns resolved promise with the `null` value when a keyNotFound error occurs
* [CHANGED] `Model.getMulti` method always returns resolved promise
* [ADDED] new `skipInternalProperties` option to the Instance.sanitize method

* [ADDED] new `refDocKey` Model option which allows us to provide custom constructor object used for generating reference document keys
* [ADDED] new `key` option  to `Model.create` method which can be an `Key` object or `id` string value
* [ADDED] new `Model.exists` method
* [ADDED] new `indexed` option to `Model.getMulti` method which if false, causes method to return an Array instead of Object (default=true)
* [BUGFIX] - Model's `update` instance method did recursive merge with provided data on data being updated, now,  object's properties are overridden by assignment. Also the `update` method works on Models with primitive data structures

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
