var _              = require("lodash");
var Promise        = require('bluebird');
var sinon          = require('sinon');
var sinonChai      = require("sinon-chai");
var chai           = require('chai');
var chaiAsPromised = require('chai-as-promised');
var couchbase      = require('couchbase').Mock;

var ODM = require('../../index.js');

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
            var bucket = cluster.openBucket('functional');

            var odm = new ODM({bucket: bucket});

            var Admins = odm.define('Admins', {
                type: DataTypes.ARRAY,
                schema: {
                    type: DataTypes.COMPLEX('User')
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
                            type: DataTypes.COMPLEX('File')
                        }
                    }
                }
            });

            var FileLink = odm.define('FileLink', {
                type: DataTypes.COMPLEX('File')
            });

            var File = odm.define('File', {
                type: DataTypes.HASH_TABLE,
                schema: {
                    name: {
                        type: DataTypes.STRING
                    },
                    data: {
                        type: DataTypes.COMPLEX('FileData')
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
            this.bucket = bucket;
        });

        before('Build documents', function() {
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
        });

        before('Insert documents', function() {
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
        });

        it("should successfully load file with it's data", function() {
            return this.File.getById(this.file.getKey())
            .bind(this)
            .should.be.fulfilled
            .then(function(file) {
                file.data.should.be.an.instanceof(this.FileData.Instance);
                return file.data.refresh();
            }).then(function(fileData) {
                fileData.getData().should.be.eql(this.fileData.getData());
            }).should.be.fulfilled;
        });

        it('should successfully load file link', function() {
            return this.FileLink.getById(this.fileLink.getKey())
            .bind(this)
            .should.be.fulfilled
            .then(function(fileLink) {
                fileLink.getData().should.be.an.instanceof(this.File.Instance);
                return fileLink.getData().refresh();
            }).then(function(file) {
                _.omit(file.getData(), ['data']).should.be.eql(
                        _.omit(this.file.getData(), ['data'])
                );
                return file.data.refresh();
            }).then(function(fileData) {
                fileData.getData().should.be.equal(this.file.data.getData());
            });
        });

        it('should successfully load user document', function() {
            var userInstance;

            return this.User.getById(this.user.getKey())
            .bind(this)
            .should.be.fulfilled
            .then(function(user) {
                userInstance = user;
                user.files.should.be.an.instanceof(Array);
                return Promise.map(user.files, function(file) {
                    return file.refresh();
                });
            }).then(function() {
                userInstance.getData().should.be.eql(this.user.getData());
                userInstance.files.pop().getData().should.be.eql(this.file.getData());
            });
        });

        it('should successfully load admin documents', function() {
            var adminsInstance;

            return this.Admins.getById(this.admins.getKey())
            .bind(this)
            .should.be.fulfilled
            .then(function(admins) {
                adminsInstance = admins;

                admins.getData().should.be.an.instanceof(Array);
                admins.getData().should.have.lengthOf(1);
                admins.getData()[0].should.be.instanceof(this.User.Instance);

                return Promise.map(admins.getData(), function(user) {
                    return user.refresh();
                });
            }).then(function(users) {
                //TODO
                //users.should.be.eql(this.admins.getData());
            });
        });

        it("should be possible to destroy unloaded file document with it's reference document", function() {
            return this.User.getById(this.user.getKey())
            .bind(this)
            .should.be.fulfilled
            .then(function(user) {
                return Promise.map(user.files, function(file) {
                    return file.destroy();
                });
            }).map(function(file) {
                return Promise.all([
                        this.File.getById(file.getKey()),
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
