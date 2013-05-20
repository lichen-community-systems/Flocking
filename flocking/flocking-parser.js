/*
* Flocking Parser
* http://github.com/colinbdclark/flocking
*
* Copyright 2011, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*global Float32Array*/
/*jslint white: true, vars: true, undef: true, newcap: true, regexp: true, browser: true,
    forin: true, continue: true, nomen: true, bitwise: true, maxerr: 100, indent: 4 */

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");
    
(function () {
    "use strict";
    
    var $ = fluid.registerNamespace("jQuery");
    fluid.registerNamespace("flock.parse");
    
    flock.parse.synthDef = function (ugenDef, options) {
        if (!ugenDef) {
            ugenDef = [];
        }
        
        // We didn't get an out ugen specified, so we need to make one.
        if (options.rate === flock.rates.AUDIO && 
            (typeof (ugenDef.length) === "number" || 
            (ugenDef.id !== flock.OUT_UGEN_ID && ugenDef.ugen !== "flock.ugen.out"))) {
            ugenDef = {
                id: flock.OUT_UGEN_ID,
                ugen: "flock.ugen.out",
                inputs: {
                    sources: ugenDef,
                    bus: 0,
                    expand: options.audioSettings.chans
                }
            };
        }
        
        return flock.parse.ugenForDef(ugenDef, options);
    };

    flock.parse.makeUGen = function (ugenDef, parsedInputs, options) {
        var rates = options.audioSettings.rates;
        
        // Assume audio rate if no rate was specified by the user.
        if (!ugenDef.rate) {
            ugenDef.rate = flock.rates.AUDIO;
        }
    
        var buffer = new Float32Array(ugenDef.rate === flock.rates.AUDIO ? rates.control : 1),
            sampleRate;
    
        // Set the ugen's sample rate value according to the rate the user specified.
        if (ugenDef.options && ugenDef.options.sampleRate !== undefined) {
            sampleRate = ugenDef.options.sampleRate;
        } else if (ugenDef.rate === flock.rates.AUDIO) {
            sampleRate = rates.audio;
        } else if (ugenDef.rate === flock.rates.CONTROL) {
            sampleRate = rates.audio / rates.control;
        } else {
            sampleRate = 1;
        }
        
        // TODO: Infusion options merging!
        ugenDef.options = $.extend(true, {}, ugenDef.options, {
            sampleRate: sampleRate,
            rate: ugenDef.rate,
            audioSettings: {
                rates: rates
            }
        });
        // TODO: When we switch to Infusion options merging, these should have a mergePolicy of preserve.
        ugenDef.options.audioSettings.buffers = options.buffers;
        ugenDef.options.audioSettings.buses = options.buses;
        
        return flock.invoke(undefined, ugenDef.ugen, [
            parsedInputs, 
            buffer, 
            ugenDef.options
        ]);
    };


    flock.parse.reservedWords = ["id", "ugen", "rate", "inputs", "options"];
    flock.parse.specialInputs = ["value", "buffer", "table"];
    
    flock.parse.expandUGenDef = function (ugenDef) {
        var inputs = {},
            prop;
       
        // Copy any non-reserved properties from the top-level ugenDef object into the inputs property.
        for (prop in ugenDef) {
            if (flock.parse.reservedWords.indexOf(prop) === -1) {
                inputs[prop] = ugenDef[prop];
                delete ugenDef[prop];
            }
        }
        ugenDef.inputs = inputs;
    
        return ugenDef;
    };
    
    flock.parse.expandValueDef = function (ugenDef) {
        var type = typeof (ugenDef);
        if (type === "number") {
            return {
                ugen: "flock.ugen.value",
                rate: flock.rates.CONSTANT,
                inputs: {
                    value: ugenDef
                }
            };
        }
        
        if (type === "object") {
            return ugenDef;
        }
    
        throw new Error("Invalid value type found in ugen definition.");
    };

    flock.parse.rateMap = {
        "ar": flock.rates.AUDIO,
        "kr": flock.rates.CONTROL,
        "dr": flock.rates.DEMAND,
        "cr": flock.rates.CONSTANT
    };

    flock.parse.expandRate = function (ugenDef, options) {
        ugenDef.rate = options.overrideRate ? options.rate : flock.parse.rateMap[ugenDef.rate] || ugenDef.rate;
        return ugenDef;
    };

    flock.parse.ugenDef = function (ugenDefs, options) {
        var parseFn = flock.isIterable(ugenDefs) ? flock.parse.ugensForDefs : flock.parse.ugenForDef;
        var parsed = parseFn(ugenDefs, options);
        return parsed;
    };
    
    flock.parse.ugensForDefs = function (ugenDefs, options) {
        var parsed = [],
            i;
        for (i = 0; i < ugenDefs.length; i++) {
            parsed[i] = flock.parse.ugenForDef(ugenDefs[i], options);
        }
        return parsed;
    };

    /**
     * Creates a unit generator for the specified unit generator definition spec.
     *
     * ugenDefs are plain old JSON objects describing the characteristics of the desired unit generator, including:
     *      - ugen: the type of unit generator, as string (e.g. "flock.ugen.sinOsc")
     *      - rate: the rate at which the ugen should be run, either "audio", "control", or "constant"
     *      - id: an optional unique name for the unit generator, which will make it available as a synth input
     *      - inputs: a JSON object containing named key/value pairs for inputs to the unit generator
     *           OR
     *      - inputs keyed by name at the top level of the ugenDef
     * 
     * @param {UGenDef} ugenDef the unit generator definition to parse
     * @param {Object} options an options object containing:
     *           {Object} audioSettings the environment's audio settings
     *           {Array} buses the environment's global buses
     *           {Array} buffers the environment's global buffers
     *           {Array of Functions} visitors an optional list of visitor functions to invoke when the ugen has been created
     * @return the parsed unit generator object
     */
    flock.parse.ugenForDef = function (ugenDef, options) {
        options = $.extend(true, {
            audioSettings: flock.enviro.shared.options.audioSettings,
            buses: flock.enviro.shared.buses,
            buffers: flock.enviro.shared.buffers
        }, options);
        
        var o = options,
            visitors = o.visitors,
            rates = o.audioSettings.rates;
        
        // If we receive a plain scalar value, expand it into a value ugenDef.
        ugenDef = flock.parse.expandValueDef(ugenDef);
        
        // We received an array of ugen defs.
        if (flock.isIterable(ugenDef)) {
            return flock.parse.ugensForDefs(ugenDef, options);
        }
    
        if (!ugenDef.inputs) {
            ugenDef = flock.parse.expandUGenDef(ugenDef);
        }
        
        flock.parse.expandRate(ugenDef, options);
    
        // Merge the ugenDef with default values defined by the ugen itself.
        // TODO: Infusion options merging.
        var defaults = fluid.defaults(ugenDef.ugen) || {};
        // TODO: Insane!
        defaults = fluid.copy(defaults);
        defaults.options = defaults.ugenOptions;
        delete defaults.ugenOptions;
        //
        ugenDef = $.extend(true, {}, defaults, ugenDef);
        
        var inputDefs = ugenDef.inputs,
            inputs = {},
            inputDef;
        
        for (inputDef in inputDefs) {
            // Create ugens for all inputs except special inputs.
            inputs[inputDef] = flock.parse.specialInputs.indexOf(inputDef) > -1 ? 
                ugenDef.inputs[inputDef] : // Don't instantiate a ugen, just pass the def on as-is.
                flock.parse.ugenForDef(ugenDef.inputs[inputDef], options); // parse the ugendef and create a ugen instance.
        }
    
        if (!ugenDef.ugen) {
            throw new Error("Unit generator definition lacks a 'ugen' property; can't initialize the synth graph.");
        }
    
        var ugen = flock.parse.makeUGen(ugenDef, inputs, options);
        ugen.id = ugenDef.id;
        
        if (visitors) {
            visitors = fluid.makeArray(visitors);
            fluid.each(visitors, function (visitor) {
                visitor(ugen, ugenDef, rates);
            });
        }

        return ugen;
    };
    
    flock.parse.bufferForDef = function (bufDef, onLoad, enviro) {
        enviro = enviro || flock.enviro.shared;

        var id = bufDef.id || fluid.allocateGuid(),
            src;
            
        if (bufDef.url) {
            src = bufDef.url;
        } else if (bufDef.selector) {
            src = document.querySelector(bufDef.selector).files[0];
        }
        
        enviro.loadBuffer(id, src, onLoad);
    };

}());
