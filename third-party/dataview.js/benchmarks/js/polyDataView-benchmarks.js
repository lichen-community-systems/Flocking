/*
* PolyDataView Benchmarks
* http://github.com/colinbdclark/PolyDataView
*
* Copyright 2012, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*jslint white: true, plusplus: true, undef: true, newcap: true, regexp: true, browser: true, 
    forin: true, continue: true, nomen: true, bitwise: true, maxerr: 100, indent: 4 */

var flock = flock || {};

(function () {
    "use strict";

    flock.test = flock.test || {};

	flock.test.polyDataViewBenchmarks = function () {
	    
	    var makeRandomBuffer = function (len, w) {
	        var buffer = [];
	        for (var i = 0; i < len; i++) {
	            for (var j = 0; j < w; j++) {
	                var val = Math.round(Math.random() * (Math.pow(2, w) - 1));
	                buffer.push(val);
	            }
	        }
	        return buffer;
	    };
	
        var makeSetupFn = function (constructorName) {
            return function () {
                var buffer = new Uint8Array(makeRandomBuffer(1024, 2));
                return new window[constructorName](buffer.buffer);
            };
        };
	    
	    var setupDataViewTest = function (len, w, dvCreatorFn) {
            var buffer = new Uint8Array(makeRandomBuffer(len, w));
            return dvCreatorFn(buffer);
	    };
	    
	    var getInt16Test = function (dv, isLittle) {
	        for (var i = 0; i < 1024; i++) {
	            dv.getInt16(i, 0, isLittle);
	        }
	    };
	    
	    var getPolyInt16ArrayTest = function (dv, isLittle) {
	        dv.getInts(1024, 2, 0, isLittle);
	    };
	    
	    var getSpecInt16ArrayTest = function (dv, isLittle) {
	        var result = [];
	        for (var i = 0; i < 1024; i++) {
	            result.push(dv.getInt16(i, 0, isLittle));
	        }
	    };
	    
	    var getterTestSpecs = [
	        {
	            name: "get 1024 Int16 values",
	            type: "PolyDataView",
	            oneAtATimeTest: getInt16Test,
	            arrayTest: getPolyInt16ArrayTest
	        },
	        {
	            name: "get 1024 Int16 values",
	            type: "jDataView",
	            oneAtATimeTest: getInt16Test,
	            arrayTest: getSpecInt16ArrayTest
	        }
	    ];

        if (window["DataView"]) {
            getterTestSpecs.push({
                name: "get 1024 Int16 values",
	            type: "DataView",
	            oneAtATimeTest: getInt16Test,
	            arrayTest: getSpecInt16ArrayTest
            });
        }
        
        // TODO: Remove duplication.
        var expandTestSpecs = function (testSpecs) {
            var expanded = [],
                i,
                spec;
            for (i = 0; i < testSpecs.length; i++) {
                spec = testSpecs[i];
                expanded.push({
                    name: spec.type + ": " + spec.name + ", one at a time - big endian.",
                    setup: makeSetupFn(spec.type),
                    test: function (dv) {
                        spec.oneAtATimeTest(dv, false);
                    }
                });
                
                expanded.push({
                    name: spec.type + ": " + spec.name + ", one at a time - little endian.",
                    setup: makeSetupFn(spec.type),
                    test: function (dv) {
                        spec.oneAtATimeTest(dv, true);
                    }
                });
                
                expanded.push({
                    name: spec.type + ": " + spec.name + " as an array - big endian.",
                    setup: makeSetupFn(spec.type),
                    test: function (dv) {
                        spec.arrayTest(dv, false);
                    }
                });
                
                expanded.push({
                    name: spec.type + ": " + spec.name + " as an array - little endian.",
                    setup: makeSetupFn(spec.type),
                    test: function (dv) {
                        spec.arrayTest(dv, true);
                    }
                });
            }
            return expanded;
        };
        
        var testSpecs = expandTestSpecs(getterTestSpecs);
	    sheep.test(testSpecs, true);
	};

}());