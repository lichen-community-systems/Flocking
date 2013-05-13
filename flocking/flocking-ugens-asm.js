/*
 * Flocking Asm.js-Basd Unit Generators
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2013, Colin Clark
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global Float32Array*/
/*jslint white: true, vars: true, undef: true, newcap: true, regexp: true, browser: true,
    forin: true, nomen: true, bitwise: true, maxerr: 100, indent: 4 */

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";
    
    flock.ugen.asmSin = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);
        that.model.phase = 0.0;
        that.genModule = flock.ugen.asmSin.module.create({
            Math: Math, 
            Float32Array: Float32Array
        }, {}, that.output.buffer);
    
        that.gen = function (numSamps) {
                 
            that.model.phase = that.genModule.gen(
                numSamps,
                that.inputs.freq.output[0], 
                that.inputs.phase.output[0],
                that.inputs.mul.output[0],
                that.inputs.add.output[0],
                that.model.sampleRate,
                that.model.phase,
                flock.TWOPI
            );
        };

        return that;
    };

    flock.ugen.asmSin.module = {}

    flock.ugen.asmSin.module.body = 
        "\"use asm\";" + 

        "var sin = stdlib.Math.sin;" + 
        "var out = new stdlib.Float32Array(heap);" + 

        "function gen (numSamps, freq, phaseOffset, mul, add, sampleRate, phase, pi2) {" + 
        "    numSamps = numSamps|0;" + 
        "    freq = +freq;" + 
        "    phaseOffset = +phaseOffset;" + 
        "    mul = +mul;" + 
        "    add = +add;" + 
        "    sampleRate = +sampleRate;" + 
        "    phase = +phase;" +
        "    pi2 = +pi2;" +  
         
        "    var i = 0;" +
        "    for (; (i | 0) < (numSamps | 0); i = i + 1|0) {" +
        "        out[i >> 2] = sin(phase + phaseOffset) * mul + add;" +
        "        phase = phase + (freq / sampleRate * pi2);" +
        "    }" +
    
        "    return +phase;" +
        "}" +

        "return {" +
        "    gen: gen" +
        "};";

    flock.ugen.asmSin.module.create = function (stdlib, foreign, heap) {
        var constructor = new Function("stdlib", "foreign", "heap", flock.ugen.asmSin.module.body);
        return constructor(stdlib, foreign, heap);
    };

    fluid.defaults("flock.ugen.asmSin", {
        rate: "audio",
        inputs: {
            freq: 440.0,
            phase: 0.0,
            mul: 1.0,
            add: 0.0
        }
    });

}());
