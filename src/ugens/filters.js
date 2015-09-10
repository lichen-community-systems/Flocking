/*
 * Flocking Filters
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2011-2015, Colin Clark
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require*/
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

    var Filter = flock.requireModule("webarraymath", "Filter");

    flock.ugen.lag = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                out = that.output,
                inputs = that.inputs,
                time = inputs.time.output[0],
                source = inputs.source.output,
                prevSamp = m.prevSamp,
                lagCoef = m.lagCoef,
                i,
                j,
                currSamp,
                outVal;

            if (time !== m.prevTime) {
                m.prevtime = time;
                lagCoef = m.lagCoef = time === 0 ? 0.0 : Math.exp(flock.LOG001 / (time * m.sampleRate));
            }

            for (i = j = 0; i < numSamps; i++, j += m.strides.source) {
                currSamp = source[j];
                outVal = currSamp + lagCoef * (prevSamp - currSamp);
                out[i] = prevSamp = outVal;
            }

            m.prevSamp = prevSamp;

            that.mulAdd(numSamps);
        };

        that.onInputChanged();
        return that;
    };

    flock.ugenDefaults("flock.ugen.lag", {
        rate: "audio",
        inputs: {
            source: null,
            time: 0.1
        },
        ugenOptions: {
            strideInputs: ["source"],
            model: {
                prevSamp: 0.0,
                lagCoef: 0.0,
                prevTime: 0.0
            }
        }
    });


    /**
     * A generic FIR and IIR filter engine. You specify the coefficients, and this will do the rest.
     */
     // TODO: Unit tests.
    flock.ugen.filter = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function () {
            var m = that.model,
                out = that.output,
                inputs = that.inputs,
                q = inputs.q.output[0],
                freq = inputs.freq.output[0];

            if (m.prevFreq !== freq || m.prevQ !== q) {
                that.updateCoefficients(m, freq, q);
            }

            that.filterEngine.filter(out, that.inputs.source.output);

            m.prevQ = q;
            m.prevFreq = freq;
            m.value = m.unscaledValue = out[out.length - 1];
        };

        that.init = function () {
            var recipeOpt = that.options.recipe;
            var recipe = typeof (recipeOpt) === "string" ? flock.get(recipeOpt) : recipeOpt;

            if (!recipe) {
                throw new Error("Can't instantiate a flock.ugen.filter() without specifying a filter coefficient recipe.");
            }

            that.filterEngine = new Filter(recipe.sizes.b, recipe.sizes.a);
            that.model.coeffs = {
                a: that.filterEngine.a,
                b: that.filterEngine.b
            };

            that.updateCoefficients = flock.get(recipe, that.options.type);
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    flock.ugenDefaults("flock.ugen.filter", {
        rate: "audio",

        inputs: {
            freq: 440,
            q: 1.0,
            source: null
        }
    });

    /**
     * An optimized biquad filter unit generator.
     */
    // TODO: Unit tests.
    flock.ugen.filter.biquad = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                inputs = that.inputs,
                out = that.output,
                co = m.coeffs,
                freq = inputs.freq.output[0],
                q = inputs.q.output[0],
                source = inputs.source.output,
                i,
                w;

            if (m.prevFreq !== freq || m.prevQ !== q) {
                that.updateCoefficients(m, freq, q);
            }

            for (i = 0; i < numSamps; i++) {
                w = source[i] - co.a[0] * m.d0 - co.a[1] * m.d1;
                out[i] = co.b[0] * w + co.b[1] * m.d0 + co.b[2] * m.d1;
                m.d1 = m.d0;
                m.d0 = w;
            }

            m.prevQ = q;
            m.prevFreq = freq;
            m.value = m.unscaledValue = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged = function () {
            var typeOpt = that.options.type;
            that.updateCoefficients = typeof (typeOpt) === "string" ?
                flock.get(typeOpt) : typeOpt;
        };

        that.init = function () {
            that.model.d0 = 0.0;
            that.model.d1 = 0.0;
            that.model.coeffs = {
                a: new Float32Array(2),
                b: new Float32Array(3)
            };
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    flock.ugenDefaults("flock.ugen.filter.biquad", {
        inputs: {
            freq: 440,
            q: 1.0,
            source: null
        }
    });

    flock.ugen.filter.biquad.types = {
        "hp": {
            inputDefaults: {
                freq: 440,
                q: 1.0
            },
            options: {
                type: "flock.coefficients.butterworth.highPass"
            }
        },
        "rhp": {
            inputDefaults: {
                freq: 440,
                q: 1.0
            },
            options: {
                type: "flock.coefficients.rbj.highPass"
            }
        },
        "lp": {
            inputDefaults: {
                freq: 440,
                q: 1.0
            },
            options: {
                type: "flock.coefficients.butterworth.lowPass"
            }
        },
        "rlp": {
            inputDefaults: {
                freq: 440,
                q: 1.0
            },
            options: {
                type: "flock.coefficients.rbj.lowPass"
            }
        },
        "bp": {
            inputDefaults: {
                freq: 440,
                q: 4.0
            },
            options: {
                type: "flock.coefficients.butterworth.bandPass"
            }
        },
        "br": {
            inputDefaults: {
                freq: 440,
                q: 1.0
            },
            options: {
                type: "flock.coefficients.butterworth.bandReject"
            }
        }
    };

    // Convenience methods for instantiating common types of biquad filters.
    flock.aliasUGens("flock.ugen.filter.biquad", flock.ugen.filter.biquad.types);

    flock.coefficients = {
        butterworth: {
            sizes: {
                a: 2,
                b: 3
            },

            lowPass: function (model, freq) {
                var co = model.coeffs;
                var lambda = 1 / Math.tan(Math.PI * freq / model.sampleRate);
                var lambdaSquared = lambda * lambda;
                var rootTwoLambda = flock.ROOT2 * lambda;
                var b0 = 1 / (1 + rootTwoLambda + lambdaSquared);
                co.b[0] = b0;
                co.b[1] = 2 * b0;
                co.b[2] = b0;
                co.a[0] = 2 * (1 - lambdaSquared) * b0;
                co.a[1] = (1 - rootTwoLambda + lambdaSquared) * b0;
            },

            highPass: function (model, freq) {
                var co = model.coeffs;
                var lambda = Math.tan(Math.PI * freq / model.sampleRate);
                // Works around NaN values in cases where the frequency
                // is precisely half the sampling rate, and thus lambda
                // is Infinite.
                if (lambda === Infinity) {
                    lambda = 0;
                }
                var lambdaSquared = lambda * lambda;
                var rootTwoLambda = flock.ROOT2 * lambda;
                var b0 = 1 / (1 + rootTwoLambda + lambdaSquared);

                co.b[0] = b0;
                co.b[1] = -2 * b0;
                co.b[2] = b0;
                co.a[0] = 2 * (lambdaSquared - 1) * b0;
                co.a[1] = (1 - rootTwoLambda + lambdaSquared) * b0;
            },

            bandPass: function (model, freq, q) {
                var co = model.coeffs;
                var bw = freq / q;
                var lambda = 1 / Math.tan(Math.PI * bw / model.sampleRate);
                var theta = 2 * Math.cos(flock.TWOPI * freq / model.sampleRate);
                var b0 = 1 / (1 + lambda);

                co.b[0] = b0;
                co.b[1] = 0;
                co.b[2] = -b0;
                co.a[0] = -(lambda * theta * b0);
                co.a[1] = b0 * (lambda - 1);
            },

            bandReject: function (model, freq, q) {
                var co = model.coeffs;
                var bw = freq / q;
                var lambda = Math.tan(Math.PI * bw / model.sampleRate);
                var theta = 2 * Math.cos(flock.TWOPI * freq / model.sampleRate);
                var b0 = 1 / (1 + lambda);
                var b1 = -theta * b0;

                co.b[0] = b0;
                co.b[1] = b1;
                co.b[2] = b0;
                co.a[0] = b1;
                co.a[1] = (1 - lambda) * b0;
            }
        },

        // From Robert Brisow-Johnston's Filter Cookbook:
        // http://dspwiki.com/index.php?title=Cookbook_Formulae_for_audio_EQ_biquad_filter_coefficients
        rbj: {
            sizes: {
                a: 2,
                b: 3
            },

            lowPass: function (model, freq, q) {
                var co = model.coeffs;
                var w0 = flock.TWOPI * freq / model.sampleRate;
                var cosw0 = Math.cos(w0);
                var sinw0 = Math.sin(w0);
                var alpha = sinw0 / (2 * q);
                var oneLessCosw0 = 1 - cosw0;
                var a0 = 1 + alpha;
                var b0 = (oneLessCosw0 / 2) / a0;

                co.b[0] = b0;
                co.b[1] = oneLessCosw0 / a0;
                co.b[2] = b0;
                co.a[0] = (-2 * cosw0) / a0;
                co.a[1] = (1 - alpha) / a0;
            },

            highPass: function (model, freq, q) {
                var co = model.coeffs;
                var w0 = flock.TWOPI * freq / model.sampleRate;
                var cosw0 = Math.cos(w0);
                var sinw0 = Math.sin(w0);
                var alpha = sinw0 / (2 * q);
                var onePlusCosw0 = 1 + cosw0;
                var a0 = 1 + alpha;
                var b0 = (onePlusCosw0 / 2) / a0;

                co.b[0] = b0;
                co.b[1] = (-onePlusCosw0) / a0;
                co.b[2] = b0;
                co.a[0] = (-2 * cosw0) / a0;
                co.a[1] = (1 - alpha) / a0;
            },

            bandPass: function (model, freq, q) {
                var co = model.coeffs;
                var w0 = flock.TWOPI * freq / model.sampleRate;
                var cosw0 = Math.cos(w0);
                var sinw0 = Math.sin(w0);
                var alpha = sinw0 / (2 * q);
                var a0 = 1 + alpha;
                var qByAlpha = q * alpha;

                co.b[0] = qByAlpha / a0;
                co.b[1] = 0;
                co.b[2] = -qByAlpha / a0;
                co.a[0] = (-2 * cosw0) / a0;
                co.a[1] = (1 - alpha) / a0;
            },

            bandReject: function (model, freq, q) {
                var co = model.coeffs;
                var w0 = flock.TWOPI * freq / model.sampleRate;
                var cosw0 = Math.cos(w0);
                var sinw0 = Math.sin(w0);
                var alpha = sinw0 / (2 * q);
                var a0 = 1 + alpha;
                var ra0 = 1 / a0;
                var b1 = (-2 * cosw0) / a0;
                co.b[0] = ra0;
                co.b[1] = b1;
                co.b[2] = ra0;
                co.a[0] = b1;
                co.a[1] = (1 - alpha) / a0;
            }
        }
    };

    /**
     * A Moog-style 24db resonant low-pass filter.
     *
     * This unit generator is based on the following musicdsp snippet:
     * http://www.musicdsp.org/showArchiveComment.php?ArchiveID=26
     *
     * Inputs:
     *   - source: the source signal to process
     *   - cutoff: the cutoff frequency
     *   - resonance: the filter resonance [between 0 and 4, where 4 is self-oscillation]
     */
    // TODO: Unit tests.
    flock.ugen.filter.moog = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                inputs = that.inputs,
                out = that.output,
                source = inputs.source.output,
                sourceInc = m.strides.source,
                res = inputs.resonance.output,
                resInc = m.strides.resonance,
                cutoff = inputs.cutoff.output,
                cutoffInc = m.strides.cutoff,
                f = m.f,
                fSq = m.fSq,
                fSqSq = m.fSqSq,
                oneMinusF = m.oneMinusF,
                fb = m.fb,
                i,
                j,
                k,
                l,
                currCutoff,
                currRes,
                val;

            for (i = j = k = l = 0; i < numSamps; i++, j += sourceInc, k += resInc, l += cutoffInc) {
                currCutoff = cutoff[l];
                currRes = res[k];

                if (currCutoff !== m.prevCutoff) {
                    if (currCutoff > m.nyquistRate) {
                        currCutoff = m.nyquistRate;
                    }

                    f = m.f = (currCutoff / m.nyquistRate) * 1.16;
                    fSq = m.fSq = f * f;
                    fSqSq = m.fSqSq = fSq * fSq;
                    oneMinusF = m.oneMinusF = 1 - f;
                    m.prevRes = undefined; // Flag the need to update fb.
                }

                if (currRes !== m.prevRes) {
                    if (currRes > 4) {
                        currRes = 4;
                    } else if (currRes < 0) {
                        currRes = 0;
                    }

                    fb = m.fb = currRes * (1.0 - 0.15 * fSq);
                }

                val = source[j] - (m.out4 * fb);
                val *= 0.35013 * fSqSq;
                m.out1 = val + 0.3 * m.in1 + oneMinusF * m.out1;
                m.in1 = val;
                m.out2 = m.out1 + 0.3 * m.in2 + oneMinusF * m.out2;
                m.in2 = m.out1;
                m.out3 = m.out2 + 0.3 * m.in3 + oneMinusF * m.out3;
                m.in3 = m.out2;
                m.out4 = m.out3 + 0.3 * m.in4 + oneMinusF * m.out4;
                m.in4 = m.out3;
                out[i] = m.out4;
            }

            m.unscaledValue = m.out4;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged();
        return that;
    };

    flock.ugenDefaults("flock.ugen.filter.moog", {
        rate: "audio",
        inputs: {
            cutoff: 3000,
            resonance: 3.99,
            source: null
        },
        ugenOptions: {
            model: {
                in1: 0.0,
                in2: 0.0,
                in3: 0.0,
                in4: 0.0,
                out1: 0.0,
                out2: 0.0,
                out3: 0.0,
                out4: 0.0,
                prevCutoff: undefined,
                prevResonance: undefined,
                f: undefined,
                fSq: undefined,
                fSqSq: undefined,
                oneMinusF: undefined,
                fb: undefined,
                unscaledValue: 0.0,
                value: 0.0
            },
            strideInputs: ["source", "cutoff", "resonance"]
        }
    });

    flock.ugen.delay = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                inputs = that.inputs,
                out = that.output,
                source = inputs.source.output,
                time = inputs.time.output[0],
                delayBuffer = that.delayBuffer,
                i,
                val;

            if (time !== m.time) {
                m.time = time;
                m.delaySamps = time * that.model.sampleRate;
            }

            for (i = 0; i < numSamps; i++) {
                if (m.pos >= m.delaySamps) {
                    m.pos = 0;
                }
                out[i] = val = delayBuffer[m.pos];
                delayBuffer[m.pos] = source[i];
                m.pos++;
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged = function (inputName) {
            flock.onMulAddInputChanged(that);

            if (!inputName || inputName === "maxTime") {
                var delayBufferLength = that.model.sampleRate * that.inputs.maxTime.output[0];
                that.delayBuffer = new Float32Array(delayBufferLength);
            }
        };

        that.onInputChanged();
        return that;
    };

    flock.ugenDefaults("flock.ugen.delay", {
        rate: "audio",
        inputs: {
            maxTime: 1.0,
            time: 1.0,
            source: null
        },
        ugenOptions: {
            model: {
                pos: 0,
                unscaledValue: 0.0,
                value: 0.0
            }
        }
    });


    // Simple optimised delay for exactly 1 sample
    flock.ugen.delay1 = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                inputs = that.inputs,
                out = that.output,
                source = inputs.source.output,
                prevVal = m.prevVal,
                i,
                val;

            for (i = 0; i < numSamps; i++) {
                out[i] = val = prevVal;
                prevVal = source[i];
            }

            m.prevVal = prevVal;
            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged = function () {
            flock.onMulAddInputChanged(that);
        };

        that.onInputChanged();
        return that;
    };

    flock.ugenDefaults("flock.ugen.delay1", {
        rate: "audio",
        inputs: {
            source: null
        },
        ugenOptions: {
            model: {
                prevVal: 0.0,
                unscaledValue: 0.0,
                value: 0.0
            }
        }
    });


    flock.ugen.freeverb = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);
        that.tunings = that.options.tunings;
        that.allpassTunings = that.options.allpassTunings;

        that.gen = function (numSamps) {
            var m = that.model,
                inputs = that.inputs,
                out = that.output,
                source = inputs.source.output,
                mix = inputs.mix.output[0],
                dry = 1 - mix,
                roomsize = inputs.room.output[0],
                room_scaled = roomsize * 0.28 + 0.7,
                damp = inputs.damp.output[0],
                damp1 = damp * 0.4,
                damp2 = 1.0 - damp1,
                i,
                j,
                val;

            for (i = 0; i < numSamps; i++) {
                // read inputs
                var inp = source[i];
                var inp_scaled = inp * 0.015;

                // read samples from the allpasses
                for (j = 0; j < that.buffers_a.length; j++) {
                    if (++that.bufferindices_a[j] === that.allpassTunings[j]) {
                        that.bufferindices_a[j] = 0;
                    }
                    that.readsamp_a[j] = that.buffers_a[j][that.bufferindices_a[j]];
                }

                // foreach comb buffer, we perform same filtering (only bufferlen differs)
                for (j = 0; j < that.buffers_c.length; j++) {
                    if (++that.bufferindices_c[j] === that.tunings[j]) {
                        that.bufferindices_c[j] = 0;
                    }
                    var bufIdx_c = that.bufferindices_c[j],
                        readsamp_c = that.buffers_c[j][bufIdx_c];
                    that.filterx_c[j] = (damp2 * that.filtery_c[j]) + (damp1 * that.filterx_c[j]);
                    that.buffers_c[j][bufIdx_c] = inp_scaled + (room_scaled * that.filterx_c[j]);
                    that.filtery_c[j] = readsamp_c;
                }

                // each allpass is handled individually,
                // with different calculations made and stored into the delaylines
                var ftemp8 = (that.filtery_c[6] + that.filtery_c[7]);

                that.buffers_a[3][that.bufferindices_a[3]] = ((((0.5 * that.filterx_a[3]) + that.filtery_c[0]) +
                    (that.filtery_c[1] + that.filtery_c[2])) +
                    ((that.filtery_c[3] + that.filtery_c[4]) + (that.filtery_c[5] + ftemp8)));
                that.filterx_a[3] = that.readsamp_a[3];
                that.filtery_a[3] = (that.filterx_a[3] - (((that.filtery_c[0] + that.filtery_c[1]) +
                    (that.filtery_c[2] + that.filtery_c[3])) +
                    ((that.filtery_c[4] + that.filtery_c[5]) + ftemp8)));
                that.buffers_a[2][that.bufferindices_a[2]] = ((0.5 * that.filterx_a[2]) + that.filtery_a[3]);
                that.filterx_a[2] = that.readsamp_a[2];
                that.filtery_a[2] = (that.filterx_a[2] - that.filtery_a[3]);

                that.buffers_a[1][that.bufferindices_a[1]] = ((0.5 * that.filterx_a[1]) + that.filtery_a[2]);
                that.filterx_a[1] = that.readsamp_a[1];
                that.filtery_a[1] = (that.filterx_a[1] - that.filtery_a[2]);

                that.buffers_a[0][that.bufferindices_a[0]] = ((0.5 * that.filterx_a[0]) + that.filtery_a[1]);
                that.filterx_a[0] = that.readsamp_a[0];
                that.filtery_a[0] = (that.filterx_a[0] - that.filtery_a[1]);
                val = ((dry * inp) + (mix * that.filtery_a[0]));
                out[i] = val;
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.initDelayLines = function () {
            // Initialise the delay lines
            that.buffers_c = new Array(8);
            that.bufferindices_c = new Int32Array(8);
            that.filterx_c = new Float32Array(8);
            that.filtery_c = new Float32Array(8);
            var spread = that.model.spread;
            var i, j;
            for(i = 0; i < that.buffers_c.length; i++) {
                that.buffers_c[i] = new Float32Array(that.tunings[i]+spread);
                that.bufferindices_c[i] = 0;
                that.filterx_c[i] = 0;
                that.filtery_c[i] = 0;
                for(j = 0; j < that.tunings[i]+spread; j++) {
                    that.buffers_c[i][j] = 0;
                }
            }
            that.buffers_a = new Array(4);
            that.bufferindices_a = new Int32Array(4);
            that.filterx_a = new Float32Array(4);
            that.filtery_a = new Float32Array(4);
            // "readsamp" vars are temporary values read back from the delay lines,
            // not stored but only used in the gen loop
            that.readsamp_a = new Float32Array(4);
            for (i = 0; i < that.buffers_a.length; i++) {
                that.bufferindices_a[i] = 0;
                that.filterx_a[i] = 0;
                that.filtery_a[i] = 0;
                that.readsamp_a[i] = 0;
                // TODO is this what the spread is meant to do?
                for (j = 0; j < that.allpassTunings.length; j++) {
                    that.allpassTunings[j] += spread;
                }
                that.buffers_a[i] = new Float32Array(that.allpassTunings[i]);
                for (j = 0; j < that.allpassTunings[i]; j++) {
                    that.buffers_a[i][j] = 0;
                }
            }
        };

        that.init = function () {
            that.initDelayLines();
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    flock.ugenDefaults("flock.ugen.freeverb", {
        rate: "audio",
        inputs: {
            source: null,
            mix: 0.33,
            room: 0.5,
            damp: 0.5
        },
        ugenOptions: {
            model: {
                spread: 0,
                unscaledValue: 0.0,
                value: 0.0
            },

            tunings: [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617],
            allpassTunings: [556, 441, 341, 225]
        }
    });

    
    flock.ugen.decay = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                inputs = that.inputs,
                out = that.output,
                source = inputs.source.output,
                time = inputs.time.output[0],
                i,
                val;

            if (time !== m.time) {
                m.time = time;
                m.coeff = time === 0.0 ? 0.0 : Math.exp(flock.LOG001 / (time * that.model.sampleRate));
            }

            // TODO: Optimize this conditional.
            if (m.coeff === 0.0) {
                for (i = 0; i < numSamps; i++) {
                    out[i] = val = source[i];
                }
            } else {
                for (i = 0; i < numSamps; i++) {
                    m.lastSamp = source[i] + m.coeff * m.lastSamp;
                    out[i] = val = m.lastSamp;
                }
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged();
        return that;
    };

    flock.ugenDefaults("flock.ugen.decay", {
        rate: "audio",
        inputs: {
            source: null,
            time: 1.0
        },
        ugenOptions: {
            model: {
                time: 0,
                lastSamp: 0,
                coeff: 0,
                value: 0.0
            }
        }
    });

}());
