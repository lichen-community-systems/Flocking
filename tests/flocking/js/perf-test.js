/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2011, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global module, test, expect, ok, equals, deepEqual, Float32Array*/

var flock = flock || {};

(function () {
    "use strict";

    module("flock.ugen.value tests");
    
    var gen = function (ugens, duration) {
        var kr = 64,
            periods = Math.ceil(44100 * duration / kr),
            i;
        for (i = 0; i < periods; i++) {
            flock.enviro.evalGraph(ugens, kr);
        }
    };
    
    var runTimingTest = function (ugens, duration, numRuns) {
        var avgDuration = 0,
            currentStartTime,
            currentEndTime,
            i;
        
        for (i = 0; i < numRuns; i++) {
            currentStartTime = Date.now();
            gen(ugens, 10);
            currentEndTime = Date.now();
            avgDuration += currentEndTime - currentStartTime;            
        }
        avgDuration = avgDuration / numRuns;
        
        return avgDuration;
    };
    
    var assertCeiling = function (actual, expectedCeiling, msg) {
        ok(actual <= expectedCeiling, msg + " Actual is: " + actual + ".");
    };
    
    test("flock.ugen.value with stereo flock.ugen.out", function () {
        var synth = flock.synth({
            id: flock.OUT_UGEN_ID,
            ugen: "flock.ugen.out",
            inputs: {
                source: {
                    ugen: "flock.ugen.value",
                    inputs: {
                        value: 12
                    }
                },
                bus: 0,
                expand: 2
            }
        });
        
        var avg = runTimingTest(synth.ugens, 1, 25);
        assertCeiling(avg, 2.5, 
            "Generating and outputting 1 second of stereo signal from flock.ugen.value should take less than 2.5 ms.");
    });
    
    module("flock.ugen.sinOsc tests");
    
    var checkUGen = function (ugenName, inputs, expectedCeil, msg) {
        var ugen = flock.invokePath(ugenName, [inputs, new Float32Array(64)]),
            ugens = [ugen];
            
        for (var inputName in inputs) {
            var input = inputs[inputName];
            if (input.gen) {
                ugens.push(input);
            }
        }
        var avg = runTimingTest(ugens, 1, 25);
        assertCeiling(avg, expectedCeil, msg);
    };
    
    var crFreq = flock.ugen.value({value: 440}, new Float32Array(1));
    var crPhase = flock.ugen.value({value: flock.TWOPI}, new Float32Array(1));
    var krSinFreq = flock.ugen.sinOsc({freq: flock.ugen.value({value: 20}, new Float32Array(1))}, new Float32Array(1), {rate: "control"});
    var krSinPhase = flock.ugen.sinOsc({freq: crFreq, mul: crPhase}, new Float32Array(1), {rate: "control"});
    var arSinFreq = flock.ugen.sinOsc({freq: flock.ugen.value({value: 123}, new Float32Array(1))}, new Float32Array(64));
    var arSinPhase = flock.ugen.sinOsc({freq: crFreq, mul: crPhase}, new Float32Array(64));
    
    var testConfigs = [
        {
            inputs: {
                freq: crFreq
            },
            maxDur: 45
        },
        {
            inputs: {
                freq: crFreq,
                phase: crPhase
            },
            maxDur: 45
        },
        {
            inputs: {
                freq: krSinFreq
            },
            maxDur: 45
        },
        {
            inputs: {
                freq: krSinFreq,
                phase: krSinPhase
            },
            maxDur: 45
        },
        {
            inputs: {
                freq: arSinFreq
            },
            maxDur: 90
        },
        {
            inputs: {
                freq: arSinFreq,
                phase: arSinPhase
            },
            maxDur: 135
        }
        
    ];
    
    var runTest = function (ugenName, inputs, maxDur, msg) {
        test(msg, function () {
            checkUGen(ugenName, inputs, maxDur, "Should take no longer than " + maxDur + " seconds.");
        });
    }
    var testConfigurations = function (ugenName, configs) {
        var i,
            config,
            inputs,
            inputName,
            input,
            msg;
            
        for (i = 0; i < configs.length; i++) {
            config = configs[i];
            inputs = config.inputs;
            msg = "1 sec. signal from " + ugenName + " with ";
            
            for (inputName in inputs) {
                input = inputs[inputName];
                msg += input.rate + " rate " + inputName + ", ";
            }
            runTest(ugenName, inputs, config.maxDur, msg);
        }
    };
    
    testConfigurations("flock.ugen.sinOsc", testConfigs);
})();