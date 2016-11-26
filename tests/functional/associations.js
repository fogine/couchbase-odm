var _              = require("lodash");
var Promise        = require('bluebird');
var sinon          = require('sinon');
var sinonChai      = require("sinon-chai");
var chai           = require('chai');
var chaiAsPromised = require('chai-as-promised');
var couchbase      = require('couchbase').Mock;

var ODM          = require('../../index.js');
var RelationType = require('../../lib/relationType.js');

//this makes sinon-as-promised available in sinon:
require('sinon-as-promised');

var DataTypes = ODM.DataTypes;

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

var assert = sinon.assert;
var expect = chai.expect;

describe('Model associations', function() {
    describe('root data type => HASH TABLE (Object)', function() {
        before('Build Models', function() {
            var cluster = new couchbase.Cluster();
            var bucket = this.bucket = cluster.openBucket('functional');

            this.buildModels = buildModels;
            this.buildDocuments = buildDocuments;
            this.insertDocuments = insertDocuments;

            function buildModels(odm, relation) {
                var Admins = odm.define('Admins', {
                    type: DataTypes.ARRAY,
                    schema: {
                        type: DataTypes.COMPLEX('User', {relation: relation})
                    }
                });

                var User = odm.define('User', {
                    type: DataTypes.HASH_TABLE,
                    schema: {
                        username: {
                            type: DataTypes.STRING
                        },
                        email: {
                            type: DataTypes.STRING
                        },
                        files: {
                            type: DataTypes.ARRAY,
                            schema: {
                                type: DataTypes.COMPLEX('File', {relation: relation})
                            }
                        }
                    }
                });

                var FileLink = odm.define('FileLink', {
                    type: DataTypes.COMPLEX('File', {relation: relation})
                });

                var File = odm.define('File', {
                    type: DataTypes.HASH_TABLE,
                    schema: {
                        name: {
                            type: DataTypes.STRING
                        },
                        data: {
                            type: DataTypes.COMPLEX('FileData', {relation: relation})
                        }
                    }
                }, {
                    indexes: {
                        refDocs: {
                            name: {
                                keys: ['name']
                            }
                        }
                    }
                });

                var FileData = odm.define('FileData', {
                    type: DataTypes.STRING
                });

                this.Admins = Admins;
                this.User = User;
                this.FileLink = FileLink;
                this.File = File;
                this.FileData = FileData;
            }

            function buildDocuments() {
                this.fileData = this.FileData.build('data:text/plain,Hello word');
                this.file = this.File.build({
                    name: 'helloWord',
                    data: this.fileData
                });
                this.fileLink = this.FileLink.build(this.file);
                this.user = this.User.build({
                    username: 'happie',
                    email: 'test@test.com',
                    files: [
                        this.file
                    ]
                });
                this.admins = this.Admins.build([
                        this.user
                ]);
            }

            function insertDocuments() {
                return this.fileData.save().bind(this).then(function() {
                    return this.file.save();
                }).then(function() {
                    return this.fileLink.save();
                }).then(function() {
                    return this.user.save();
                }).then(function() {
                    //console.log('*****************BUCKET**************');
                    //console.log(this.bucket.storage.items[this.file.getKey().toString()][this.file.getKey().toString()].value.toString());
                    return this.admins.save();
                });
            }
        });

        describe('REFERENCE relation type', function() {

            before('Build models', function() {
                var odm = this.odm = new ODM({bucket: this.bucket});
                this.buildModels.call(this, odm, RelationType.REF);
            });

            before('Build documents', function() {
                this.buildDocuments.call(this);
            });

            before('Insert documents', function() {
                return this.insertDocuments.call(this);
            });

            after(function(callback) {
                this.bucket.manager().flush(callback);
            });

            describe('get & `populate`', function() {
                it("should successfully load file with it's 'data' association", function() {
                    return this.File.getById(this.file.getKey())
                    .bind(this)
                    .should.be.fulfilled
                    .then(function(file) {
                        return file.populate('data');
                    }).then(function(file) {
                        file.data.should.be.an.instanceof(this.FileData.Instance);
                        file.data.getData().should.be.eql(this.fileData.getData());
                    });
                });

                it('should recursively load associations of the fileLink document', function() {
                    return this.FileLink.getById(this.fileLink.getKey())
                    .bind(this)
                    .should.be.fulfilled
                    .then(function(fileLink) {
                        return fileLink.populate({
                            path: '',
                            populate: {
                                path: 'data'
                            }
                        });
                    }).then(function(fileLink) {
                        var file = fileLink.getData();
                        file.should.be.an.instanceof(this.File.Instance);
                        _.omit(file.getData(), ['data']).should.be.eql(
                                _.omit(this.file.getData(), ['data'])
                        );
                        file.data.getData().should.be.equal(this.file.data.getData());
                    });
                });

                it('should load file associations of the user document', function() {
                    return this.User.getById(this.user.getKey())
                    .bind(this)
                    .should.be.fulfilled
                    .then(function(user) {
                        return user.populate('files');
                    }).then(function(user) {
                        user.getData().should.be.eql(this.user.getData());
                        user.files.pop().getData().should.be.eql(this.file.getData());
                    });
                });

                it("should recursivelly load all associations of the 'admins' document", function() {
                    return this.Admins.getById(this.admins.getKey())
                    .bind(this)
                    .should.be.fulfilled
                    .then(function(admins) {

                        admins.getData().should.be.an.instanceof(Array);
                        admins.getData().should.have.lengthOf(1);
                        admins.getData()[0].should.be.instanceof(this.User.Instance);

                        return admins.populate({
                            path: null,
                            populate: {
                                path: 'files',
                                populate: 'data'
                            }
                        });
                    }).then(function(admins) {
                        admins.getData().should.be.eql(this.admins.getData());
                    });
                });

                it('should load user associations of the "admins" document', function() {
                    return this.Admins.getById(this.admins.getKey())
                    .bind(this)
                    .should.be.fulfilled
                    .then(function(admins) {

                        return admins.populate();
                    }).then(function(admins) {
                        _.omit(admins.getData().pop().getData(), ['files']).should.be.eql(
                                _.omit(this.admins.getData().pop().getData(), ['files'])
                        );
                    });
                });
            });

            describe('destroy', function() {
                it("should destroy loaded file associations with it's reference documents", function() {
                    return this.User.getById(this.user.getKey())
                    .bind(this)
                    .should.be.fulfilled
                    .then(function(user) {
                        return user.populate('files');
                    }).then(function(user) {
                        return Promise.map(user.files, function(file) {
                            return file.destroy();
                        });
                    }).map(function(file) {
                        return Promise.all([
                                //searches for the document
                                this.File.getById(file.getKey()),
                                //searches for reference document
                                this.File.getByName(file.name, {lean:true})
                        ]);
                    }).each(function(fileOperations) {
                        fileOperations.should.be.an.instanceof(Array);
                        fileOperations.should.have.lengthOf(2);
                        expect(fileOperations[0]).to.be.equal(null);
                        expect(fileOperations[1]).to.be.equal(null);
                    });
                });
            });
        });

        describe('EMBEDDED relation type', function() {

            before('Build models', function() {
                var odm = this.odm = new ODM({bucket: this.bucket});
                this.buildModels.call(this, odm, RelationType.EMBEDDED);
            });

            before('Build documents', function() {
                this.buildDocuments.call(this);
            });

            before('Insert documents', function() {
                return this.insertDocuments.call(this);
            });

            describe('`get from a bucket`', function() {
                it("should successfully load file with it's 'data' association", function() {
                    return this.File.getById(this.file.getKey())
                    .bind(this)
                    .should.be.fulfilled
                    .then(function(file) {
                        //console.log('*****************BUCKET**************');
                        //console.log(this.bucket.storage.items[this.file.getKey().toString()][this.file.getKey().toString()].value.toString());
                        file.data.should.be.instanceof(this.FileData.Instance);
                        file.data.getData().should.be.eql(this.fileData.getData());
                    });
                });

                it('should recursively load associations of the fileLink document', function() {
                    return this.FileLink.getById(this.fileLink.getKey())
                    .bind(this)
                    .should.be.fulfilled
                    .then(function(fileLink) {
                        var file = fileLink.getData();
                        file.should.be.an.instanceof(this.File.Instance);
                        _.omit(file.getData(), ['data']).should.be.eql(
                                _.omit(this.file.getData(), ['data'])
                        );
                        //fileData association must be compared separately because
                        //fileData document id is not set in object initiated with data
                        //from bucket whereas the manually builded fileData object which
                        //has been perssisted to bucket has an id generated
                        file.data.getData().should.be.equal(this.file.data.getData());
                    });
                });

                it('should load file associations of the user document', function() {
                    return this.User.getById(this.user.getKey())
                    .bind(this)
                    .should.be.fulfilled
                    .then(function(user) {
                        user.files.should.be.instanceof(Array);
                        var file = user.files[0];
                        file.should.be.instanceof(this.File.Instance);
                        //File document does not have saved a FileData document key
                        //alongside FileData association data string
                        //so we must set it, in order to be the both instead deep equal
                        file.data.getKey().setId(this.file.data.getKey().getId());
                        user.getData().should.be.eql(this.user.getData());
                    });
                });

                it("should recursivelly load all associations of the 'admins' document", function() {
                    return this.Admins.getById(this.admins.getKey())
                    .bind(this)
                    .should.be.fulfilled
                    .then(function(admins) {
                        admins.getData().should.be.an.instanceof(Array);
                        admins.getData().should.have.lengthOf(1);
                        admins.getData()[0].should.be.instanceof(this.User.Instance);
                        //File document does not have saved a FileData document key
                        //alongside FileData association data string
                        //so we must set it, in order to be the both instead deep equal
                        admins.getData('0').files[0].data.getKey().setId(this.file.data.getKey().getId());
                        admins.getData().should.be.eql(this.admins.getData());
                    });
                });
            });
        });

    });
});
