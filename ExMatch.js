var _ = require ('lodash');

var expressions = [
	'and',
	'or',
	'any',
	'not',
	'eq',
	'ne',
	'lt',
	'gt',
	'lte',
	'gte',
	'regex',
	'truthy', // in development
	'falsey', // in development
	'falsy' // in development
];

/**
 * Calling the module directly returns a new ExMatch instance
 * 
 * @param  {Function} fn
 * @return {Wrapper}
 */
exports = module.exports = function(match, values, opts) {
	return new ExMatch(match, values, opts);
};

/**
 * ExMatch Class
 * 
 * @param {object} match
 * @param {object} values
 * @param {boolean} debug
 */
var ExMatch = exports.ExMatch = function ExMatch(match, values, opts) {
	
	/* Ensure a new instance has been created.
	 * Calling Wrapper as a function will return a new instance instead.
	 * */
	if (!(this instanceof ExMatch)) {
		return new ExMatch(match, values, opts);
	}
 
	/*If there is not a match object assume true */
	if (!_.isObject(match)) {
		return true;
	}
	/* If no values assume false */
	if (!_.isObject(values)) {
		return false;
	}
	
	/* defaults */
	var _defaults =  { 
		expression: '$and',
		debug: false
	}
	
	var options = {};
	/* user defaults */
	if (!_.isObject(opts) ) {
		if(opts) {
			options.debug = opts;
		}
	} else {
		options = opts;
	}
	
	this.defaults =  _.defaults( _defaults, options);
	
	/* debug choice */
	this._debug = this.defaults.debug;
	this.debug = ( this.defaults.debug === true && this.defaults.debug !== 2 ) ? true : false;
	this.debugComparison = this.defaults.debug === 2;

	/* allowed expressions */
	this.expressions = expressions;
	
	/* container for expression comparers */
	this._search = {};

	/* default expression will always be $and if not provided */
	this.expression = this.defaults.expression;
	
	/* save the search fields */
	this.searchFields = values;
	
	/* save the original match */
	this._match = match;
	
	/* loop through the match object and push _search with expression objects
	 * objects not assigned to an expression are added into a single $and expression
	 * */
	this.setSearchParams(match);
		
	return this;

};
 
/* add public search methods to prototype */
expressionMethods(expressions);

