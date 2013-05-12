/*
* Flocking asm.js-Based Unit Generator Benchmark Tests
* http://github.com/colinbdclark/flocking
*
* Copyright 2013, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*global sheep*/
/*jslint white: true, plusplus: true, undef: true, newcap: true, regexp: true, browser: true, 
    forin: true, nomen: true, bitwise: true, maxerr: 100, indent: 4 */

var flock = flock || {};

(function () {
    "use strict";
    
    flock.init();
    
    flock.test = flock.test || {};

       
    /*************
     * The Tests *
     *************/
    
    var makeSynth = function (type) {
        /*
        var heap = new ArrayBuffer(64 * 5 * 4),  // 5 x 64-sample buffers, each sample is 4 bytes.
            freq = Float32Array(heap, 0, 256),
            phaseOffset = new Float32Array(heap, 256, 512),
            mul = new Float32Array(heap, 512, 768),
            add = new Float32Array(heap, 768, 1024),
            out = new Float32Array(heap, 1024, 1280);
        
        return flock.invoke(type, [
            {
                freq: {
                    output: freq
                },
                phaseOffset: {
                    output: phaseOffset
                },
                mul: {
                    output: mul
                },
                add: {
                    output: add
                }
            },
            out
        ]);
        */
        
        return flock.synth({
            ugen: type,
            rate: "audio",
            freq: {
                ugen: type,
                rate: "control",
                freq: 1000,
                mul: 500,
                add: 500
            },
            mul: {
                ugen: type,
                rate: "control",
                freq: 250,
                mul: 0.5,
                add: 0.5
            },
            add: {
                ugen: type,
                rate: "control",
                freq: 500,
                mul: 0.25,
                add: 0.25
            }
        });
    };
    
    flock.test.asmjsUGenBenchmarks = function () {

        var testFn = function (synth) {
            // Generate about a second's worth of samples.
            for (var i = 0; i < 689; i++) {
                synth.gen(64);
            }
        };
        
        sheep.test([
            {
                name: "Plain JavaScript flock.ugen.sin",
                setup: function () {
                    return makeSynth("flock.ugen.sin");
                },
                test: testFn
            },
            {
                name: "asm.js flock.ugen.asmSin",
                setup: function () {
                    return makeSynth("flock.ugen.asmSin");
                },
                test: testFn
            }
        ]);
    };
    
}());
