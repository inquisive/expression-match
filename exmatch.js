var _ = require ('underscore');

/**
 *
 * @api public
 */

var ExMatch = function(match, values, debug) {
	
	if(!_.isObject(match)) return false;
	if(!_.isObject(values)) return false;
	
	this.debug = debug || false;
	
	// container for expression comparers
	this._search = {};
	
	this.expression = false;
	
	this.searchFields = values;
	
	// loop through the match object and push _search with expression objects
	this.setSearchParams(match);
	
	if(debug) console.log(this._search, this.searchFields);
	return this;
}

ExMatch.prototype.isExp = function(key) {
	
	if(!_.isString(key))return false;
	
	/* match single word beginning with $ */
	var ret = key.match(/^\$[A-Za-z]+$/);
	
	return  _.isObject(ret)  ? ret[0] : false;	
}

ExMatch.prototype.setSearchParams = function(match) {
	
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
				
			}
			this._search[exp].search.push({'$match':new exMatch(newObj,this.searchFields,false)});
			
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
		/* some exp use arrays so loop through and add each object to the routine */
		if(_.isArray(val)) {
			// if(this.debug) console.log('val','array',val);
			_.each(val,function(obj) {
				if(!_.isObject(obj)) {
					/* this is a string in an Array so we assume it is a field name that should be boolean true */
					var ret = {};
					ret[obj] = true;
					obj = ret;
				}
				
				pushVal(exp,obj);
				
			}, this);
			
		} else if(val) {
			// if(this.debug) console.log(' value',val);
			pushVal(exp,val,key);
		}
		
		return this;
	}, this);
	
	return this;
}

ExMatch.prototype.selector = function(fn,search,searchFields){
	/* the fn is the method chosen to select true/false
	 * search is an object that contains
	 * 	exp: name of the expression
	 * 	search: array of objects, and may contain new exp searches
	 * 	$selector: selector function (current)
	 * 	$comparer: comparer function
	 * searchFields is the object of fields that are fieldId:value pairs
	 * 
	 * */
	var ret = fn(search.search,function(val) {
		
		/* we pass this as reference the entire chain so save our originals */
		this.searchFields = searchFields;
		this.search = val;
		
		/* run the proper method and return*/
		var ret2 =  fn(val, search.$comparer, this);
		if(this.debug) console.log(this.expression,'fn selector',ret2);
		return ret2;
		
	}, this);
	
	if(this.debug) console.log(this.expression,'return selector',ret);
	return ret;
}

ExMatch.prototype.comparer = function(val,key) {
	
	/* we want an Array of objects */	
	var matches = _.isArray(val) ? val : [val];
	//if(this.debug) console.log(matches, this.searchFields[key],key)
	
	if(key === '$match') {
		/* $match keys contain a new ExMatch instance so run match */
		if(this.debug) console.log(this.expression,'start new match');
		return val.match();
	} else {
		/* see if the value matches */
		var ret = _.contains(matches, this.searchFields[key]);
		if(this.debug) console.log(this.expression,'return compare',ret);
		return ret;
	}
		
}

ExMatch.prototype.match = function() {
	
	/* If we dont have a _search object  are we still true since we did naything false? */
	if(this.expression.charAt(0) !== '$')return true;
	if(!_.isObject(this._search))return true;
	if(!this.searchFields)return false;
	
	
	/* loop the _search object and run all the requested searches */
	return _.every(this._search,function(val) {		
		return val.exp !== false ? this[val.exp]() : false;
	}, this);
}


ExMatch.prototype.$gt = function(comparer,selector) {
	
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
}
ExMatch.prototype.$gte = function(comparer,selector) {
	
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
	
	if(this.debug) console.log(this.expression,'gte return',sel,this._search.$gte);
	
	return sel;
}

ExMatch.prototype.$lt = function(comparer,selector) {
	
	var exp = this._search.$lt;
	
	var $selector = (_.isFunction(exp.$selector)) ? exp.$selector : selector;
	var $comparer = (_.isFunction(exp.$comparer)) ? exp.$comparer : comparer;
	
	if(!_.isFunction($comparer)) {
		exp.$comparer = function(val,key){
			return Number(this.searchFields[key]) < Number(val);
		}.bind(this);
	}
	
	if(!_.isFunction($selector)) {
		exp.$selector = this.selector;
	}
	
	var sel = exp.$selector.call(this, _.every, exp, this.searchFields);
	
	if(this.debug) console.log(this.expression,'lt return',sel);
	
	return sel;
}
ExMatch.prototype.$lte = function(comparer,selector) {
	
	var exp = this._search.$lte;
	
	var $selector = (_.isFunction(exp.$selector)) ? exp.$selector : selector;
	var $comparer = (_.isFunction(exp.$comparer)) ? exp.$comparer : comparer;
	
	if(!_.isFunction($comparer)) {
		exp.$comparer = function(val,key){
			return Number(this.searchFields[key]) <= Number(val);
		}.bind(this);
	}
	
	if(!_.isFunction($selector)) {
		exp.$selector = this.selector;
	}
	
	var sel = exp.$selector.call(this, _.every, exp, this.searchFields);
	
	if(this.debug) console.log(this.expression,'lte return',sel);
	
	return sel;
}

ExMatch.prototype.$or = function(comparer,selector) {
	
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
}

ExMatch.prototype.$and = function(comparer,selector) {
	
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
}


ExMatch.prototype.ExMatch = ExMatch;

var exMatch = module.exports = exports = ExMatch;

module.exports = exports = function $basic(exp, comparer, selector) {
	
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
}
