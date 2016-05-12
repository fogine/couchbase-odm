# CouchbaseODM
CouchbaseODM is a [promise-based](http://bluebirdjs.com/docs/getting-started.html) Node.js ODM for [Couchbase](http://www.couchbase.com/nosql-databases/couchbase-server). It strives for clean, easy-to-use API for your business logic, offering (reasonable) customizability.


Installation
-------------------
`npm install kouchbase-odm@rc.1f`

**Note:** CouchbaseODM is in "release candidate" stage. Please, fill a bug report at [issues](https://github.com/fogine/couchbase-odm/issues) page if you find any.  
Also, feedback and suggestions are more than welcome.

Features
-------------------
* Promises!
* Model based
* Hooks
* Advanced quering:
    * Application layer indexes (reference documents)
    * `Views` support (*next minor release*)
    * `N1QL` support (*on Roadmap*)

Resources
-------------------
* [Getting Started](http://fogine.github.io/couchbase-odm/tutorial-1.gettingStarted.html)
* [Documentation](http://fogine.github.io/couchbase-odm/tutorial-1.gettingStarted.html)
* [Public API Reference](http://fogine.github.io/couchbase-odm/CouchbaseODM.html)

Tests
-------------------

`npm run-script unit-tests`

-------------------------------------------

_**Note:** this project is using [Semantic versioning](http://semver.org/)_    
_**Note:** this project is inspired by [Sequelize](https://github.com/sequelize/sequelize) - splendid promise-based ORM for Postgres, MySQL, MariaDB, SQLite and Microsoft SQL Server_  
CouchbaseODM mimics some Sequelize functionality.
