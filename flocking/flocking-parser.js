/*
* Flocking Parser
* http://github.com/colinbdclark/flocking
*
* Copyright 2011-2014, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*global require, Float32Array*/
/*jshint white: false, newcap: true, regexp: true, browser: true,
    forin: false, nomen: true, bitwise: false, maxerr: 100,
    indent: 4, plusplus: false, curly: true, eqeqeq: true,
    freeze: true, latedef: true, noarg: true, nonew: true, quotmark: double, undef: true,
    unused: true, strict: true, asi: false, boss: false, evil: false, expr: false,
    funcscope: false*/

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

        if (!flock.parse.synthDef.hasOutUGen(ugenDef)) {
            // We didn't get an out ugen specified, so we need to make one.
            ugenDef = {
                id: flock.OUT_UGEN_ID,
                ugen: "flock.ugen.valueOut",
                inputs: {
                    sources: ugenDef
                }
            };

            if (options.rate === flock.rates.AUDIO) {
                ugenDef.ugen = "flock.ugen.out";
                ugenDef.inputs.bus = 0;
                ugenDef.inputs.expand = options.audioSettings.chans;
            }
        }

        return flock.parse.ugenForDef(ugenDef, options);
    };

    flock.parse.synthDef.hasOutUGen = function (synthDef) {
        // TODO: This is hostile to third-party extension.
        return !flock.isIterable(synthDef) && (
            synthDef.id === flock.OUT_UGEN_ID ||
            synthDef.ugen === "flock.ugen.out" ||
            synthDef.ugen === "flock.ugen.valueOut"
        );
    };

    flock.parse.makeUGen = function (ugenDef, parsedInputs, options) {
        var rates = options.audioSettings.rates,
            blockSize = options.audioSettings.blockSize;

        // Assume audio rate if no rate was specified by the user.
        if (!ugenDef.rate) {
            ugenDef.rate = flock.rates.AUDIO;
        }

        var sampleRate;
        // Set the ugen's sample rate value according to the rate the user specified.
        if (ugenDef.options && ugenDef.options.sampleRate !== undefined) {
            sampleRate = ugenDef.options.sampleRate;
        } else {
            sampleRate = rates[ugenDef.rate];
        }

        // TODO: Infusion options merging!
        ugenDef.options = $.extend(true, {}, ugenDef.options, {
            sampleRate: sampleRate,
            rate: ugenDef.rate,
            audioSettings: {
                rates: rates,
                blockSize: blockSize
            }
        });
        // TODO: When we switch to Infusion options merging, these should have a mergePolicy of preserve.
        ugenDef.options.audioSettings.buffers = options.buffers;
        ugenDef.options.audioSettings.buses = options.buses;

        var outputBufferSize = ugenDef.rate === flock.rates.AUDIO ? blockSize : 1,
            outputBuffers;

        if (flock.hasTag(ugenDef.options, "flock.ugen.multiChannelOutput")) {
            var numOutputs = ugenDef.options.numOutputs || 1;
            outputBuffers = [];

            for (var i = 0; i < numOutputs; i++) {
                outputBuffers.push(new Float32Array(outputBufferSize));
            }
        } else {
            outputBuffers = new Float32Array(outputBufferSize);
        }

        return flock.invoke(undefined, ugenDef.ugen, [
            parsedInputs,
            outputBuffers,
            ugenDef.options
        ]);
    };


    flock.parse.reservedWords = ["id", "ugen", "rate", "inputs", "options"];
    flock.parse.specialInputs = ["value", "buffer", "list", "table", "envelope"];

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

    flock.parse.ugenDefForConstantValue = function (value) {
        return {
            ugen: "flock.ugen.value",
            rate: flock.rates.CONSTANT,
            inputs: {
                value: value
            }
        };
    };

    flock.parse.expandValueDef = function (ugenDef) {
        var type = typeof (ugenDef);
        if (type === "number") {
            return flock.parse.ugenDefForConstantValue(ugenDef);
        }

        if (type === "object") {
            return ugenDef;
        }

        throw new Error("Invalid value type found in ugen definition. UGenDef was: " +
            fluid.prettyPrintJSON(ugenDef));
    };

    flock.parse.rateMap = {
        "ar": flock.rates.AUDIO,
        "kr": flock.rates.CONTROL,
        "sr": flock.rates.SCHEDULED,
        "dr": flock.rates.DEMAND,
        "cr": flock.rates.CONSTANT
    };

    flock.parse.expandRate = function (ugenDef, options) {
        ugenDef.rate = flock.parse.rateMap[ugenDef.rate] || ugenDef.rate;
        if (options.overrideRate && ugenDef.rate !== flock.rates.CONSTANT) {
            ugenDef.rate = options.rate;
        }

        return ugenDef;
    };

    flock.parse.ugenDef = function (ugenDefs, options) {
        var parseFn = flock.isIterable(ugenDefs) ? flock.parse.ugensForDefs : flock.parse.ugenForDef;
        var parsed = parseFn(ugenDefs, options);
        return parsed;
    };

    flock.parse.ugenDef.mergeOptions = function (ugenDef) {
        // TODO: Infusion options merging.
        var defaults = fluid.defaults(ugenDef.ugen) || {};

        // TODO: Insane!
        defaults = fluid.copy(defaults);
        defaults.options = defaults.ugenOptions;
        delete defaults.ugenOptions;
        //

        return $.extend(true, {}, defaults, ugenDef);
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
        ugenDef = flock.parse.ugenDef.mergeOptions(ugenDef, options);

        var inputDefs = ugenDef.inputs,
            inputs = {},
            inputDef;

        // TODO: This notion of "special inputs" should be refactored as a pluggable system of
        // "input expanders" that are responsible for processing input definitions of various sorts.
        // In particular, buffer management should be here so that we can initialize bufferDefs more
        // proactively and remove this behaviour from flock.ugen.buffer.
        for (inputDef in inputDefs) {
            var inputDefVal = inputDefs[inputDef];

            if (inputDefVal === null) {
                continue; // Skip null inputs.
            }

            // Create ugens for all inputs except special inputs.
            inputs[inputDef] = flock.input.shouldExpand(inputDef, ugenDef) ?
                flock.parse.ugenForDef(inputDefVal, options) : // Parse the ugendef and create a ugen instance.
                inputDefVal; // Don't instantiate a ugen, just pass the def on as-is.
        }

        if (!ugenDef.ugen) {
            throw new Error("Unit generator definition lacks a 'ugen' property; " +
                "can't initialize the synth graph. Value: " + fluid.prettyPrintJSON(ugenDef));
        }

        var ugen = flock.parse.makeUGen(ugenDef, inputs, options);
        if (ugenDef.id) {
            ugen.id = ugenDef.id;
            ugen.nickName = ugenDef.id; // TODO: Normalize nicknames and ids.
        }

        ugen.options.ugenDef = ugenDef;

        if (visitors) {
            visitors = fluid.makeArray(visitors);
            fluid.each(visitors, function (visitor) {
                visitor(ugen, ugenDef, rates);
            });
        }

        return ugen;
    };

    flock.parse.expandBufferDef = function (bufDef) {
        return typeof bufDef === "string" ? {id: bufDef} :
            (flock.isIterable(bufDef) || bufDef.data || bufDef.format) ?
            flock.bufferDesc(bufDef) : bufDef;
    };

    flock.parse.bufferForDef = function (bufDef, ugen, enviro) {
        bufDef = flock.parse.expandBufferDef(bufDef);

        if (bufDef.data && bufDef.data.channels) {
            bufDef = flock.bufferDesc(bufDef);
            flock.parse.bufferForDef.resolveBuffer(bufDef, ugen, enviro);
        } else {
            flock.parse.bufferForDef.resolveDef(bufDef, ugen, enviro);
        }
    };

    flock.parse.bufferForDef.findSource = function (defOrDesc, enviro) {
        var source;

        if (enviro && defOrDesc.id) {
            source = enviro.bufferSources[defOrDesc.id];
            if (!source) {
                source = enviro.bufferSources[defOrDesc.id] = flock.bufferSource();
            }
        } else {
            source = flock.bufferSource();
        }

        return source;
    };

    flock.parse.bufferForDef.bindToPromise = function (p, source, ugen) {
        // TODO: refactor this.
        var success = function (bufDesc) {
            source.events.onBufferUpdated.addListener(success);
            if (ugen) {
                ugen.setBuffer(bufDesc);
            }
        };

        var error = function (msg) {
            if (!msg && source.model.src && source.model.src.indexOf(".aif")) {
                msg = "if this is an AIFF file, you might need to include" +
                " flocking-audiofile-compatibility.js in some browsers.";
            }
            throw new Error("Error while resolving buffer " + source.model.src + ": " + msg);
        };

        p.then(success, error);
    };

    flock.parse.bufferForDef.resolveDef = function (bufDef, ugen, enviro) {
        var source = flock.parse.bufferForDef.findSource(bufDef, enviro),
            p;

        bufDef.src = bufDef.url || bufDef.src;
        if (bufDef.selector && typeof(document) !== "undefined") {
            bufDef.src = document.querySelector(bufDef.selector).files[0];
        }

        p = source.get(bufDef);
        flock.parse.bufferForDef.bindToPromise(p, source, ugen);
    };


    flock.parse.bufferForDef.resolveBuffer = function (bufDesc, ugen, enviro) {
        var source = flock.parse.bufferForDef.findSource(bufDesc, enviro),
            p = source.set(bufDesc);

        flock.parse.bufferForDef.bindToPromise(p, source, ugen);
    };

}());
