var _ = require ('underscore');

/* Expression RegEx */
var RegEx = /^\$[A-Za-z]+$/;

/**
 * Calling the module directly returns a new ExMatch instance
 * 
 * @param  {Function} fn
 * @return {Wrapper}
 */
exports = module.exports = function(match, values, debug) {
	return new ExMatch(match, values, debug);
};

/**
 * ExMatch Class
 * 
 * @param {object} match
 * @param {object} values
 * @param {boolean} debug
 */
var ExMatch = exports.ExMatch = function ExMatch(match, values, debug) {
	
	// Ensure a new instance has been created.
	// Calling Wrapper as a function will return a new instance instead.
	if (!(this instanceof ExMatch)) {
		return new ExMatch(match, values, debug);
	}
 
	// If not a match assume true
	if (!_.isObject(match)) {
		return true;
	}
	// If not values assume false
	if (!_.isObject(values)) {
		return false;
	}
	
	this.debug = debug || false;
	
	// container for expression comparers
	this._search = {};
	
	this.expression = '$and';
	
	/* save the search fields */
	this.searchFields = values;
	
	/* loop through the match object and push _search with expression objects
	 * plain objects are added into a single and expression
	 * */
	this.setSearchParams(match);
	
	//if(debug) console.log('_search Array', this._search, 'search field:value ', this.searchFields);
	
	return this;

};

