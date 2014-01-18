/*
* Sheep Benchmarking Library
* http://github.com/colinbdclark/sheep
*
* Copyright 2012, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*global Spinner, window*/
/*jslint white: true, vars: true, undef: true, newcap: true, regexp: true, browser: true,
    forin: true, continue: true, nomen: true, bitwise: true, maxerr: 100, indent: 4 */

var sheep = sheep || {};

(function () {
    "use strict";
    
    var p = window.performance;
    if (!p) {
        window.performance = Date;
    } else if (!p.now) {
        p.now = p.webkitNow || p.oNow || p.msNow;
    }
    
    var finishTestSequence = function (timing, spec) {
        timing.avg = timing.total / spec.numReps;
        timing.runs = spec.numReps;
        timing.name = spec.name;
        spec.onSuccess(timing);
    };
    
    var runTest = function (obj, timing, testFn, onTestComplete) {
        var start = window.performance.now(),
            end,
            dur;
        
        testFn(obj);
        end = window.performance.now();
        dur = end - start;
        timing.total += dur;
        timing.max = dur > timing.max ? dur : timing.max;
        timing.min = dur < timing.min ? dur : timing.min;
        if (onTestComplete) {
            onTestComplete(timing);
        }
        
        return timing;
    };
    
    var runTestBatch = function (numReps, obj, timing, testFn, onBatchComplete) {
        for (var i = 0; i < numReps; i++) {
            runTest(obj, timing, testFn);
        }
        
        if (onBatchComplete) {
            onBatchComplete(timing);
        }
        
        return timing;
    };
    
    var runTestSequenceSync = function (obj, timing, spec) {
        runTestBatch(spec.numReps, obj, timing, spec.test);
        finishTestSequence(timing, spec);
        return timing;
    };
    
    var runTestSequenceAsync = function (obj, timing, spec) {
        var batchSize = 100,
            i = 0;
        
        var asyncTest = function () {
            runTestBatch(batchSize, obj, timing, spec.test, function () {
                i += batchSize;
                if (i < spec.numReps) {
                    setTimeout(asyncTest, 0);
                } else {
                    finishTestSequence(timing, spec);
                }
            });
        };
        
        asyncTest();
    };
    
    var renderTestRow = function (table, timing) {
        var row = document.createElement("tr");
        table.appendChild(row);
        row.innerHTML = "<td>" +
            timing.name + "</td><td>" +
            timing.runs + "</td><td>" +
            timing.total.toFixed(5) + "</td><td>" +
            timing.avg.toFixed(5) + "</td><td>" +
            timing.min.toFixed(5) + "</td><td>" +
            timing.max.toFixed(5) + "</td>";
        
        return row;
    };
    
    var renderTable = function (container) {
        var table = document.createElement("table");
        
        table.innerHTML = "<tr>" +
            "<th>Name</th>" +
            "<th>Runs</th>" +
            "<th>Total ms</th>" +
            "<th>Avg. ms</th>" +
            "<th>Min</th>" +
            "<th>Max</th>" +
            "</tr>";
        container.appendChild(table);
        
        return table.querySelector("tbody");
    };
    
    var renderStatusArea = function (table, numTests) {
        var statusArea = document.createElement("tr");
        statusArea.className = "sheep-statusArea";
	    statusArea.innerHTML = "<td colspan='6'><p>Running test" +
	        " <span class='sheep-currentTest'>0</span> of" +
	        " <span class='sheep-numTests'>" + numTests + "</span></p></td>";
	    table.appendChild(statusArea);
	    
        var spinner = new Spinner({
            color: "#000",
            hwaccel: true,
            left: 225,
            top: 0
        });
        spinner.spin(statusArea.querySelector("td"));
        return statusArea;
    };
    
    var updateStatusArea = function (currentTestNum) {
        document.querySelector(".sheep-currentTest").innerHTML = currentTestNum;
    };
    
    var renderResultsView = function (numTests) {
        var container = document.createElement("div");
        var table = renderTable(container);
        var statusArea = renderStatusArea(table, numTests);
        document.querySelector("body").appendChild(container);
	    
        return {
            container: container,
            table: table,
            statusArea: statusArea
        };
    };
    
    sheep.runTestSpec = function (spec, async) {
        spec.numReps = spec.numReps || 10000;
        spec.async = async;
        
        if (typeof (spec) === "function") {
            spec = {
                test: spec
            };
        }
        
        var obj = spec.setup ? spec.setup() : undefined,
            timing = {
                total: 0,
                max: 0,
                min: Infinity,
                async: async
            };
        
        var testSequenceFn = async ? runTestSequenceAsync : runTestSequenceSync;
        return testSequenceFn(obj, timing, spec);
    };

    sheep.test = function (testSpecs, async, onAllTestsComplete) {
        testSpecs = typeof (testSpecs.length) === "number" ? testSpecs : [testSpecs];
        async = async === undefined || async === null || async  === true ? true : false;
	    
        // And asynchronously run all test sets.
	    var markup = renderResultsView(testSpecs.length),
	        allTimes = [],
	        nextTest = 0,
	        runNextTest,
	        testSuccess;
	    
        runNextTest = function () {
            var spec = testSpecs[nextTest];
            updateStatusArea(nextTest + 1);
	        spec.onSuccess = testSuccess;
	        sheep.runTestSpec(spec, async);
        };
        
		testSuccess = function (timing) {
            nextTest++;
            allTimes.push(timing);
            markup.table.appendChild(renderTestRow(markup.table, timing));
            if (nextTest < testSpecs.length) {
                runNextTest();
            } else {
                markup.table.removeChild(markup.statusArea);
                if (onAllTestsComplete) {
                    onAllTestsComplete();
                }
            }
        };
        
        // Start the test sequence.
        if (testSpecs.length > 0) {
            runNextTest();
        }
    };

}());
