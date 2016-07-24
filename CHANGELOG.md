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
