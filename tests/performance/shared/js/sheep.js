/*
* Sheep Benchmarking Library
* http://github.com/colinbdclark/sheep
*
* Copyright 2012, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*jslint white: true, vars: true, plusplus: true, undef: true, newcap: true, regexp: true, browser: true, 
    forin: true, continue: true, nomen: true, bitwise: true, maxerr: 100, indent: 4 */

var sheep = sheep || {};

(function () {
    "use strict";
    
    var finishTestSet = function (timing, options) {
        timing.avg = timing.total / options.numReps;
        timing.runs = options.numReps;
        timing.name = options.name;
        options.onSuccess(timing);
    };
        
    var runTestSet = function (runsRemaining, obj, timing, options) {
        var start, end;
        
        if (runsRemaining > -1) {
            start = Date.now();
            options.test(obj);
            end = Date.now();
            timing.total += (end - start);
            
            runsRemaining--;
            if (options.async) {
                setTimeout(function () {
                    runTestSet(runsRemaining, obj, timing, options);
            }, 0);
            } else {
                runTestSet(runsRemaining, obj, timing, options);
            }
        } else {
            finishTestSet(timing, options);
        }
    };
    
    var renderTestRow = function (table, timing) {
        var row = document.createElement("tr");
        table.appendChild(row);
        row.innerHTML = "<td>" + timing.name + "</td><td>" + timing.runs + "</td><td>" + timing.total + "</td><td>" + timing.avg + "</td>";
        return row;
    };
    
    var renderTable = function (container) {
        var table = document.createElement("table");
        
        table.innerHTML = "<tr><th>Name</th><th>Runs</th><th>Total ms</th><th>Avg. ms</th></tr>";
        container.appendChild(table);
        
        return table;
    };
    
    sheep.test = function (spec, async) {
        spec.numReps = spec.numReps || 10000;
        spec.async = async;
        
        if (typeof (options) === "function") {
            options = {
                test: options
            };
        }
        
        var runsRemaining = spec.numReps,
            obj = spec.setup ? spec.setup() : undefined,
            timing = {
                total: 0,
                async: async
            };
            
        runTestSet(runsRemaining, obj, timing, spec);
    };

    sheep.tests = function (testSpecs, async, onAllTestsComplete) {
        testSpecs = typeof (testSpecs.length) === "number" ? testSpecs : [testSpecs];
        async = async === undefined || async === null || async  === true ? true : false;
        
        var allTimes = [],
            spec,
            time;
    
        // Render the results table.
        var container = document.createElement("div");
	    document.querySelector("body").appendChild(container);
        var table = renderTable(container);
        
        // And asynchronously run all test sets.
	    var testsRemaining = testSpecs.length - 1;
	    
        var runNextTest = function () {
            var spec = testSpecs[testsRemaining];
	        spec.onSuccess = testSuccess;
	        sheep.test(spec, async);
        };
        
		var testSuccess = function (timing) {
            testsRemaining--;
    	    allTimes.push(timing);
    	    table.appendChild(renderTestRow(table, timing));
    	    if (testsRemaining > -1) {
    	        runNextTest();
    	    } else {
    	        if (onAllTestsComplete) {
    	            onAllTestsComplete();
    	        }
    	    }
    	};
    	
    	runNextTest();
    };

}());
