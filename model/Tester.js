var keystone = require('keystone'),
	Types = keystone.Field.Types;

/**
 * User Model
 * ==========
 */

var compare = function(test,test2){console.log('comparer')}

var Tester = new keystone.List('Tester');

var sp = {
		e1: { $or:[ {sel1:['first','third']} , {check1:true} ] },
		e2: { $and:[ {str1:'earth'} , {check2:true} ] },
		e3: { $lte:[ {num1:1} , {num3:4} ] },
		e4: { $gt:[{num3:1}],$and:[{num1:1},{sel1:['first','third']},{num2:{$lt:4}}] },
		e5: { $or:[ {num1:{$gte:6}} , {num2:{$lte:4}} ] },
		e6: { sel1:'second' },
		e7: { $lt:{num3:3} },
}

Tester.add({
}, 'Show Dependants When', {
	sel1: { type: Types.Select, note:'`second`==`Fire` && `first` || `second` ~= `Ice`', label:'sel1', options: 'first, second, third', emptyOption: true },
	check1: { type: Boolean,  label: 'Check 1' , note:'earth ' },
	check2: { type: Boolean,  label: 'Check 2'  },
	num1: {type: Types.Number, note:'Water >=6 &&  `<=1` == `And` with num3'  },
	num2: {type: Types.Number, note:'Water <=4'},
	num3: {type: Types.Number, note: '`<=4` == `And` with num1'  },
	str1: {type:String, note:'earth with check2'},
	str2: String,
	str3: String,
}, 'Depends On', {
	isIce: { type: Boolean, label: 'Ice', dependsOn: sp.e4},
	isFire: { type: Boolean, label: 'Fire' ,dependsOn: sp.e6},
	isEarth: { type: Boolean, label: 'Earth', dependsOn: sp.e2},
	isWater: { type: Boolean, label: 'Water', dependsOn: sp.e5},
	isAnd: { type: Boolean, label: 'And', dependsOn: sp.e3 }
});

Tester.register();