_.extend(ExMatch.prototype, {
	
	/**
	 * check if value is an Expression
	 * @param  {string} value
	 * return expression or false
	 */
	isExp: function(key) {
	
		if(!_.isString(key))return false;
		
		/* match single word beginning with $ */
		var ret = key.match(RegEx);
		
		return  _.isObject(ret)  ? ret[0] : false;	
	},
	
	/**
	 * set the _search object contents with required search patterns
	 * @param  {object} object of comparison key:value pairs
	 * return this
	 */
	setSearchParams: function(match) {
	
		/* If we dont have an object  are we still true since we did naything false? */
		if(!_.isObject(match))return true;
		
		// we want to push an object with a key: searchFields value
		// the object key can be another expression which will be formed	
		var pushVal = function(exp,obj,parentKey) {
			
			var key = _.keys(obj)[0];

			/* Still working on the $selector and $comparer  */
			if(key === '$selector') {
				this._search[exp].$selector = obj.$selector;
				
			} else if(key === '$comparer') {
				this._search[exp].$comparer = obj.$comparer;
				
			} else if( (this.isExp(key)) || (_.isObject(obj[key]) && this.isExp(_.keys(obj[key])[0])) ) {
				
				/* this is a new expression so we will create an object with a $match key
				 * and place a new MatchEx instance as the value
				 * */
				var newKey = this.isExp(key) ? key : _.keys(obj[key])[0];		
				var newObj = _.isObject(obj[key]) ? obj[key] : {};
				if(!_.isObject(newObj[newKey])) {
					/* this is a string or number 
					 * switch up the parent key and the expression
					 * and wrap it in an Array
					 * */
					var pushIt = {};
					pushIt[_.isObject(obj[key]) ? key : parentKey] = _.isObject(obj[key]) ? obj[key][newKey] : obj[newKey];
					var newObj = {}
					newObj[newKey] = [];
					newObj[newKey].push(pushIt);
					if(this.debug) console.log(this.expression,'new match', newObj,key,obj);
				}
				this._search[exp].search.push({'$match':new ExMatch(newObj,this.searchFields,this.debug)});
				
			} else {
				/*  push onto the search array */
				this._search[exp].search.push(obj);
			}
		}.bind(this);
		
		
		/* loop thorugh the root keys and create the _search list for the comparer */
		_.each(match,function(val,key) {
			
			var exp = this.isExp(key);

			// check for an expression
			if(!exp) exp = '$and';
			
			this.expression = exp;
			
			// set the search object
			if(!this._search[exp]) {
				this._search[exp] = {
					search:[],
					exp: exp
				}
			} else {
				this._search[exp].exp = exp;
			}
			/* we accept arrays so loop through and add each object to the routine */
			if(_.isArray(val)) {
				if(this.debug) console.log('val isArray so loop',val);
				_.each(val,function(obj) {
					if(!_.isObject(obj)) {
						/* this is a string in an Array so we assume it is a field name that should be boolean true */
						var ret = {};
						ret[obj] = true;
						obj = ret;
					}
					
					pushVal(exp,obj);
					
				}, this);
				
			} else if(!_.isObject(val)) {
				/* we can accept plain objects so wrap it back up */
				var retObj = {}
				retObj[key] = val;
				pushVal(exp,retObj,key);
				if(this.debug) console.log('push non object',retObj);
				
			} else if(val) {
				if(this.debug) console.log('push val',val);
				pushVal(exp,val,key);
			}
			
			return this;
		}, this);
		
		return this;
	},
	
	/**
	 * match gives you the result of an ExMatch instance
	 * return boolean
	 */
	
	match: function() {
	
		/* If we dont have a _search object  are we still true since we did naything false? */
		if(!this.expression || this.expression.charAt(0) !== '$')return true;
		if(!_.isObject(this._search))return true;
		if(!this.searchFields)return false;
		
		/* loop the _search object and run all the requested searches */
		return _.every(this._search,function(val) {		
			return val.exp !== false ? this[val.exp]() : false;
		}, this);
	},
	
	/**
	 * DEFAULT
	 * selector runs the selected true/false group return comparison method
	 * eg: _.every or _.some
	 * @param  {function} group comparison method
	 * @param  {object} the search pattern object
	 * 				exp: name of the expression
	  *				search: array of objects, and may contain new expression searches
	  *				$selector: selector function (current)
	  *				$comparer: comparer function
	 * @param  {object} field:value object to test against
	 * return boolean
	 */
	 
	 selector: function(fn,search,searchFields){
		var ret = fn(search.search,function(val) {
			
			/* we pass this as reference the entire chain so save our originals */
			this.searchFields = searchFields;
			this.search = val;
			/* run the proper method and return*/
			var ret2 =  fn(val, search.$comparer, this);
			if(this.debug) console.log(this.expression, 'fn selector', search.search, ret2);
			return ret2;
			
		}, this);
		
		if(this.debug) console.log(this.expression,'return selector',ret);
		return ret;
	},
	
	
	/**
	 * DEFAULT
	 * comparer runs the final true/false group comparison method as a callback of the selector method during iteration
	 * @param  {mixed} each value of iteration - object or array
	 * @param  {string} key
	 * return boolean
	 */
	
	comparer: function(val,key) {
	
		/* we want an Array of objects */	
		var matches = _.isArray(val) ? val : [val];
		if(this.debug) console.info('COMPARE: does ', matches, ' contain "',  this.searchFields[key], '" from ',  key, _.contains(matches, this.searchFields[key]));
		
		if(key === '$match') {
			/* $match keys contain a new ExMatch instance so run match */
			if(this.debug) console.log(this.expression,'run ExMatch instance match()');
			return val.match();
		} else {
			/* see if the value matches */
			var ret = _.find(matches, function(val) { 
				/* set true and false since our values are strings */
				if(val === true) val = 'true';
				
				if(!val || val === false) return this.searchFields[key] != 'true';
				if(val) return val == this.searchFields[key];
				return false;
				
			}.bind(this), this);
			//if(this.debug) console.log(this.expression,'return compare',ret);
			return ret;
		}
			
	},
	
	
	/* START EXPRESSION METHODS */
		
	/**
	 * greater than
	 * provide a custom comparer if one is not already set
	 * @param  {function} comparer function
	 * @param  {function} selector function
	 * return boolean
	 */
	
	$gt: function(comparer,selector) {
	
		var exp = this._search.$gt;
		
		var $selector = (_.isFunction(exp.$selector)) ? exp.$selector : selector;
		var $comparer = (_.isFunction(exp.$comparer)) ? exp.$comparer : comparer;
		
		if(!_.isFunction($comparer)) {
			exp.$comparer = function(val,key){
				return Number(this.searchFields[key]) > Number(val);
			}.bind(this);
		}
		
		if(!_.isFunction($selector)) {
			exp.$selector = this.selector;
		}
		
		var sel = exp.$selector.call(this, _.every, exp, this.searchFields);
		
		if(this.debug) console.log(this.expression,'gt return',sel);
		
		return sel;
	},
	
	/**
	 * greater than or equal to
	 * provide a custom comparer if one is not already set
	 * @param  {function} comparer function
	 * @param  {function} selector function
	 * return boolean
	 */
	
	$gte: function(comparer,selector) {
	
		var exp = this._search.$gte;
		
		var $selector = (_.isFunction(exp.$selector)) ? exp.$selector : selector;
		var $comparer = (_.isFunction(exp.$comparer)) ? exp.$comparer : comparer;
		
		if(!_.isFunction($comparer)) {
			exp.$comparer = function(val,key){
				return Number(this.searchFields[key]) >= Number(val);
			}.bind(this);
		}
		
		if(!_.isFunction($selector)) {
			exp.$selector = this.selector;
		}
		
		var sel = exp.$selector.call(this, _.every, exp, this.searchFields);
		
		if(this.debug) console.log(this.expression,'gte return',sel);
		
		return sel;
	},
	
	/**
	 * less than
	 * provide a custom comparer if one is not already set
	 * @param  {function} comparer function
	 * @param  {function} selector function
	 * return boolean
	 */
	
	$lt: function(comparer,selector) {
	
		var exp = this._search.$lt;
		
		var $selector = (_.isFunction(exp.$selector)) ? exp.$selector : selector;
		var $comparer = (_.isFunction(exp.$comparer)) ? exp.$comparer : comparer;
		
		if(!_.isFunction($comparer)) {
			exp.$comparer = function(val,key){
				return Number(this.searchFields[key]) <  Number(val);
			}.bind(this);
		}
		
		if(!_.isFunction($selector)) {
			exp.$selector = this.selector;
		}
		
		var sel = exp.$selector.call(this, _.every, exp, this.searchFields);
		
		if(this.debug) console.log(this.expression,'lt return',sel);
		
		return sel;
	},
	
	/**
	 * less than or equal to
	 * provide a custom comparer if one is not already set
	 * @param  {function} comparer function
	 * @param  {function} selector function
	 * return boolean
	 */
	
	$lte: function(comparer,selector) {
	
		var exp = this._search.$lte;
		
		var $selector = (_.isFunction(exp.$selector)) ? exp.$selector : selector;
		var $comparer = (_.isFunction(exp.$comparer)) ? exp.$comparer : comparer;
		
		if(!_.isFunction($comparer)) {
			exp.$comparer = function(val,key){
				if(this.debug) console.log('$lte', Number(this.searchFields[key]), Number(val));
				return Number(this.searchFields[key])  <=  Number(val);
			}.bind(this);
		}
		
		if(!_.isFunction($selector)) {
			exp.$selector = this.selector;
		}
		
		var sel = exp.$selector.call(this, _.every, exp, this.searchFields);
		
		if(this.debug) console.log(this.expression,'lte return',sel);
		
		return sel;
	},
	
	/**
	 * and - all must be true
	 * @param  {function} comparer function
	 * @param  {function} selector function
	 * return boolean
	 */
	
	$and: function(comparer,selector) {
	
		var exp = this._search.$and;
		
		var $selector = (_.isFunction(exp.$selector)) ? exp.$selector : selector;
		var $comparer = (_.isFunction(exp.$comparer)) ? exp.$comparer : comparer;
		
		if(!_.isFunction($comparer)) {
			exp.$comparer = this.comparer;
		}
		
		if(!_.isFunction($selector)) {
			exp.$selector = this.selector;
		}
		
		var sel = exp.$selector.call(this, _.every, exp, this.searchFields);
		
		if(this.debug) console.log(this.expression,'and return',sel);
		
		return sel;
	},
	
	/**
	 * or - one must be true
	 * @param  {function} comparer function
	 * @param  {function} selector function
	 * return boolean
	 */
	
	$or: function(comparer,selector) {
	
		var exp = this._search.$or;
		
		var $selector = (_.isFunction(exp.$selector)) ? exp.$selector : selector;
		var $comparer = (_.isFunction(exp.$comparer)) ? exp.$comparer : comparer;
		
		if(!_.isFunction($comparer)) {
			exp.$comparer = this.comparer;
		}
		
		if(!_.isFunction($selector)) {
			exp.$selector = this.selector;
		}
		
		var sel = exp.$selector.call(this, _.some, exp, this.searchFields);
		
		if(this.debug) console.log(this.expression,'or return',sel);
		
		return sel;
	},
	
	/**
	 * I need a base to clean some code up
	 * @param  {function} comparer function
	 * @param  {function} selector function
	 * return boolean
	 */
	
	$base: function $base(exp) {
	
		return function(comparer,selector) {
			
			var exp = this._search[exp];
			var $selector = (_.isFunction(exp.$selector)) ? exp.$selector : selector;
			var $comparer = (_.isFunction(exp.$comparer)) ? exp.$comparer : comparer;
			
			if(!_.isFunction($comparer)) {
				exp.$comparer = this.comparer;
			}
			
			if(!_.isFunction($selector)) {
				exp.$selector = this.selector;
			}
			
			var sel = exp.$selector.call(this, _.every, exp, this.searchFields);
			
			if(this.debug) console.log(this.expression,'or return',sel);
			
			return sel;
		}
	},
	
});
