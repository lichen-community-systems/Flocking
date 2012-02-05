/*
* Flocking Unit Generator Benchmark Tests
* http://github.com/colinbdclark/flocking
*
* Copyright 2011, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*jslint white: true, plusplus: true, undef: true, newcap: true, regexp: true, browser: true, 
    forin: true, continue: true, nomen: true, bitwise: true, maxerr: 100, indent: 4 */

var flock = flock || {};

(function () {
    "use strict";

    flock.test = flock.test || {};
	
    var makeRandomizedInputUGenTestSpec = function (ugenDef, inputs, rate, numSampsToGen) {
        numSampsToGen = numSampsToGen || 64;
		
        return {
            setup: function () {
                var ug = flock.parse.ugenForDef(ugenDef),
                    i,
                    input,
                    inputName;
                
                for (i = 0; i < inputs.length; i++) {
                    input = inputs[i];
                    inputName = typeof (input) === "string" ? input : input.name;
                    ug.inputs[inputName] = flock.test.makeMockUGen(flock.test.makeRandomInputGenerator(input), rate);
                }
				
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
                ugenDef = {};
                rate = rates[j];
			
                ugenDef.ugen = ugens[i];
                for (k = 0; k < inputs.length; k++) {
                    input = inputs[k];
                    inputName = (typeof (input) === "string") ? input : input.name;
                    randomizer = flock.test.makeRandomInputGenerator(input);
                    ugenDef[inputName] = randomizer();
                }
                ugenDefs.push(ugenDef);
                testSpec = makeRandomizedInputUGenTestSpec(ugenDef, inputs, rate, numSamps);
                testSpec.name = ugenDef.ugen + " " + rate;
                testSpecs.push(testSpec);
            }
        }
        
        flock.test.runTests(testSpecs);
    };

}());