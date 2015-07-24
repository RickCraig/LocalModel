'use strict';

/**
 * Generates a random UUID
 * @private
 * @returns {String} random id
 */
var generateUUID = function(){
  var d = Date.now();
  var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
    .replace(/[xy]/g, function(c) {
      var r = (d + Math.random()*16)%16 | 0;
      d = Math.floor(d/16);
      return (c==='x' ? r : (r&0x3|0x8)).toString(16);
    });
  return uuid;
};

/**
 * Builds the key for the data
 * @private
 * @param {String} name - of the model
 * @param {String} id - of the entry
 * @returns {String} the merged key name
 */
var getKey = function(name, id) {
  return name + '::' + id;
};

/**
 * Adds the index for the new entry
 * @private
 * @param {String} name - the name of the model
 * @param {String} newIndex - the key for the new entry
 */
var addIndex = function(name, newIndex) {
  var indexName = name + '-index';
  var indexString = localStorage.getItem(indexName);
  var indices = indexString ? JSON.parse(indexString) : [];
  indices.push(newIndex);
  localStorage.setItem(indexName, JSON.stringify(indices));
};

/**
 * Returns the indices for a model
 * @private
 * @param {String} name - the model name
 * @returns {Array} the indices
 */
var getIndices = function(name) {
  var indices = localStorage.getItem(name + '-index');
  return indices ? JSON.parse(indices) : [];
};

/**
 * Get a specific index from the indices
 * @private
 * @param {Array} indices
 * @param {String} term
 * @returns {String} matching index
 */
var getIndex = function(indices, term) {
  var regex = new RegExp('::' + term, 'g');
  for (var i = 0; i < indices.length; i++) {
    var index = indices[i];
    if (regex.test(index)) {
      return index;
    }
  }
  return;
};

/**
 * Local Schema constructor
 * @public
 * @param {Object} schema
 */
var LocalSchema = function(name, schema) {
  this.schema = schema;
  this.name = name;
};

/**
 * Create a new data object for this schema
 * @public
 * @param {Object} data
 * @returns {}
 */
LocalSchema.prototype.create = function(data) {
  var newEntry = {};
  newEntry._id = generateUUID();
  for (var key in this.schema) {
    newEntry[key] = data[key];
  }

  // Save to localstorage
  // At some point if there is an index, it can be added the the key for speed
  var index = getKey(this.name, newEntry._id);
  localStorage.setItem(index, JSON.stringify(newEntry));
  addIndex(this.name, index);

  return newEntry;
};

/**
 * Returns all entries in storage
 */
LocalSchema.prototype.all = function() {
  this.indices = this.indices || getIndices(this.name);
  var results = [];
  for (var i = 0; i < this.indices.length; i++) {
    var index = this.indices[i];
    var result = JSON.parse(localStorage.getItem(index));
    results.push(result);
  }
  return results;
};

/**
 * Find an entry by ID
 * @public
 * @param {String} id
 * @returns {Object} the object or null
 */
LocalSchema.prototype.findById = function(id) {
  this.indices = this.indices || getIndices(this.name);
  var match = getIndex(this.indices, id);
  if (!match) {
    return;
  }
  return JSON.parse(localStorage.getItem(match));
};

/**
 * Find entries matching a query
 * @public
 * @param {Object} query
 * @returns {Array} an array of matches
 */
LocalSchema.prototype.find = function(query) {
  this.indices = this.indices || getIndices(this.name);
  var results = [];
  for (var i = 0; i < this.indices.length; i++) {
    var entry = localStorage.getItem(this.indices[i]);
    entry = JSON.parse(entry);
    var matches = false;

    for (var key in entry) {
      var queryItem = query[key];
      if (!queryItem) { continue; }
      if (queryItem instanceof RegExp) {
        matches = queryItem.test(entry[key]);
      } else {
        matches = entry[key] === queryItem;
      }
    }

    if (matches) {
      results.push(entry);
    }
  }
  return results;
};

/**
 * LocalSchema Schema Types
 * For use in validation and return
 * @public
 */
LocalSchema.SchemaTypes = {
  String: 'string',
  Number: 'number',
  Boolean: 'boolean',
  Mixed: 'mixed'
};

/**
 * LocalModel constructor
 * @public
 * @param {Object} options
 */

var LocalModels = function(options) {
  this.options = options || {};
  this.models = {};
};

/**
 * Adds a model schema to the list of models
 * @public
 * @param {String} name - the name of the model
 * @param {Object} schema - the schema for the model
 * @returns {Object} the schema;
 */
LocalModels.prototype.addModel = function(name, schema) {
  var model = new LocalSchema(name, schema);
  this.models[name] = model;
  return model;
};

/**
 * Returns the schema for the model by name
 * @public
 * @param {String} name - the name of the model
 * @returns {Object} the model schema
 */
LocalModels.prototype.model = function(name) {
  if (!this.models[name]) {
    console.error('The model with name "%s" does not exist.', name);
    return;
  }
  return this.models[name];
};