_.extend(ExMatch.prototype, {
	/**
	 * check if value is an Expression
	 * @param  {string} value
	 * return expression or false
	 */
	isExp: function(key) {
	
		if(!_.isString(key)) {
			return false;
		}	
		
		var allowed = this.expressions;	
		
		if(key[0] === '$') {
			key = key.substr(1);
		}
		
		return  ( allowed.indexOf(key) > -1 )  ? '$' + key : false;	
		
	},
	
	/**
	 * set the _search object contents with required search patterns
	 * @param  {object} object of comparison key:value pairs
	 * return this
	 */
	setSearchParams: function(match) {
	
		if (!_.isObject(match)) {
			return true;
		}
		
		var reWrap = function(key,obj) {
			// the first key in the set will be the new object key
			var newKey = _.keys(obj)[0];
			var pushIt = {};
			pushIt[key] = obj[newKey];
			
			if (!newKey || newKey == key || pushIt[key] === undefined) {
				if(this.debug) {
					console.log('failed to wrap ', key, obj, newKey);
				}
				return;
			}
			
			// wrap it up
			var finalObj = {}
			finalObj[newKey] = pushIt;
			if(this.debug) {
				console.log(obj, 'rewrapped to ', finalObj);
			}
			return finalObj;
		}
		var pushVal = function(exp,obj,parentKey) {
			/* 
			*  We get an object that can contain an expression as the first key	
			* */
			var key = _.keys(obj)[0];
			
			/* is the first item an object */
			var isObject = _.isObject(obj[key]);
			/* maybe an array */
			var isArray = _.isArray(obj[key]);
			/* could be a simple array on a value key */
			//var isArrayOnPlain = ( isArray && !this.isExp(parentKey)) ? true : false;
			var isArrayOnPlain = ( isArray ) ? true : false;
			/* if an object get the first key to check for an expression */
			var innerKey = ( isObject ) ? _.keys(obj[key])[0] : false
			/* contents of the search object */
			var innerObject = ( innerKey ) ? obj[key][innerKey] : false;
			
			if (this.debug) {
				console.log('check for $comparer', key, exp, obj);
			}
			/* Still working on the $selector and $comparer  */
			if (key === '$selector') {
				this._search[exp].$selector = obj.$selector;
				
			} else if (key === '$comparer') {
				this._search[exp].$comparer = obj.$comparer;
				
			} else if ( isArrayOnPlain && !this.isExp(parentKey) ) {
				/* 
				 * simple value comparison of an array
				 * the default is to wrap it in an $and search which checks for all values in an array
				 * to check for one of the values the default should be set to $or
				 *  
				 * */
				if (this.debug) {
					console.log(exp,'Array inside plain, wrap each as ' + exp, obj[key], key, innerKey,  innerObject);
				}
								
				obj[key].forEach(function(rewrite) {
					var newObj = {};
					newObj[key] = rewrite;
					if (this.debug) {
						console.log('push ' + exp, newObj);
					}
					this._search[exp].search.push(newObj);
				}.bind(this));
				
				
			} else if ( this.isExp(key) ) {
				/* top level expression so create a new match */
				if (this.debug) {
					console.log(exp,'new top expression:', key,  obj);
				}
				if ( !isObject ) {
					var obj = reWrap.call(this,parentKey,obj);
				}
				this._search[exp].search.push({'$match':new ExMatch(obj,this.searchFields,this._debug)});
				
			} else if(this.isExp(innerKey) ) {
				/* comparison inside a value key 
				 * invert the keys
				 * */
				var newObj = reWrap.call(this,key,obj[key]);				 
				
				if (this.debug) console.log(exp,'new expression inside:', key,  newObj);
		
				this._search[exp].search.push({'$match':new ExMatch(newObj,this.searchFields,this._debug)});
			
			} else if ( isArrayOnPlain && this.isExp(parentKey) ) {
				/* 
				 * simple value comparison of an array
				 * the default is to wrap it in an $and search which checks for all values in an array
				 * to check for one of the values the default should be set to $or
				 *  
				 * */
				var pExp = this.isExp(parentKey);
				 
				if (this.debug) {
					console.log(parentKey,'Array inside plain, wrap each as ' + pExp, obj[key], key, exp,  innerObject, innerKey);
				}
								
				obj[key].forEach(function(rewrite) {
					var newObj = {};
					newObj[key] = rewrite;
					if (this.debug) {
						console.log('push ' + pExp, newObj);
					}
					this._search[pExp].search.push(newObj);
				}.bind(this));
				
				
			} else {
				/*  regular item push onto the search array */
				if (this.debug) console.log(exp,'add match', key,  obj);
				this._search[exp].search.push(obj);
			}
		}.bind(this);
		
		if (this.debug) {
			console.log('match', match);
		}
		/* loop thorugh the root keys and create the _search list for the comparer */
		_.each(match,function(val,key) {
			
			if (this.debug) console.log('match value expression',key,this.isExp(key))
			
			var exp = this.isExp(key);

			/* check for an expression */
			if (!exp) exp = this.defaults.expression;
			
			/* set the search object */
			if (!this._search[exp]) {
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
				//return pushVal(exp,val,key);
								
				_.each(val,function(obj) {
					if (!_.isObject(obj)) {
						/* this is a string in an Array so we assume it is a field name that should be boolean true */
						var ret = {};
						ret[obj] = true;
						obj = ret;
					}
					if (this.debug) console.log('push from ' + key + ' Array', obj);
					pushVal(exp,obj,key);
					
				}, this);
				
			} else if(_.isArray(val) || !_.isObject(val)) {
				
				/* we can accept plain objects which are now just a value so wrap it back up */
				var retObj = {}
				retObj[key] = val;
				if(this.debug) console.log('push plain value',retObj);
				pushVal(exp,retObj,key);
				
			} else if(_.isObject(val)) {
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
		if(!_.isObject(this._search)) {
			return true;
		}
		if(!this.searchFields) {
			return false;
		}		
		/* loop the _search object and run all the requested searches */
		var ret = _.every(this._search,function(val) {		
			
			if(!_.isArray(val.search) || val.search.length < 1) {
				if(this.debug || this.debugComparison) console.log('val.search is array.. return true', val.search, val);
				return true;
			}			
			if(val.exp === false || !_.isFunction(this[val.exp]) ) {
				return true;
			}
			
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
	  *				$selector: selector function(current)
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
		if (_.isFunction(search.$selector)) {
			
			var ret = search.$selector.call(this,search.search);
		
		} else {
			
			var ret = fn (search.search,function(val) {
				
				/* run the proper method and return */
				var ret2 =  fn (val, this.comparer, this);
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
			if (this.debug) console.log(this._current.exp,'run ExMatch instance match()');
			return val.match();
			
		} else {
			
			if (this.searchFields[key] === undefined) {
				if(this.debug || this.debugComparison) console.info(this._current.exp.toUpperCase() + ' SKIP COMPARE: searchFields['+key+'] = ', this.searchFields[key], val, key);
				return false;
			}
			
			/* see if the value matches 
			 * if we have a custom comparer run it
			 * the custom comparer should expect the test against variable first, then the test for variable second
			 *  */
			if (_.isFunction(this._current.$comparer)) {
				
				if(this.debug) console.log(this._current.exp + ' custom comparer used');
				//var matches = ensureArray(val);
				var ret = this._current.$comparer.call(this,this.searchFields[key], val);
			
			} else {
				/* we want an Array of objects */	
				var matches = ensureArray(val);
				var ret = _.contains(matches, this.searchFields[key]);
			}
			
			if(this.debug || this.debugComparison) console.log(this._current.exp.toUpperCase() + ' COMPARE: ' + ret.toString().toUpperCase(), ' compared ' + val, ' with ',  this.searchFields[key], ' from ',  key);
			return ret;
		}	
	},
	reset: function(exp) {
		if (exp) {
			if (_.isObject(this._search[exp])) {
				this._search[exp] = {};
			}
		} else {
			this._search = {};
			this.expression = this.get('expression');
			this.searchFields = {};
			this._match = {};
			this._current = {};
			this.debug = false;
			this._debug = false;
			this.debugComparison = false;
		}
	},
	
	/* START EXPRESSION METHODS */
	/**
	 * base comparison method
	 * @param  {function} comparer function
	 * @param  {function} selector function
	 * return boolean
	 */
	$base: function(exp, fn, selector, comparer) {
				
			var exp = this._search[exp];
			
			this.expression = exp.exp;
			
			if (!exp || exp.length < 1) {
				return true;
			}
			if (!fn) {
				// default $and
				fn = _.every;
			}		
			if (!_.isFunction(exp.$comparer)) {
				if(comparer) exp.$comparer = comparer;
			}
			
			if (!_.isFunction(exp.$selector)) {
				if(selector) exp.$selector = selector;
			}
			
			/* run the selector */
			var sel = this.selector(fn, exp, this.searchFields);
			
			return sel;
		
	},
		
	/**
	 * Expression comparers
	 * provide a iteration function if not _.every
	 * @param  {string} expression
	 * @param  {function} loop true/false function
	 * @param  {function} selector function
	 * @param  {function} comparer function
	 * return boolean
	 */
	/* greater than */
	$gt: function() {
			if (!_.isObject(this._search.$gt)) {
				if(this.debug) console.log('Tried to run gt without $gt object set');
				return false;
			}
			var comparer = function(a,b) {
				b = ensureArray(b);
				var ret = _.every(b,function(v) {
					return Number(a) > Number(v);
				});
				
				return ret;
			};
			
			return this.$base.call(this,"$gt",_.every,false,comparer);
	},
	/* greater than or equal*/
	$gte: function() {
			
			if (!_.isObject(this._search.$gte)) {
				if(this.debug) console.log('Tried to run gte without $gte object set');
				return false;
			}
			var comparer = function(a,b) {
				b = ensureArray(b);
				var ret = _.every(b,function(v) {
					return Number(a) >= Number(v);
				});
				
				return ret;
			};
			
			return this.$base.call(this,"$gte",_.every,false,comparer);
	},
	/* less than */
	$lt: function() {
			if (!_.isObject(this._search.$lt)) {
				if(this.debug) console.log('Tried to run lt without $lt object set');
				return false;
			}
			var comparer = function(a,b) {
				b = ensureArray(b);
				var ret = _.every(b,function(v) {
					return Number(a) < Number(v);
				});
				
				return ret;
			};
			
			return this.$base.call(this,"$lt",_.every,false,comparer);
	},
	/* less than or equal */
	$lte: function() {
			if (!_.isObject(this._search.$lte)) {
				if(this.debug) console.log('Tried to run lte without $lte object set');
				return false;
			}
			var comparer = function(a,b) {
				b = ensureArray(b);
				var ret = _.every(b,function(v) {
					return Number(a) <= Number(v);
				});
				
				return ret;
			};
			
			return this.$base.call(this,"$lte",_.every,false,comparer);
	},
	/* or */
	$or: function() {
			if (!_.isObject(this._search.$or)) {
				if(this.debug) console.log('Tried to run or without $or object set');
				return false;
			}
			
			return this.$base.call(this,"$or",_.some);
	},
	/* any */
	$any: function() {
			if (!_.isObject(this._search.$any)) {
				if(this.debug) console.log('Tried to run any without $any object set');
				return false;
			}
			
			return this.$base.call(this, "$any", _.some);
	},
	/* and */
	$and: function() {
			if (!_.isObject(this._search.$and)) {
				if(this.debug) console.log('Tried to run and without $and object set');
				return false;
			}
			
			return this.$base.call(this, "$and");
	},
	/* not */
	$not: function() {
			if (!_.isObject(this._search.$not)) {
				if(this.debug) console.log('Tried to run not without $not object set');
				return false;
			}
			var comparer = function(a,b) {
				b = ensureArray(b);
				var ret = _.contains(b, a);
				return !ret;
			};
			return this.$base.call(this,"$not",_.every,false,comparer);
	},
	/* eq */
	$eq: function() {
			if (!_.isObject(this._search.$eq)) {
				if(this.debug) console.log('Tried to run eq without $eq object set');
				return false;
			}
			var comparer = function(a,b) {
				if(this.debug) console.log('compare $eq', a, b);
				b = ensureArray(b);
				a = ensureArray(a);
				if(this.debug) console.log('compare $eq', a, b);
				var ret = _.every(b,function(v) {
					return a.indexOf(v) > -1;
				});
				
				return ret;
			};
			return this.$base.call(this,"$eq",_.every,false,comparer);
	},
	/* ne */
	$ne: function() {
			if (!_.isObject(this._search.$ne)) {
				if(this.debug) console.log('Tried to run ne without $ne object set');
				return false;
			}
			var comparer = function(a,b) {
				b = ensureArray(b);
				var ret = _.every(b,function(v) {
					return a !== v;
				});
				
				return ret;
			};
			return this.$base.call(this,"$ne",_.every,false,comparer);
	},
	/* truthy */
	$truthy: function() {
			if (!_.isObject(this._search.$truthy)) {
				if(this.debug) console.log('Tried to run truthy without $truthy object set');
				return false;
			}
			var comparer = function(a,b) {
				b = ensureArray(b);
				var ret = _.every(b,function(v) {
					return !!v
				});
				
				return ret;
			};
			return this.$base.call(this,"$truthy",_.every,false,comparer);
	},
	/* falsey */
	$falsey: function() {
			if (!_.isObject(this._search.$falsey)) {
				if(this.debug) console.log('Tried to run falsey without $falsey object set');
				return false;
			}
			var comparer = function(a,b) {
				b = ensureArray(b);
				var ret = _.every(b,function(v) {
					if(!!v) {
						return false;
					} else {
						return true;
					}
				});
				
				return ret;
			};
			return this.$base.call(this,"$falsey",_.every,false,comparer);
	},
	/* falsy */
	$falsy: this.$falsey,
	/* regex */
	$regex: function() {
			if (!_.isObject(this._search.$regex)) {
				if(this.debug) console.log('Tried to run regex without $regex object set');
				return false;
			}
			function prepareRegExpString(string) {
				var obj = {};
				var params = string.substr(string.lastIndexOf('/')+1);
				obj.params = params.search("g") ? params : '';
				obj.regex = string.substring(( string.indexOf('/') === 0 ) ? 1 : 0,string.lastIndexOf('/'));
				if(this.debug)console.log('$regex prepare',obj);
				return obj;
			};
			var comparer = function(a,b) {
				if (_.isRegExp(b)) {
					return b.test(a);
				} else {
					var regex = prepareRegExpString.call(this,b);
					return new RegExp(regex.regex,regex.params).test(a);
				}
			};
			return this.$base.call(this,"$regex",_.every,false,comparer);
	}		
	
});

function expressionMethods(expressions) {
	
	/**
	 * add patterns to expresion search
	 * @param  {object} search patterns
	 * return boolean
	 */
	 
	expressions.forEach(function(exp) {
		ExMatch.prototype[exp] = function(pattern) {
			if (!_.isObject(pattern)) {
				return false;
			}
			var newExp = {};
			newExp[exp] = pattern;
			this.setSearchParams(newExp);
			return this;
		}

	}.bind(this));
	
}

function ensureArray(val) {
	return ( _.isArray(val) ) ? val : [val];
}
