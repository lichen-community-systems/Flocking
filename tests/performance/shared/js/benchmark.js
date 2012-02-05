/*
* Flocking Unit Generators
* http://github.com/colinbdclark/flocking
*
* Copyright 2011, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*jslint white: true, vars: true, plusplus: true, undef: true, newcap: true, regexp: true, browser: true, 
    forin: true, continue: true, nomen: true, bitwise: true, maxerr: 100, indent: 4 */

var flock = flock || {};

(function () {
    "use strict";

    flock.test = flock.test || {};
        
    var test = function (options) {
        options.numReps = options.numReps || 100000;
        
        if (typeof (options) === "function") {
            options = {
                test: options
            };
        }
        
        var obj = options.setup ? options.setup() : undefined,
            timing = {},
            i;

        timing.start = Date.now();
        for (i = 0; i < options.numReps; i++) {
            options.test(obj);
        }
        timing.end = Date.now();
        timing.total = timing.end - timing.start;
        timing.avg = timing.total / options.numReps;
        timing.runs = options.numReps;
        timing.name = options.name;
            
        return timing;
    };
    
    var renderTestRow = function (times) {
        return "<tr><td>" + times.name + "</td><td>" + times.runs + "</td><td>" + times.total + "</td><td>" + times.avg + "</td></tr>";
    };
    
    var renderTestResults = function (timesArray) {
        var table = "<table><tr><th>Name</th><th>Runs</th><th>Total ms</th><th>Avg. ms</th></tr>",
            i;
        for (i = 0; i < timesArray.length; i++) {
            table += renderTestRow(timesArray[i]);
        }
        table += "</table>";
        
        return table;
    };
    
    flock.test.runTests = function (testSpecs) {
        var testSpecs = typeof (testSpecs.length) === "number" ? testSpecs : [testSpecs],
            allTimes = [],
            spec,
            time,
            i;
			
        for (i = 0; i < testSpecs.length; i++) {
            spec = testSpecs[i];
            time = test(spec);
            allTimes.push(time);
        }
		
        var container = document.createElement("div");
        container.innerHTML = renderTestResults(allTimes);
        document.querySelector("body").appendChild(container);
    };

}());