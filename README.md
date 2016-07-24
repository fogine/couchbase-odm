# CouchbaseODM

[![Build Status](https://travis-ci.org/fogine/couchbase-odm.svg?branch=master)](https://travis-ci.org/fogine/couchbase-odm) [![Test Coverage](https://codeclimate.com/github/fogine/couchbase-odm/badges/coverage.svg)](https://codeclimate.com/github/fogine/couchbase-odm/coverage) [![npm version](https://badge.fury.io/js/kouchbase-odm.svg)](https://www.npmjs.com/package/kouchbase-odm)  

CouchbaseODM is a [promise-based](http://bluebirdjs.com/docs/getting-started.html) Node.js ODM for [Couchbase](http://www.couchbase.com/nosql-databases/couchbase-server). It strives for clean, easy-to-use API for your business logic, offering (reasonable) customizability.


Installation
-------------------
`npm install kouchbase-odm@rc.3`

Please, fill a bug report at [issues](https://github.com/fogine/couchbase-odm/issues) page if you find any.  
Also, feedback and suggestions are more than welcome.

Features
-------------------
* Promises!
* Model based
* Hooks
* Key generation strategies (eg. incremented integer, uuidv4 or user defined strategies)
* Strictly typed schema definitions
* Document associations
* Advanced quering:
    * Application layer indexes (reference documents)
    * `Views` support (*next minor release*)
    * `N1QL` support (*on Roadmap*)
* and more (see Public API Reference)!

Resources
-------------------
* [Getting Started](https://fogine.github.io/couchbase-odm/tutorial-1.gettingStarted.html)
* [Documentation](https://fogine.github.io/couchbase-odm/tutorial-1.gettingStarted.html)
* [Public API Reference](https://fogine.github.io/couchbase-odm/CouchbaseODM.html)
* [Changelog](./CHANGELOG.md)

Tests
-------------------

`npm run-script unit-tests`

-------------------------------------------

_**Note:** this project is using [Semantic versioning](http://semver.org/)_    
_**Note:** this project is inspired by [Sequelize](https://github.com/sequelize/sequelize) - splendid promise-based ORM for Postgres, MySQL, MariaDB, SQLite and Microsoft SQL Server_  
CouchbaseODM mimics some Sequelize functionality.
