/*!
 * LocalModel
 * Developer: Rick Craig
 * https://github.com/RickCraig/localmodel
 */

'use strict';




/**
 * Checks if an object is empty
 * @private
 * @param {Object} obj
 * @returns {Boolean} true if empty
 */
var isEmpty = function(obj) {
  for(var prop in obj) {
    if(obj.hasOwnProperty(prop)) {
      return false;
    }
  }
  return true;
};

/**
 * Checks an array of booleans for a false
 * @private
 * @param {Array} arr - an array of booleans
 * @returns {Boolean} true if contains a false
 */
var containsFalse = function(arr) {
  for (var i = 0; i < arr.length; i++) {
    if (!arr[i]) {
      return true;
    }
  }
  return false;
};

/**
 * Overwrites obj1's values with obj2's and adds obj2's if non existent in obj1
 * @private
 * @param {Object} obj1
 * @param {Object} obj2
 * @returns {Object} obj1 and obj2 merged
 */
function merge(obj1, obj2) {
  var obj3 = {};
  var obj1Keys = Object.keys(obj1);
  var obj2Keys = Object.keys(obj2);
  for (var a = 0; a < obj1Keys.length; a++) {
    obj3[obj1Keys[a]] = obj1[obj1Keys[a]];
  }
  for (var b = 0; b < obj2Keys.length; b++) {
    obj3[obj1Keys[b]] = obj2[obj1Keys[b]];
  }
  return obj3;
}

/**
 * Checks an object or array for LocalDocuments
 * @private
 * @param {Object/Array} check
 * @returns {Boolean} true if it contains a LocalDocument
 */
var containsLocalDocument = function(check) {
  if (check instanceof LocalDocument) {
    return true;
  }

  if (check instanceof Array) {
    for (var i = 0; i < check.length; i++) {
      if (check[i] instanceof LocalDocument) {
        return true;
      }
    }
  }

  return false;
};



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
var addIndex = function(name, newIndex, options) {
  var indexName = name + '-index';
  var indexString = options.storage.getItem(indexName);
  var indices = indexString ? JSON.parse(indexString) : [];
  indices.push(newIndex);
  options.storage.setItem(indexName, JSON.stringify(indices));
};

/**
 * Returns the indices for a model
 * @private
 * @param {String} name - the model name
 * @returns {Array} the indices
 */
