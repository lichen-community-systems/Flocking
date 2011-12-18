/*
* Flocking Unit Generators
* http://github.com/colinbdclark/flocking
*
* Copyright 2011, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*jslint white: true, funcinvoke: true, undef: true, newcap: true, regexp: true, browser: true, 
    forin: true, continue: true, forvar: true, nomen: true, bitwise: true, maxerr: 100, indent: 4 */

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

    var mockUGen = function (outputBufferGenerator, rate) {
        rate = rate || flock.rates.AUDIO;
        return {
            rate: rate,
            output: flock.generate(64, outputBufferGenerator)
        };
    };
	
    flock.test.runTests = function (testSpecs, table) {
        var allTimes = [],
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
	
    var makeRandomInputGenerator = function (inputSpec, defaultScale) {
        defaultScale = defaultScale || 500;
        var scale = typeof (inputSpec) === "string" ? defaultScale : inputSpec.scale;

        return function () {
            return Math.random() * scale;	
        }
    };
	
    var randomizeUGenTestSpec = function (ugenDef, inputs, rate, numSampsToGen) {
        numSampsToGen = numSampsToGen || 64;
		
        var i,
            input;
			
        return {
            setup: function () {
                var ug = flock.parse.ugenForDef(ugenDef),
                    input,
                    inputName;
                
                for (i = 0; i < inputs.length; i++) {
                    input = inputs[i];
                    inputName = typeof (input) === "string" ? input : input.name;
                    ug.inputs[inputName] = mockUGen(makeRandomInputGenerator(input), rate);
                };
				
                ug.onInputChanged();
                
                return ug;
            },
            
            test: function (ug) {
                ug.gen(numSampsToGen);
            }
        };
    }; 

    flock.test.timeIsolatedUGens = function (ugens, inputs, rates, numSamps) {
        rates = rates || [flock.rates.AUDIO];
        
        var ugenDefs = [],
            testSpecs = [],
            i,
            j,
            ugenDef,
            rate,
            testSpec,
            k,
            input,
            inputName,
            randomizer;
						
        for (i = 0; i < ugens.length; i++) {
            for (j = 0; j < rates.length; j++) {
                ugenDef = {},
                rate = rates[j];
			
                ugenDef.ugen = ugens[i];
                for (k = 0; k < inputs.length; k++) {
                    input = inputs[k];
                    inputName = (typeof (input) === "string") ? input : input.name;
                    randomizer = makeRandomInputGenerator(input);
                    ugenDef[inputName] = randomizer();
                }
                ugenDefs.push(ugenDef);
                testSpec = randomizeUGenTestSpec(ugenDef, inputs, rate, numSamps);
                testSpec.name = ugenDef.ugen + " " + rate;
                testSpecs.push(testSpec);
            }
        }
        
        flock.test.runTests(testSpecs);
    };

})();