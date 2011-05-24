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
                buffer: 0,
                expand: 2
            }
        });
        
        var avg = runTimingTest(synth.ugens, 1, 10);
        assertCeiling(avg, 2, 
            "Generating and outputting 1 second of stereo signal from flock.ugen.value should take less than 2.1 ms.");
    });
    
    module("flock.ugen.sinOsc tests");
    
    var checkSinGen = function (inputs, expectedCeil, msg) {
        var sinOsc = flock.ugen.sinOsc(inputs, new Float32Array(64)),
            ugens = [sinOsc];
            
        for (var inputName in inputs) {
            var input = inputs[inputName];
            if (input.gen) {
                ugens.push(input);
            }
        }
        var avg = runTimingTest(ugens, 1, 10);
        assertCeiling(avg, expectedCeil, msg);
    };
    
    test("Plain audio rate flock.ugen.sinOsc", function () {
        var crFreq = flock.ugen.value({value: 440}, new Float32Array(1));
        var crPhase = flock.ugen.value({value: 20}, new Float32Array(1));
        
        // Audio rate with constant rate freq input.
        var inputs = {
            freq: crFreq
        };
        checkSinGen(inputs, 45, 
            "Generating a 1 second signal from flock.ugen.sinOsc with a constant frequency should take less than 45ms.");
        
        // Audio rate with constant rate freq and phase inputs.
        inputs.phase = crPhase;
        checkSinGen(inputs, 45,
            "Generating a 1 second signal from flock.ugen.sinOsc with constant freq and phase inputs should take less than 45ms.");
        
        // Audio rate with control rate freq input.
        var krSinFreq = flock.ugen.sinOsc({freq: crPhase}, new Float32Array(1), {rate: "control"});
        inputs = {
            freq: krSinFreq
        };
        checkSinGen(inputs, 45,
            "Generating a 1 second signal from sinOsc with a control rate sinOsc freq input should take less than 45ms.");
        
        // Audio rate with control rate freq and phase inputs.
        var krSinPhase = flock.ugen.sinOsc({freq: crPhase}, new Float32Array(1), {rate: "control"});
        inputs.phase = krSinPhase;
        checkSinGen(inputs, 45,
            "Generating a 1 second signal from sinOsc with control rate freq and phase sinOsc inputs should take less than 45ms.");
        
        // Audio rate with audio rate freq input.
        var arSinFreq = flock.ugen.sinOsc({freq: flock.ugen.value({value: 123}, new Float32Array(1))}, new Float32Array(64));
        inputs = {
            freq: arSinFreq
        };
        checkSinGen(inputs, 90,
            "Generating a 1 second signal from sinOsc with an audio rate sinOsc freq input should take less than 90ms.");
        
        // Audio rate with audio rate freq and phase inputs.
        var arSinPhase = flock.ugen.sinOsc({freq: crPhase}, new Float32Array(64));
        inputs.phase = arSinPhase;
        checkSinGen(inputs, 135,
            "Generating a 1 second signal from sinOsc with audio rate freq and phase sinOsc inputs should take less than 135 ms.");
    });
})();