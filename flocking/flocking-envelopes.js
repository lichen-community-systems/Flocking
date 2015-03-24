/*
* Flocking Envelopes
* http://github.com/colinbdclark/flocking
*
* Copyright 2011-2014, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*global require, DSP*/
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

    /*********************
     * Envelope Creators *
     *********************/

    flock.envelope = {};

    // Unsupported API.
    flock.envelope.makeCreator = function (name, envelopeOptionsTransformer) {
        return function (options) {
            var defaults = fluid.defaults(name),
                merged = $.extend(true, {}, defaults, options);

            return envelopeOptionsTransformer(merged);
        };
    };

    // Unsupported API.
    flock.envelope.registerCreators = function (inNamespace, creatorSpecs) {
        var path, creatorSpec;

        for (var pathSuffix in creatorSpecs) {
            path = fluid.pathUtil.composePath(inNamespace, pathSuffix);
            creatorSpec = creatorSpecs[pathSuffix];

            fluid.defaults(path, creatorSpec.defaults);
            fluid.setGlobalValue(path, flock.envelope.makeCreator(path, creatorSpec.transformer));
        }
    };

    // Unsupported API.
    flock.envelope.creatorSpecs = {
        line: {
            transformer: function (o) {
                return {
                    levels: [o.start, o.end],
                    times: [o.duration]
                };
            },

            defaults: {
                start: 0.0,
                end: 1.0,
                duration: 1.0
            }
        },

        linear: {
            transformer: function (o) {
                return {
                    levels: [0, o.level, o.level, 0],
                    times: [o.attack, o.sustain, o.release]
                };
            },

            defaults: {
                level: 1.0,
                attack: 0.01,
                sustain: 1.0,
                release: 1.0
            }
        },

        tri: {
            transformer: function (o) {
                return {
                    levels: [0, o.level, 0],
                    times: [o.duration, o.duration]
                };
            },

            defaults: {
                level: 1.0,
                duration: 1.0
            }
        },

        sin: {
            transformer: function (o) {
                return {
                    levels: [0, o.level, 0],
                    times: [o.duration, o.duration],
                    curve: "sin"
                };
            },

            defaults: {
                level: 1.0,
                duration: 1.0
            }
        },

        asr: {
            transformer: function (o) {
                return {
                    levels: [0, o.sustain, 0],
                    times: [o.attack, o.release],
                    sustainPoint: 1,
                    curve: -4.0
                };
            },

            defaults: {
                sustain: 1.0,
                attack: 0.01,
                release: 1.0
            }
        },

        dadsr: {
            transformer: function (o) {
                var levels = [0, 0, o.peak, o.peak * o.sustain, 0];
                DSP.add(levels, levels, o.bias);

                return {
                    levels: levels,
                    times: [o.delay, o.attack, o.decay, o.release],
                    sustainPoint: 3,
                    curve: -4.0
                };
            },

            defaults: {
                delay: 0.1,
                attack: 0.01,
                decay: 0.3,
                sustain: 0.5,
                release: 1.0,
                peak: 1.0,
                bias: 0.0
            }
        },

        adsr: {
            transformer: function (o) {
                var levels = [0, o.peak, o.peak * o.sustain, 0];
                DSP.add(levels, levels, o.bias);

                return {
                    levels: levels,
                    times: [o.attack, o.decay, o.release],
                    sustainPoint: 2,
                    curve: -4.0
                };
            },

            defaults: {
                attack: 0.01,
                decay: 0.3,
                sustain: 0.5,
                release: 1.0,
                peak: 1.0,
                bias: 0.0
            }
        }
    };

    flock.envelope.registerCreators("flock.envelope", flock.envelope.creatorSpecs);

    flock.envelope.validate = function (envelope, failOnError) {
        var levels = envelope.levels,
            report = {};

        if (!envelope.times) {
            report.times = "An array containing at least one time value must be specified.";
        } else if (!levels || levels.length < 2) {
            report.levels = "An array containing at least two levels must be specified.";
        } else {
            flock.envelope.validate.times(envelope.times, levels, report);
            flock.envelope.validate.levels(levels, report);
            flock.envelope.validate.curves(envelope.curve, levels, report);
            flock.envelope.validate.sustainPoint(envelope.sustainPoint, levels, report);
        }

        if (failOnError !== false) {
            for (var errorProp in report) {
                flock.fail(report[errorProp]);
            }
        }

        return report;
    };

    flock.envelope.validate.times = function (times, levels, report) {
        if (times.length !== levels.length - 1) {
            report.times = "The envelope specification should provide one fewer time value " +
                "than the number of level values. times: " + times + " levels: " + levels;
        }

        for (var i = 0; i < times.length; i++) {
            var time = times[i];

            if (isNaN(time)) {
                report.times = "A NaN time value was specified at index " +
                    i + ". times: " + times;
            }

            if (time < 0) {
                report.times = "All times should be positive values. times: " + times;
            }
        }
    };

    flock.envelope.validate.levels = function (levels, report) {
        for (var i = 0; i < levels.length; i++) {
            if (isNaN(levels[i])) {
                report.levels = "A NaN level value was specified at index " +
                    i + ". levels: " + levels;
            }
        }
    };

    flock.envelope.validate.curves = function (curve, levels, report) {
        if (!curve) {
            return report;
        }

        if (flock.isIterable(curve)) {
            if (curve.length !== levels.length - 1) {
                report.curve = "When curve is specified as an array, " +
                    "there should be one fewer curve value " +
                    "than the number of level values. curve: " +
                    curve + " levels: " + levels;
            }

            fluid.each(curve, function (curveName) {
                var lineGen = flock.line.generator(curveName);
                if (!lineGen) {
                    report.curve = "'" + curveName + "' is not a valid curve type. curve: " + curve;
                }
            });
        }

        var lineGen = flock.line.generator(curve);
        if (!lineGen) {
            report.curve = "'" + curve + "' is not a valid curve type.";
        }
    };

    flock.envelope.validate.sustainPoint = function (sustainPoint, levels, report) {
        if (sustainPoint < 0 || sustainPoint >= levels.length) {
            report.sustainPoint = "The specified sustainPoint index is out range for the levels array. " +
                "sustainPoint: " + sustainPoint + " levels: " + levels;
        }
    };

    /**
     * Takes an envelope specification and expands it,
     * producing an envelope object.
     */
    flock.envelope.expand = function (envSpec) {
        var envelope = typeof envSpec === "string" ? fluid.invokeGlobalFunction(envSpec) :
            envSpec.type ? fluid.invokeGlobalFunction(envSpec.type, [envSpec]) : envSpec;

        // Catch a common naming mistake and alias it to the correct name.
        if (envelope.curves && !envelope.curve) {
            envelope.curve = envelope.curves;
        }

        if (!flock.isIterable(envelope.curve)) {
            var numCurves = envelope.levels.length - 1;
            envelope.curve = flock.generate(new Array(numCurves), envelope.curve);
        }

        flock.envelope.validate(envelope, true);

        return envelope;
    };


    /****************************
     * Line Generator Functions *
     ****************************/

    flock.line = {
        // TODO: Unit tests!
        // e.g. flock.line.fill("linear", new Float32Array(64), 0, 1);
        fill: function (type, buffer, start, end, startIdx, endIdx) {
            startIdx = startIdx === undefined ? 0 : startIdx;
            endIdx = endIdx === undefined ? buffer.length : endIdx;

            var numSamps = endIdx - startIdx,
                m = flock.line.fill.model;

            m.unscaledValue = start;
            m.destination = end;
            m.numSegmentSamps = numSamps - 1;

            if (typeof type === "number") {
                m.currentCurve = type;
                type = "curve";
            }

            var generator = flock.line[type];
            if (!generator) {
                flock.fail("No line generator could be found for type " + type);
            }
            generator.init(m);

            return generator.gen(numSamps, startIdx, buffer, m);
        },

        generator: function (curve) {
            var type = typeof curve;

            return type === "string" ? flock.line[curve] :
                type === "number" ? flock.line.curve : flock.line.linear;
        },

        constant: {
            init: function (m) {
                m.stepSize = 0;
            },

            gen: function (numSamps, idx, buffer, m) {
                var val = m.unscaledValue;
                for (var i = idx; i < numSamps + idx; i++) {
                    buffer[i] = val;
                }

                return buffer;
            }
        },

        step: {
            init: function (m) {
                m.arrived = false;
            },

            gen: function (numSamps, idx, buffer, m) {
                for (var i = idx; i < numSamps + idx; i++) {
                    buffer[i] = m.unscaledValue;
                    if (!m.arrived) {
                        m.arrived = true;
                        m.unscaledValue = m.destination;
                    }
                }

                return buffer;
            }
        },

        linear: {
            init: function (m) {
                m.stepSize = (m.destination - m.unscaledValue) / m.numSegmentSamps;
            },

            gen: function (numSamps, idx, buffer, m) {
                var val = m.unscaledValue,
                    stepSize = m.stepSize;

                for (var i = idx; i < numSamps + idx; i++) {
                    buffer[i] = val;
                    val += stepSize;
                }

                m.unscaledValue = val;
                m.stepSize = stepSize;

                return buffer;
            }
        },

        exponential: {
            init: function (m) {
                if (m.unscaledValue === 0) {
                    m.unscaledValue = 0.0000000000000001;
                }
                m.stepSize = m.numSegmentSamps === 0 ? 0 :
                    Math.pow(m.destination / m.unscaledValue, 1.0 / m.numSegmentSamps);
            },

            gen: function (numSamps, idx, buffer, m) {
                var val = m.unscaledValue,
                    stepSize = m.stepSize;

                for (var i = idx; i < numSamps + idx; i++) {
                    buffer[i] = val;
                    val *= stepSize;
                }

                m.unscaledValue = val;
                m.stepSize = stepSize;

                return buffer;
            }
        },

        curve: {
            init: function (m) {
                if (Math.abs(m.currentCurve) < 0.001) {
                    // A curve value this small might as well be linear.
                    return flock.line.linear.init(m);
                } else {
                    var a1 = (m.destination - m.unscaledValue) / (1.0 - Math.exp(m.currentCurve));
                    m.a2 = m.unscaledValue + a1;
                    m.b1 = a1;
                    m.stepSize = Math.exp(m.currentCurve / m.numSegmentSamps);
                }
            },

            gen: function (numSamps, idx, buffer, m) {
                var val = m.unscaledValue,
                    b1 = m.b1;

                for (var i = idx; i < numSamps + idx; i++) {
                    buffer[i] = val;
                    b1 *= m.stepSize;
                    val = m.a2 - b1;
                }

                m.unscaledValue = val;
                m.b1 = b1;

                return buffer;
            }
        },

        sin: {
            init: function (m) {
                var w = Math.PI / m.numSegmentSamps;
                m.a2 = (m.destination + m.unscaledValue) * 0.5;
                m.b1 = 2.0 * Math.cos(w);
                m.y1 = (m.destination - m.unscaledValue) * 0.5;
                m.y2 = m.y1 * Math.sin(flock.HALFPI - w);
                m.unscaledValue = m.a2 - m.y1;
            },

            gen: function (numSamps, idx, buffer, m) {
                var val = m.unscaledValue,
                    y1 = m.y1,
                    y2 = m.y2,
                    y0;

                for (var i = idx; i < numSamps + idx; i++) {
                    buffer[i] = val;
                    y0 = m.b1 * y1 - y2;
                    val = m.a2 - y0;
                    y2 = y1;
                    y1 = y0;
                }

                m.unscaledValue = val;
                m.y1 = y1;
                m.y2 = y2;

                return buffer;
            }
        },

        welsh: {
            init: function (m) {
                var w = flock.HALFPI / m.numSegmentSamps,
                    cosW = Math.cos(w);

                m.b1 = 2.0 * cosW;

                if (m.destination >= m.unscaledValue) {
                    m.a2 = m.unscaledValue;
                    m.y1 = 0.0;
                    m.y2 = -Math.sin(w) * (m.destination - m.unscaledValue);
                } else {
                    m.a2 = m.destination;
                    m.y1 = m.unscaledValue - m.destination;
                    m.y2 = cosW * (m.unscaledValue - m.destination);
                }

                m.unscaledValue = m.a2 + m.y1;
            },

            gen: function (numSamps, idx, buffer, m) {
                var val = m.unscaledValue,
                    y1 = m.y1,
                    y2 = m.y2,
                    y0;

                for (var i = idx; i < numSamps + idx; i++) {
                    buffer[i] = val;
                    y0 = m.b1 * y1 - y2;
                    y2 = y1;
                    y1 = y0;
                    val = m.a2 + y0;
                }

                m.unscaledValue = val;
                m.y1 = y1;
                m.y2 = y2;

                return buffer;
            }
        },

        squared: {
            init: function (m) {
                m.y1 = Math.sqrt(m.unscaledValue);
                m.y2 = Math.sqrt(m.destination);
                m.stepSize = (m.y2 - m.y1) / m.numSegmentSamps;
            },

            gen: function (numSamps, idx, buffer, m) {
                var val = m.unscaledValue,
                    y1 = m.y1;

                for (var i = idx; i < numSamps + idx; i++) {
                    buffer[i] = val;
                    y1 += m.stepSize;
                    val = y1 * y1;
                }

                m.y1 = y1;
                m.unscaledValue = val;

                return buffer;
            }
        },

        cubed: {
            init: function (m) {
                var third = 0.3333333333333333;
                m.y1 = Math.pow(m.unscaledValue, third);
                m.y2 = Math.pow(m.destination, third);
                m.stepSize = (m.y2 - m.y1) / m.numSegmentSamps;
            },

            gen: function (numSamps, idx, buffer, m) {
                var val = m.unscaledValue,
                    y1 = m.y1;

                for (var i = idx; i < numSamps + idx; i++) {
                    buffer[i] = val;
                    y1 += m.stepSize;
                    val = y1 * y1 * y1;
                }

                m.y1 = y1;
                m.unscaledValue = val;

                return buffer;
            }
        }
    };

    // Unsupported API.
    flock.line.fill.model = {
        unscaledValue: 0.0,
        value: 0.0,
        destination: 1.0
    };

    /****************************
     * Envelope Unit Generators *
     ****************************/

    flock.ugen.line = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                stepSize = m.stepSize,
                numSteps = m.numSteps,
                numLevelVals = numSteps >= numSamps ? numSamps : numSteps,
                numEndVals = numSamps - numLevelVals,
                level = m.level,
                out = that.output,
                i;

            for (i = 0; i < numLevelVals; i++) {
                out[i] = level;
                numSteps--;
                level += stepSize;
            }

            // TODO: Implement a more efficient gen algorithm when the line has finished.
            if (numEndVals > 0) {
                for (i = 0; i < numEndVals; i++) {
                    out[i] = level;
                }
            }

            // TODO: "level" should be deprecated in favour of "unscaledValue"
            m.level = m.unscaledValue = level;
            m.numSteps = numSteps;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged = function () {
            var m = that.model;

            // Any change in input value will restart the line.
            m.start = that.inputs.start.output[0];
            m.end = that.inputs.end.output[0];
            m.numSteps = Math.round(that.inputs.duration.output[0] * m.sampleRate);
            if (m.numSteps === 0) {
                m.stepSize = 0.0;
                m.level = m.end;
            } else {
                m.stepSize = (m.end - m.start) / m.numSteps;
                m.level = m.start;
            }

            flock.onMulAddInputChanged(that);
        };

        that.onInputChanged();
        return that;
    };

    fluid.defaults("flock.ugen.line", {
        rate: "control",
        inputs: {
            start: 0.0,
            end: 1.0,
            duration: 1.0,
            mul: null,
            add: null
        },
        ugenOptions: {
            model: {
                start: 0.0,
                end: 1.0,
                numSteps: 0,
                stepSize: 0,
                level: 0.0,
                unscaledValue: 0.0,
                value: 0.0
            }
        }
    });


    flock.ugen.xLine = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                multiplier = m.multiplier,
                numSteps = m.numSteps,
                numLevelVals = numSteps >= numSamps ? numSamps : numSteps,
                numEndVals = numSamps - numLevelVals,
                level = m.level,
                out = that.output,
                i;

            for (i = 0; i < numLevelVals; i++) {
                out[i] = level;
                numSteps--;
                level *= multiplier;
            }

            // TODO: Implement a more efficient gen algorithm when the line has finished.
            if (numEndVals > 0) {
                for (i = 0; i < numEndVals; i++) {
                    out[i] = level;
                }
            }

            // TODO: "level" should be deprecated in favour of "unscaledValue"
            m.level = m.unscaledValue = level;
            m.numSteps = numSteps;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged = function () {
            var m = that.model;

            flock.onMulAddInputChanged(that);

            // Any change in input value will restart the line.
            m.start = that.inputs.start.output[0];
            if (m.start === 0.0) {
                m.start = 1e-101; // Guard against divide by zero.
            }

            m.end = that.inputs.end.output[0];
            m.numSteps = Math.round(that.inputs.duration.output[0] * m.sampleRate);
            m.multiplier = Math.pow(m.end / m.start, 1.0 / m.numSteps);
            m.level = m.start;
        };

        that.onInputChanged();
        return that;
    };

    fluid.defaults("flock.ugen.xLine", {
        rate: "control",
        inputs: {
            start: 0.0,
            end: 1.0,
            duration: 1.0,
            mul: null,
            add: null
        },
        ugenOptions: {
            model: {
                start: 0.0,
                end: 1.0,
                numSteps: 0,
                multiplier: 0,
                level: 0.0,
                unscaledValue: 0.0,
                value: 0.0
            }
        }
    });

    flock.ugen.asr = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                out = that.output,
                prevGate = m.previousGate,
                gate = that.inputs.gate.output[0],
                level = m.level,
                stage = m.stage,
                currentStep = stage.currentStep,
                stepInc = stage.stepInc,
                numSteps = stage.numSteps,
                targetLevel = m.targetLevel,
                stepsNeedRecalc = false,
                stageTime,
                i;

            // Recalculate the step state if necessary.
            if (prevGate <= 0 && gate > 0) {
                // Starting a new attack stage.
                targetLevel = that.inputs.sustain.output[0];
                stageTime = that.inputs.attack.output[0];
                stepsNeedRecalc = true;
            } else if (gate <= 0 && currentStep >= numSteps) {
                // Starting a new release stage.
                targetLevel = that.inputs.start.output[0];
                stageTime = that.inputs.release.output[0];
                stepsNeedRecalc = true;
            }

            // TODO: Can we get rid of this extra branch without introducing code duplication?
            if (stepsNeedRecalc) {
                numSteps = Math.round(stageTime * m.sampleRate);
                stepInc = (targetLevel - level) / numSteps;
                currentStep = 0;
            }

            // Output the the envelope's sample data.
            for (i = 0; i < numSamps; i++) {
                out[i] = level;
                currentStep++;
                // Hold the last value if the stage is complete, otherwise increment.
                level = currentStep < numSteps ?
                    level + stepInc : currentStep === numSteps ?
                    targetLevel : level;
            }

            // Store instance state.
            // TODO: "level" should be deprecated in favour of "unscaledValue"
            m.level = m.unscaledValue = level;
            m.targetLevel = targetLevel;
            m.previousGate = gate;
            stage.currentStep = currentStep;
            stage.stepInc = stepInc;
            stage.numSteps = numSteps;

            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.init = function () {
            var m = that.model;
            m.level = m.unscaledValue = that.inputs.start.output[0];
            m.targetLevel = that.inputs.sustain.output[0];

            that.onInputChanged();
        };

        that.init();
        return that;
    };

    fluid.defaults("flock.ugen.asr", {
        rate: "control",
        inputs: {
            start: 0.0,
            attack: 0.01,
            sustain: 1.0,
            release: 1.0,
            gate: 0.0,
            mul: null,
            add: null
        },
        ugenOptions: {
            model: {
                level: 0.0,
                targetLevel: 0.0,
                previousGate: 0.0,
                unscaledValue: 0.0,
                value: 0.0,
                stage: {
                    currentStep: 0,
                    stepInc: 0,
                    numSteps: 0
                }
            }
        }
    });

    // Included for backwards compatibility.
    // The name "flock.ugen.env.simpleASR is deprecated.
    // Please use flock.ugen.asr instead.
    // This will be removed before Flocking 1.0.
    flock.ugen.env = {};
    flock.ugen.env.simpleASR  = flock.ugen.asr;
    fluid.defaults("flock.ugen.env.simpleASR", fluid.copy(fluid.defaults("flock.ugen.asr")));

    flock.ugen.envGen = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.krGen = function (numSamps) {
            var m = that.model,
                out = that.output,
                inputs = that.inputs,
                gate = inputs.gate.output[0],
                timeScale = inputs.timeScale.output[0],
                i = 0,
                sampsToGen;

            flock.ugen.envGen.checkGate(that, gate, timeScale);

            while (i < numSamps) {
                sampsToGen = Math.min(numSamps - i, m.numSegmentSamps);
                that.lineGen.gen(sampsToGen, i, out, m);
                i += sampsToGen;
                m.numSegmentSamps -= sampsToGen;

                if (m.numSegmentSamps === 0) {
                    flock.ugen.envGen.nextStage(that, timeScale);
                }
            }

            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.arGen = function (numSamps) {
            var m = that.model,
                out = that.output,
                inputs = that.inputs,
                gate = inputs.gate.output,
                timeScale = inputs.timeScale.output[0],
                i;

            for (i = 0; i < numSamps; i++) {
                flock.ugen.envGen.checkGate(that, gate[i], timeScale);

                that.lineGen.gen(1, i, out, m);
                m.numSegmentSamps--;

                if (m.numSegmentSamps === 0) {
                    flock.ugen.envGen.nextStage(that, timeScale);
                }
            }

            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged = function (inputName) {
            if (!inputName || inputName === "envelope") {
                that.envelope = flock.ugen.envGen.initEnvelope(that, that.inputs.envelope);
            }

            if (!inputName || inputName === "gate") {
                that.gen = that.inputs.gate.rate === flock.rates.AUDIO ? that.arGen : that.krGen;
            }

            flock.onMulAddInputChanged(that);
        };

        that.onInputChanged();

        return that;
    };

    // Unsupported API.
    flock.ugen.envGen.initEnvelope = function (that, envSpec) {
        var m = that.model,
            envelope = flock.envelope.expand(envSpec);

        m.stage = 0;
        m.numStages = envelope.times.length;
        that.lineGen = flock.line.constant;

        flock.ugen.envGen.lineGenForStage(that.inputs.timeScale.output[0], envelope, m);
        m.unscaledValue = envelope.levels[m.stage];

        return envelope;
    };

    // Unsupported API.
    flock.ugen.envGen.checkGate = function (that, gate, timeScale) {
        var m = that.model,
            envelope = that.envelope;

        if (gate !== m.previousGate) {
            if (gate > 0.0 && m.previousGate <= 0.0) {
                // Gate has opened.
                m.stage = 1;
                that.lineGen = flock.ugen.envGen.lineGenForStage(timeScale, envelope, m);
            } else if (gate <= 0.0 && m.previousGate > 0) {
                // Gate has closed.
                m.stage = m.numStages;
                that.lineGen = flock.ugen.envGen.lineGenForStage(timeScale, envelope, m);
            }
        }
        m.previousGate = gate;
    };

    // Unsupported API.
    flock.ugen.envGen.nextStage = function (that, timeScale) {
        var m = that.model,
            envelope = that.envelope;

        // We've hit the end of the current transition.
        if (m.stage === envelope.sustainPoint) {
            // We're at the sustain point.
            // Output a constant value.
            that.lineGen = flock.line.constant;
            m.numSegmentSamps = Infinity;
            m.destination = m.unscaledValue;
        } else {
            // Move on to the next breakpoint stage.
            m.stage++;
            that.lineGen = flock.ugen.envGen.lineGenForStage(timeScale, envelope, m);
        }
    };

    // Unsupported API.
    flock.ugen.envGen.setupStage = function (timeScale, envelope, m) {
        var dest = envelope.levels[m.stage],
            dur,
            durSamps;

        if (m.stage === 0 || m.stage > m.numStages) {
            durSamps = Infinity;
        } else {
            dur = envelope.times[m.stage - 1] * timeScale;
            durSamps = Math.max(1, dur * m.sampleRate);
        }

        m.numSegmentSamps = durSamps;
        m.destination = dest;
    };

    // Unsupported API.
    flock.ugen.envGen.lineGenForStage = function (timeScale, envelope, m) {
        var curve = envelope.curve,
            lineGen,
            curveValue;

        if (m.stage === 0 || m.stage > m.numStages) {
            lineGen = flock.line.constant;
        } else {
            curveValue = curve[m.stage - 1];
            m.currentCurve = curveValue;
            lineGen = flock.line.generator(curveValue);
        }

        flock.ugen.envGen.setupStage(timeScale, envelope, m);
        lineGen.init(m);

        return lineGen;
    };

    fluid.defaults("flock.ugen.envGen", {
        rate: "audio",

        inputs: {
            envelope: "flock.envelope.adsr",
            gate: 0.0,
            timeScale: 1.0,     // Timescale is control-rate (or lower) only.
            mul: null,          // This is equivalent to SC's levelScale parameter.
            add: null           // And this to SC's levelBias.
        },

        ugenOptions: {
            model: {
                previousGate: 0.0,
                stepSize: 0.0,
                destination: 0.0,
                numSegmentSamps: 1.0,
                unscaledValue: 0.0,
                value: 0.0,
                stage: 0.0,
                numStages: 0.0
            }
        }
    });

}());