var getIndices = function(name, options) {
  var indices = options.storage.getItem(name + '-index');
  return JSON.parse(indices);
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
 * Removes an index from indices
 * @private
 * @param {String} model
 * @param {String} key
 */
var removeIndex = function(model, key, options) {
  var indices = getIndices(model, options);
  var index = indices.indexOf(key);
  if (index > -1) {
    indices.splice(index, 1);
    options.storage.setItem(model + '-index', JSON.stringify(indices));
  } else {
    console.error(new Error('The key "' + key + '" doesn\'t exist'));
  }
};



/**
 * LocalDebug constructor
 */
var LocalDebug = function(options) {
  this.options = options || {};
  this.options.enabled = options.enabled || false;
};

/**
 * Simple logging
 * @private
 */
LocalDebug.prototype.log = function() {
  if (!this.options.enabled) { return; }
  console.log('[LocalModel]', arguments);
};



/* jshint undef:true */

/**
 * Local Document constructor
 * @public
 * @param {Object} data - the entry raw data
 */
var LocalDocument = function(data, schema) {
  this.schema = schema;
  this.data = {};
  this.original = {};
  this.indexKey = getKey(schema.name, data._id);

  // Add ID
  if (data._id) {
    this.original._id = data._id;
    this.data._id = data._id;
  }

  // Try to force the schema type
  var total = schema.keys.length;
  for (var i = 0; i < total; i++) {
    var key = schema.keys[i];
    var property = data[key];

    property = LocalDocument.convert(key, property, schema.schema);

    if (property) {
      this.original[key] = property;
      this.data[key] = property;
    }
  }
};

/**
 * Forces the types
 * @public
 * @param {String} key
 * @param {String/Number} property - the data needing converted
 * @param {Object} schema - the model schema
 * @returns {Object/String/Number} the converted property
 */
LocalDocument.convert = function(key, property, schema) {
  var type;
  if (typeof schema[key] === 'object') {

    // Get the type
    if (!schema[key].type) {
      type = LocalSchema.SchemaTypes.String;
    } else {
      type = schema[key].type;
    }

    // Set the default if it exists
    if (schema[key].default && !property) {
      property = schema[key].default;
    }
  } else {
    type = schema[key];
  }

  if (property && type === LocalSchema.SchemaTypes.Date) {
    property = new Date(property);
  }

  return property;
};

/**
 * Used to save the document when updated
 * @public
 */
LocalDocument.prototype.save = function() {
  // Build the object to save
  var toBeSaved = {};
  var total = this.schema.keys.length;
  for (var i = 0; i < total; i++) {
    var key = this.schema.keys[i];

    // Check this.data[key] doesn't contain a local document,
    // if it does, ignore it, because it's a populate!
    if (!containsLocalDocument(this.data[key])) {
      toBeSaved[key] = this.data[key];
    } else {
      toBeSaved[key] = this.original[key];
    }
  }
  toBeSaved._id = this.data._id;

  var itemKey = getKey(this.schema.name, this.data._id);
  this.schema
    .options
    .storage
    .setItem(itemKey, JSON.stringify(toBeSaved));
};

/**
 * Used to populate a property with the
 * relative entry/entries from another model
 * @public
 * @param {String} names - the referring property names
 * @param {Object} includes - the properties to include
 * from the other model
 * @param {Object} options
 */
LocalDocument.prototype.populate = function(names, includes, options) {
  // http://mongoosejs.com/docs/populate.html
  var split = names.split(' ');

  for (var n = 0; n < split.length; n++) {
    var name = split[n];
    // Check the 'name' has a ref property in the schema
    var ref = this.schema.schema[name].ref;
    if (!ref) {
      console.error('The name ' + name + ' does not have a ref');
      return;
    }

    // Use the ref to get the other model localModel.model(ref)
    var model = this.schema.core.model(ref);

    // default uses the _id as the foreign key
    var query = { _id: this.data[name] };

    // allow the user to set a custom foreign key
    var foreignKey = this.schema.schema[name].foreignKey;
    if (foreignKey) {
      query = {};
      query[foreignKey] = this.data[name];
    }

    if (options && options.match) {
      // Merge the match object with the query object;
      query = merge(options.match, query);
    }

    // Do a find on the model from this name
    var related = model.find(query);

    if (related.length > 0) {

      if (options) {

        // Options:
        // - sorting: like mongoose
        // - limit
        // - match: allows you to add extra query to it,
        // for example, you could show only the relations over 10

        // Sorting: pass a sort function
        if (options.sort && typeof options.sort === 'function') {
          related.sort(options.sort);
        }

        // Set the limit if set
        if (
          options.limit &&
          typeof options.limit === 'number' &&
          related.length > options.limit
        ) {
          related = related.splice(0, options.limit);
        }

      }

      this.data[name] = related.length === 1 ? related[0] : related;
    }
  }

  return this.data;

};

/**
 * Used to wipe this document from memory
 * @public
 */
LocalDocument.prototype.remove = function() {
  // Remove the key from indices
  removeIndex(
    this.schema.name,
    this.indexKey,
    this.schema.options
  );

  // Remove the data from storage
  localStorage.removeItem(this.indexKey);

  // Allow the schema to update
  this.schema.indices = null;
};



/* jshint undef:true */

/**
 * LocalModel constructor
 * @public
 * @param {Object} options
 */
var LocalModel = function(options) {
  if (typeof Storage === 'undefined') {
    console.warn('Storage is not supported in this browser');
  }

  this.options = options || {};
  this.models = {};

  if (!this.options.storage) {
    this.options.storage = localStorage;
  }

  this.options.debug = new LocalDebug({
    enabled: options && options.debug ? true : false
  });
};

/**
 * Adds a model schema to the list of models
 * @public
 * @param {String} name - the name of the model
 * @param {Object} schema - the schema for the model
 * @returns {Object} the schema;
 */
LocalModel.prototype.addModel = function(name, schema) {
  var model = new LocalSchema(name, schema, this, this.options);
  this.models[name] = model;
  return model;
};

/**
 * Returns the schema for the model by name
 * @public
 * @param {String} name - the name of the model
 * @returns {Object} the model schema
 */
LocalModel.prototype.model = function(name) {
  if (!this.models[name]) {
    console.error('The model with name "' + name + '" does not exist.');
    return null;
  }
  return this.models[name];
};



/* jshint undef:true */

/**
 * Local Schema constructor
 * @public
 * @param {Object} schema
 */
var LocalSchema = function(name, schema, core, options) {
  this.schema = schema;
  this.name = name;
  this.options = options;
  this.core = core;
  this.keys = Object.keys(schema);
  this.keys.push('_id');
};

/**
 * Adds a property to the schema
 * @public
 * @param {Object} property
 */
LocalSchema.prototype.addToSchema = function(property) {
  var newKeys = Object.keys(property);
  var total = newKeys.length;
  for (var i = 0; i < total; i++) {
    this.schema[newKeys[i]] = property[newKeys[i]];
  }
  this.keys = Object.keys(this.schema);
  this.keys.push('_id');
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
  var total = this.keys.length;
  for (var i = 0; i < total; i++) {
    var key = this.keys[i];
    var value = data[key];
    if (!value && this.schema[key].default) {
      value = this.schema[key].default;
    }
    newEntry[key] = value;
  }

  // Save to localstorage
  // At some point if there is an index, it can be added the the key for speed
  var index = getKey(this.name, newEntry._id);
  this.options.storage.setItem(index, JSON.stringify(newEntry));
  addIndex(this.name, index, this.options);

  // Clear indices
  this.indices = null;
  return new LocalDocument(newEntry, this);
};

/**
 * Returns all entries in storage
 * @public
 * @returns {Array} all entries
 */
LocalSchema.prototype.all = function() {
  var _this = this;
  this.indices = this.indices || getIndices(this.name, this.options);
  var results = [];

  // Check if the collection is empty
  if (!this.indices) {
    return results;
  }

  var total = this.indices.length;
  for (var i = 0; i < total; i++) {
    var index = this.indices[i];
    results.push(this.options.storage.getItem(index));
  }
  results = JSON.parse('[' + results.join(',') + ']');
  results = results.map(function(result) {
    return new LocalDocument(result, _this);
  });

  return results;
};

/**
 * Find an entry by ID
 * @public
 * @param {String} id
 * @returns {Object} the object or null
 */
LocalSchema.prototype.findById = function(id) {
  this.indices = this.indices || getIndices(this.name, this.options);
  var match = getIndex(this.indices, id);
  if (!match) {
    return null;
  }
  return new LocalDocument(
    JSON.parse(
      this.options.storage.getItem(match)
    ), this);
};


/**
 * Looks through the schema for an entry
 * @private
 * @param {Object} entry - the parsed entry
 * @param {Object} query
 * @returns {Array} an array of matches
 */
LocalSchema.prototype.checkEntry = function(entry, query) {
  var total = this.keys.length;
  var matches = [];

  for (var q = 0; q < total; q++) {
    var key = this.keys[q];
    var queryItem = query[key];
    if (typeof queryItem === 'undefined') {
      continue;
    }

    var isRegex = queryItem instanceof RegExp;
    var checkEmpty = typeof queryItem === 'object' && isEmpty(queryItem);
    if (!isRegex && (queryItem === '' || checkEmpty)) {
      continue;
    }

    if (entry[key]) {
      matches.push(matchQuery(
        LocalDocument.convert(key, entry[key], this.schema),
        queryItem
      ));
    }
  }
  return matches;
};

/**
 * Find entries matching a query
 * @public
 * @param {Object} query
 * @param {Boolean} isCount - return a count when true
 * @returns {Array/Number} an array of matches or
 * a number if isCount = true
 */
LocalSchema.prototype.find = function(query, isCount) {
  this.indices = this.indices || getIndices(this.name, this.options);
  if (!query || isEmpty(query)) {
    return isCount ? this.indices.length : this.all();
  }

  var results = isCount ? 0 : [];

  // Check if the collection is empty
  if (!this.indices) {
    return results;
  }

  for (var i = 0; i < this.indices.length; i++) {
    var entry = this.options.storage.getItem(this.indices[i]);
    var parsed = JSON.parse(entry);
    var matches = this.checkEntry(parsed, query);

    if (matches.length > 0 && !containsFalse(matches)) {
      if (!isCount) {
        results.push(new LocalDocument(parsed, this));
      } else {
        results++;
      }
    }
  }

  this.options.debug.log(results.length + ' results found');

  return results;
};

/**
 * Remove entries utilising the find query
 * @public
 * @param {Object} query
 * @returns {Number} the number of items removed
 */
LocalSchema.prototype.remove = function(query) {
  var entries = this.find(query);

  // Remove each entry individually
  for (var i = 0; i < entries.length; i++ ) {
    entries[i].remove();
  }

  return entries.length;
};

/**
 * Helper to return a count of results
 * @public
 * @param {Object} query
 * @returns {Number} the count of results
 */
LocalSchema.prototype.count = function(query) {
  return this.find(query, true);
};

/**
 * A batch updater
 * @public
 * @param {Object} query - to find entries to update
 * @param {Object} values - the values to update
 * @returns {Number} the number of entries changed
 */
LocalSchema.prototype.update = function(query, values) {
  var entries = this.find(query);
  var totalEntries = entries.length;
  for (var i = 0; i < totalEntries; i++) {
    var entry = entries[i];
    var total = this.keys.length;
    for (var s = 0; s < total; s++) {
      var key = this.keys[s];
      if (typeof values[key] !== 'undefined') {
        entry.data[key] = values[key];
      }
    }
    entry.save();
  }
  return entries.length;
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
  Mixed: 'mixed',
  Date: 'date'
};



/**
 * Handle date
 * @private
 * @param {Object} data
 * @param {Object} query
 * @param {Boolean} isDate
 * @returns {Boolean} true if matched
 */
var handleSums = function(data, query, isDate) {
  var dateMatches = [];

  if (query.$gte) {
    var gte = isDate ? new Date(query.$gte) : query.$gte;
    dateMatches.push(gte <= data);
  }

  if (query.$gt) {
    var gt = isDate ? new Date(query.$gt) : query.$gt;
    dateMatches.push(gt < data);
  }

  if (query.$lte) {
    var lte = isDate ? new Date(query.$lte) : query.$lte;
    dateMatches.push(lte >= data);
  }

  if (query.$lt) {
    var lt = isDate ? new Date(query.$lt) : query.$lt;
    dateMatches.push(lt > data);
  }

  return !containsFalse(dateMatches);
};

/**
 * Handles the object
 * @private
 * @param {Object} data
 * @param {Object} query
 * @returns {Boolean} true if there is a match
 */
var handleQueryObject = function(data, query) {
  // Do the business in here for $gte, $gt, $lte, $lt

  if (typeof data === 'number') {
    return handleSums(data, query);
  }

  if (data instanceof Date) {
    return handleSums(data, query, true);
  }

};

/**
 * Takes in a data string and returns
 * true if query matches
 * @private
 * @param {String} data - the string to match
 * @param {Mixed} query
 * @returns {Boolean} true if the data matches the query
 */
var matchQuery = function(data, query) {

  // Query using regular expression
  if (query instanceof RegExp) {
    return query.test(data);
  }

  // Query using string or number
  if (typeof query === 'string' ||
    typeof query === 'number') {
      return data === query;
    }

  if (typeof query === 'object') {
    return handleQueryObject(data, query);
  }
};
