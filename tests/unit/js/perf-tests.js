/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2011, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global module, test, ok*/

var flock = flock || {};

(function () {
    "use strict";

    flock.init();
    
    module("flock.ugen.value tests");
    
    // TODO: Normalize this with the real node evaluation algorithm in Synth (i.e. break it out and reuse it.)
    var gen = function (ugens, duration) {
        var kr = 64,
            periods = Math.ceil(44100 * duration / kr),
            i,
            j,
            ugen;
            
        for (i = 0; i < periods; i++) {
            for (j = 0; j < ugens.length; j++) {
                ugen = ugens[j];
                if (ugen.gen !== undefined) {
                    ugen.gen(kr);
                }
            }
        }
    };
    
    var runTimingTest = function (ugens, numRuns) {
        var avgDuration = 0,
            currentStartTime,
            currentEndTime,
            i;
        
        for (i = 0; i < numRuns; i++) {
            currentStartTime = Date.now();
            gen(ugens, 1);
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
            synthDef: {
                id: flock.OUT_UGEN_ID,
                ugen: "flock.ugen.out",
                inputs: {
                    sources: {
                        ugen: "flock.ugen.value",
                        inputs: {
                            value: 12
                        }
                    },
                    bus: 0,
                    expand: 2
                }
            }
        });
        
        var avg = runTimingTest(synth.nodes, 50);
        assertCeiling(avg, 5, 
            "Generating and outputting 1 second of stereo signal from flock.ugen.value should take less than 5 ms.");
    });
    
    module("flock.ugen.sinOsc tests");
    
    var checkUGen = function (ugenDef, expectedCeil, msg) {
        var ugen = flock.parse.ugenForDef(ugenDef),
            ugens = [ugen],
            inputName,
            input,
            avg;
            
        for (inputName in ugen.inputs) {
            input = ugen.inputs[inputName];
            if (input.gen) {
                ugens.push(input);
            }
        }
        avg = runTimingTest(ugens, 50);
        assertCeiling(avg, expectedCeil, msg);
    };
    
    var testConfigs = [
        {
            ugenDef: {
                ugen: "flock.ugen.sinOsc",
                inputs: {
                    freq: 440
                }
            },
            maxDur: 25
        },
        {
            ugenDef: {
                ugen: "flock.ugen.sinOsc",
                inputs: {
                    freq: 440,
                    phase: flock.TWOPI
                }
            },
            maxDur: 50
        },
        {
            ugenDef: {
                ugen: "flock.ugen.sinOsc",
                inputs: {
                    freq: {
                        ugen: "flock.ugen.sinOsc",
                        rate: "control",
                        freq: 20
                    }
                }
            },
            maxDur: 40
        },
        {
            ugenDef: {
                ugen: "flock.ugen.sinOsc",
                inputs: {
                    freq: {
                        ugen: "flock.ugen.sinOsc",
                        rate: "control",
                        freq: 20
                    },
                    phase: {
                        ugen: "flock.ugen.sinOsc",
                        rate: "control",
                        freq: 440,
                        mul: flock.TWOPI
                    }
                }
            },
            maxDur: 80
        },
        {
            ugenDef: {
                ugen: "flock.ugen.sinOsc",
                inputs: {
                    freq: {
                        ugen: "flock.ugen.sinOsc",
                        rate: "audio",
                        freq: 123
                    }
                }
            },
            maxDur: 75
        },
        {
            ugenDef: {
                ugen: "flock.ugen.sinOsc",
                inputs: {
                    freq: {
                        ugen: "flock.ugen.sinOsc",
                        rate: "audio",
                        freq: 123
                    },
                    phase: {
                        ugen: "flock.ugen.sinOsc",
                        rate: "audio",
                        freq: 440,
                        phase: flock.TWOPI
                    }
                }

            },
            maxDur: 150
        }
        
    ];
    
    var runTest = function (ugenDef, maxDur, msg) {
        test(msg, function () {
            checkUGen(ugenDef, maxDur, "Should take no longer than " + maxDur + " ms.");
        });
    };
    
    var testConfigurations = function (configs) {
        var i,
            config,
            inputs,
            inputName,
            input,
            msg,
            inputMsgs;
            
        for (i = 0; i < configs.length; i++) {
            config = configs[i];
            inputs = config.ugenDef.inputs;
            msg = "1 sec. signal from " + config.ugenDef.ugen + " with ";
            inputMsgs = [];
            
            for (inputName in inputs) {
                input = inputs[inputName];
                inputMsgs.push((input.rate ? input.rate : "constant") + " rate " + inputName);
            }
            runTest(config.ugenDef, config.maxDur, msg + inputMsgs.join(", "));
        }
    };
    
    testConfigurations(testConfigs);
}());
