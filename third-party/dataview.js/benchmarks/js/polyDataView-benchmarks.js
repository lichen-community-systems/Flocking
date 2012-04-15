/*
* polyDataView Benchmarks
* http://github.com/colinbdclark/polyDataView
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
	    
	    var getInt16Test = function (dv) {
	        for (var i = 0; i < 1024; i++) {
	            dv.getInt16(i, 0, false);
	        }
	    };
	    
	    var getPolyInt16ArrayTest = function (dv) {
	        dv.getInts(1024, 2, 0, false);
	    };
	    
	    var getSpecInt16ArrayTest = function (dv) {
	        var result = [];
	        for (var i = 0; i < 1024; i++) {
	            result.push(dv.getInt16(i, 0, false));
	        }
	    };
	    
	    var testSpecs = [
    	    {
	            name: "polyDataView: get 1024 Int16 big endian values, one at a time",
	            setup: makeSetupFn("polyDataView"),
	            
	            test: getInt16Test
    	    },
    	    {
    	        name: "jDataView: get 1024 Int16 big endian values, one at a time",
    	        setup: makeSetupFn("jDataView"),
    	        test: getInt16Test
    	    },
    	    {
	            name: "polyDataView: get all 1024 Int16 big endian values as an array.",
	            setup: makeSetupFn("polyDataView"),
	            test: getPolyInt16ArrayTest
    	    },
    	    {
    	        name: "jDataView: get all 1024 Int16 big endian values as an array.",
    	        setup: makeSetupFn("jDataView"),
    	        test: getSpecInt16ArrayTest
    	    }
	    ];

        if (window["DataView"]) {
            testSpecs.push({
                name: "Native DataView: get all 1024 Int16 big endian values as an array.",
                setup: makeSetupFn("DataView"),
                test: getInt16Test
            });
            
            testSpecs.push({
    	        name: "Native DataView: get all 1024 Int16 big endian values as an array.",
    	        setup: makeSetupFn("DataView"),
    	        test: getSpecInt16ArrayTest
    	    });
        }
        
	    sheep.tests(testSpecs, true);
	};

}());