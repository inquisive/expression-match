var _ = require ('lodash');

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
	
	/* Ensure a new instance has been created.
	 * Calling Wrapper as a function will return a new instance instead.
	 * */
	if (!(this instanceof ExMatch)) {
		return new ExMatch(match, values, debug);
	}
 
	/*If there is not a match object assume true */
	if (!_.isObject(match)) {
		return true;
	}
	/* If not values assume false */
	if (!_.isObject(values)) {
		return false;
	}
	
	this._debug = debug;
	this.debug = ( debug === true && debug !== 2 ) ? true : false;
	this.debugComparison = debug === 2;
	
	/* container for expression comparers */
	this._search = {};
	
	/* default expression will always be $and if not provided */
	this.expression = '$and';
	
	/* save the search fields */
	this.searchFields = values;
	
	/* save the original match */
	this._match = match;
	
	/* loop through the match object and push _search with expression objects
	 * objects not assigned to an expression are added into a single $and expression
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
		
		/* Expression RegEx */
		var RegEx = /^\$[A-Za-z]+$/;
		
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
		
		/* we want to push an object with a key: searchFields value
		 * the object key can be another expression which will be formed	
		 * */
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
				var isObject = ( !_.isRegExp(obj[key]) && _.isObject(obj[key]) );
				var newObj = ( isObject ) ? obj[key] : {};
				
				if(!_.isObject(newObj[newKey])) {
					
					if(this.debug) console.log(key,newKey,newObj,parentKey,obj[key],'is Object: '+isObject,'isRegExp:'+_.isRegExp(obj[key]),'new isObject:'+_.isObject(newObj[newKey]));
					
					/* this is a string or number 
					 * switch up the parent key and the expression
					 * and wrap it in an Array
					 * */
					var pushIt = {};
					pushIt[isObject ? key : parentKey] = isObject ? obj[key][newKey] : obj[newKey];
					if(pushIt[isObject ? key : parentKey] === undefined) {
						if(this.debug) console.log(this.expression, 'failed to create new ExMatch Instance');
						return;
					}
					var newObj = {}
					newObj[newKey] = [];
					newObj[newKey].push(pushIt);
					
					if(this.debug) console.log(this.expression,'new match', newObj,key,obj);
				}
				
				this._search[exp].search.push({'$match':new ExMatch(newObj,this.searchFields,this._debug)});
				
				
			} else {
				/*  push onto the search array */
				this._search[exp].search.push(obj);
			}
		}.bind(this);
		
		
		/* loop thorugh the root keys and create the _search list for the comparer */
		_.each(match,function(val,key) {
			
			var exp = this.isExp(key);

			/* check for an expression */
			if(!exp) exp = '$and';
			
			/* set the search object */
			if(!this._search[exp]) {
				this._search[exp] = {
					search:[],
					exp: exp
				}
			} else {
				this._search[exp].exp = exp;
			}
			
			/* we accept arrays for expressions so loop through and add each object to the routine */
			if(_.isArray(val) && this.isExp(key)) {
				
				if(this.debug) console.log(key + ' val isArray so loop');
				
				_.each(val,function(obj) {
					if(!_.isObject(obj)) {
						/* this is a string in an Array so we assume it is a field name that should be boolean true */
						var ret = {};
						ret[obj] = true;
						obj = ret;
					}
					if(this.debug) console.log('push from ' + key + ' Array',obj);
					pushVal(exp,obj,key);
					
				}, this);
				
			} else if(_.isArray(val) || !_.isObject(val)) {
				
				/* we can accept plain objects which are now just a value so wrap it back up */
				var retObj = {}
				retObj[key] = val;
				pushVal(exp,retObj,key);
				if(this.debug) console.log('push plain value',retObj);
				
			} else if(val) {
				if(this.debug) console.log('push object',val);
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
	
		/* If we dont have a _search object  are we still true?  since we did naything false? */
		if(!_.isObject(this._search))return true;
		if(!this.searchFields)return false;
		
		/* loop the _search object and run all the requested searches */
		var ret = _.every(this._search,function(val) {		
			
			if(!_.isArray(val.search) || val.search.length < 1)return true;
			
			if(val.exp === false || !_.isFunction(this[val.exp]) )return true;
			
			return this[val.exp]()
			
		}, this);
		
		if(this.debug || this.debugComparison) console.log(_.keys(this._match) + ' final return = ' + ret);
		
		return ret;
		
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
		
		/* we pass this as reference the entire chain so save our originals */
			this._current = {
				searchFields: this.searchFields,
				exp: this.expression,
				$comparer: search.$comparer
			}; 
		
		/* if we have a custom selector run it
		 * the custome selector should expect the pattern array
		 *  */
		if(_.isFunction(search.$selector)) {
			
			var ret = search.$selector.call(this,search.search);
		
		} else {
			
			var ret = fn(search.search,function(val) {
				
				/* run the proper method and return */
				var ret2 =  fn(val, this.comparer, this);
				if(this.debug) console.log(search.exp, 'fn selector', search.search, ret2);
				return ret2;
				
			}, this);
			
		}
		if(this.debug) console.log(search.exp,'return selector',ret);
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
				
		if(key === '$match') {
			/* $match keys contain a new ExMatch instance so run match */
			if(this.debug) console.log(this._current.exp,'run ExMatch instance match()');
			return val.match();
			
		} else {
			
			if(this.searchFields[key] === undefined) {
				if(this.debug || this.debugComparison) console.info(this._current.exp.toUpperCase() + ' SKIP COMPARE: searchFields['+key+'] = ', this.searchFields[key], val);
				return false;
			}
			
			/* see if the value matches 
			 * if we have a custom comparer run it
			 * the custom comparer should excpect the test against variable first and test for variable second
			 *  */
			if(_.isFunction(this._current.$comparer)) {
				
				if(this.debug) console.log(this._current.exp + ' custom comparer used');
				var ret = this._current.$comparer.call(this,this.searchFields[key],val);
			
			} else {
				/* we want an Array of objects */	
				var matches = _.isArray(val) ? val : [val];
				var ret = _.contains(matches, this.searchFields[key]);
			}
			
			if(this.debug || this.debugComparison) console.log(this._current.exp.toUpperCase() + ' COMPARE: ' + ret.toString().toUpperCase(), ' compared ' + val, ' with ',  this.searchFields[key], ' from ',  key);
			return ret;
		}	
	},
	
	/**
	 * add patterns to expresion search
	 * @param  {object} can contain any search patterns
	 * return boolean
	 */
	and: function(pattern) {
		if(!_.isObject(pattern)) return false;
		this.setSearchParams({$and: pattern});
		return this;
	},
	or: function(pattern) {
		if(!_.isObject(pattern)) return false;
		this.setSearchParams({$or: pattern});
		return this;
	},
	not: function(pattern) {
		if(!_.isObject(pattern)) return false;
		this.setSearchParams({$not: pattern});
		return this;
	},
	eq: function(pattern) {
		if(!_.isObject(pattern)) return false;
		this.setSearchParams({$eq: pattern});
		return this;
	},
	lt: function(pattern) {
		if(!_.isObject(pattern)) return false;
		this.setSearchParams({$lt: pattern});
		return this;
	},
	lte: function(pattern) {
		if(!_.isObject(pattern)) return false;
		this.setSearchParams({$lte: pattern});
		return this;
	},
	gt: function(pattern) {
		if(!_.isObject(pattern)) return false;
		this.setSearchParams({$gt: pattern});
		return this;
	},
	gte: function(pattern) {
		if(!_.isObject(pattern)) return false;
		this.setSearchParams({$gte: pattern});
		return this;
	},
	regex: function(pattern) {
		if(!_.isObject(pattern)) return false;
		this.setSearchParams({$regex: pattern});
		return this;
	},
	
	/* START EXPRESSION METHODS */
	/**
	 * base comparison method
	 * @param  {function} comparer function
	 * @param  {function} selector function
	 * return boolean
	 */
	$base: function (exp, fn, selector, comparer) {
				
			var exp = this._search[exp];
			
			this.expression = exp.exp;
			
			if(!exp || exp.length < 1)return true;
			
			if(!fn) fn = _.every;
						
			if(!_.isFunction(exp.$comparer)) {
				if(comparer) exp.$comparer = comparer;
			}
			
			if(!_.isFunction(exp.$selector)) {
				if(selector) exp.$selector = selector;
			}
			
			/* run the selector */
			var sel = this.selector(fn, exp, this.searchFields);
			
			return sel;
		
	},
		
	/**
	 * Expression comparers
	 * provide a loop function if not _.every
	 * @param  {string} expression
	 * @param  {function} loop true/false function
	 * @param  {function} selector function
	 * @param  {function} comparer function
	 * return boolean
	 */
	/* greater than */
	$gt: function() {
			if(!_.isObject(this._search.$gt)) {
				if(this.debug) console.log('Tried to run gt without $gt object set');
				return false;
			}
			var comparer = function(a,b){
				return Number(a) >  Number(b);
			};
			
			return this.$base.call(this,"$gt",_.every,false,comparer);
	},
	/* greater than or equal*/
	$gte: function() {
			
			if(!_.isObject(this._search.$gte)) {
				if(this.debug) console.log('Tried to run gte without $gte object set');
				return false;
			}
			var comparer = function(a,b){
				return Number(a) >= Number(b);
			};
			
			return this.$base.call(this,"$gte",_.every,false,comparer);
	},
	/* less than */
	$lt: function() {
			if(!_.isObject(this._search.$lt)) {
				if(this.debug) console.log('Tried to run lt without $lt object set');
				return false;
			}
			var comparer = function(a,b){
				return Number(a) <  Number(b);
			};
			
			return this.$base.call(this,"$lt",_.every,false,comparer);
	},
	/* less than or equal */
	$lte: function() {
			if(!_.isObject(this._search.$lte)) {
				if(this.debug) console.log('Tried to run lte without $lte object set');
				return false;
			}
			var comparer = function(a,b){
				return Number(a) <=  Number(b);
			};
			
			return this.$base.call(this,"$lte",_.every,false,comparer);
	},
	/* or */
	$or: function() {
			if(!_.isObject(this._search.$or)) {
				if(this.debug) console.log('Tried to run or without $or object set');
				return false;
			}
			
			return this.$base.call(this,"$or",_.some);
	},
	/* and */
	$and: function() {
			if(!_.isObject(this._search.$and)) {
				if(this.debug) console.log('Tried to run and without $and object set');
				return false;
			}
			
			return this.$base.call(this,"$and");
	},
	/* not */
	$not: function() {
			if(!_.isObject(this._search.$not)) {
				if(this.debug) console.log('Tried to run not without $and object set');
				return false;
			}
			var comparer = function(a,b){
				var ret = _.contains(b, a);
				return !ret;
			};
			return this.$base.call(this,"$not",_.every,false,comparer);
	},
	/* not */
	$eq: function() {
			if(!_.isObject(this._search.$eq)) {
				if(this.debug) console.log('Tried to run not without $and object set');
				return false;
			}
			var comparer = function(a,b){
				var ret = ( a == b );
				return ret;
			};
			return this.$base.call(this,"$eq",_.every,false,comparer);
	},
	/* regex */
	$regex: function() {
			if(!_.isObject(this._search.$regex)) {
				if(this.debug) console.log('Tried to run not without $regex object set');
				return false;
			}
			function prepareRegExpString(string){
				var obj = {};
				var params = string.substr(string.lastIndexOf('/')+1);
				obj.params = params.search("g") ? params : '';
				obj.regex = string.substring(( string.indexOf('/') === 0 ) ? 1 : 0,string.lastIndexOf('/'));
				if(this.debug)console.log('$regex prepare',obj);
				return obj;
			};
			var comparer = function(a,b){
				if(_.isRegExp(b)) {
					return b.test(a);
				} else {
					var regex = prepareRegExpString.call(this,b);
					return new RegExp(regex.regex,regex.params).test(a);
				}
			};
			return this.$base.call(this,"$regex",_.every,false,comparer);
	}		
	
});
