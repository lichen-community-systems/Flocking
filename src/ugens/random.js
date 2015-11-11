/*
 * Flocking Random Unit Generators
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

    var Random = flock.requireModule("Random");

    flock.ugen.dust = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                out = that.output,
                density = inputs.density.output[0], // Density is kr.
                threshold,
                scale,
                rand,
                val,
                i;

            if (density !== m.density) {
                m.density = density;
                threshold = m.threshold = density * m.sampleDur;
                scale = m.scale = threshold > 0.0 ? 1.0 / threshold : 0.0;
            } else {
                threshold = m.threshold;
                scale = m.scale;
            }

            for (i = 0; i < numSamps; i++) {
                rand = Math.random();
                val = (rand < threshold) ? rand * scale : 0.0;
                out[i] = val;
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged();
        return that;
    };

    flock.ugenDefaults("flock.ugen.dust", {
        rate: "audio",
        inputs: {
            density: 1.0,
            mul: null,
            add: null
        },
        ugenOptions: {
            model: {
                density: 0.0,
                scale: 0.0,
                threshold: 0.0,
                unscaledValue: 0.0,
                value: 0.0
            }
        }
    });


    flock.ugen.whiteNoise = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                out = that.output,
                i,
                val;

            for (i = 0; i < numSamps; i++) {
                out[i] = val = flock.randomAudioValue();
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged();
        return that;
    };

    flock.ugenDefaults("flock.ugen.whiteNoise", {
        rate: "audio",
        inputs: {
            mul: null,
            add: null
        }
    });


    /**
     * Implements Larry Tramiel's first Pink Noise algorithm
     * described at http://home.earthlink.net/~ltrammell/tech/pinkalg.htm,
     * based on a version by David Lowenfels posted to musicdsp:
     * http://www.musicdsp.org/showone.php?id=220.
     */
    flock.ugen.pinkNoise = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                state = m.state,
                a = that.a,
                p = that.p,
                offset = m.offset,
                out = that.output,
                i,
                j,
                rand,
                val;

            for (i = 0; i < numSamps; i++) {
                val = 0;
                for (j = 0; j < state.length; j++) {
                    rand = Math.random();
                    state[j] = p[j] * (state[j] - rand) + rand;
                    val += a[j] * state[j];
                }
                val = val * 2 - offset;
                out[i] = val;
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.init = function () {
            that.a = new Float32Array(that.options.coeffs.a);
            that.p = new Float32Array(that.options.coeffs.p);
            that.model.state = new Float32Array(that.a.length);

            for (var i = 0; i < that.a.length; i++) {
                that.model.offset += that.a[i];
            }

            that.onInputChanged();
        };

        that.init();
        return that;
    };

    flock.ugenDefaults("flock.ugen.pinkNoise", {
        rate: "audio",
        inputs: {
            mul: null,
            add: null
        },
        ugenOptions: {
            model: {
                state: 0.0,
                unscaledValue: 0.0,
                value: 0.0,
                offset: 0
            },
            coeffs: {
                a: [0.02109238, 0.07113478, 0.68873558],
                p: [0.3190, 0.7756, 0.9613]
            }
        }
    });

    flock.ugen.lfNoise = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                freq = inputs.freq.output[0], // Freq is kr.
                remain = numSamps,
                out = that.output,
                currSamp = 0,
                sampsForLevel,
                i;

            freq = freq > 0.001 ? freq : 0.001;
            do {
                if (m.counter <= 0) {
                    m.counter = m.sampleRate / freq;
                    m.counter = m.counter > 1 ? m.counter : 1;
                    if (that.options.interpolation === "linear") {
                        m.start = m.unscaledValue = m.end;
                        m.end = Math.random();
                        m.ramp = m.ramp = (m.end - m.start) / m.counter;
                    } else {
                        m.start = m.unscaledValue = Math.random();
                        m.ramp = 0;
                    }
                }
                sampsForLevel = remain < m.counter ? remain : m.counter;
                remain -= sampsForLevel;
                m.counter -= sampsForLevel;
                for (i = 0; i < sampsForLevel; i++) {
                    out[currSamp] = m.unscaledValue;
                     // TODO: This reuse of "unscaledValue" will cause the model to be out of sync
                     // with the actual output of the unit generator.
                    m.unscaledValue += m.ramp;
                    currSamp++;
                }

            } while (remain);

            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.input = function () {
            that.model.end = Math.random();
            that.onInputChanged();
        };

        that.input();
        return that;
    };

    flock.ugenDefaults("flock.ugen.lfNoise", {
        rate: "audio",
        inputs: {
            freq: 440,
            mul: null,
            add: null
        },
        ugenOptions: {
            model: {
                counter: 0,
                level: 0,
                unscaledValue: 0.0,
                value: 0.0
            }
        }
    });

    /*****************************************************
     * Random distributions using Sim.js' Random library *
     *****************************************************/

    // TODO: Unit tests.
    flock.ugen.random = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                generator = that.generator,
                out = that.output,
                i,
                val;

            for (i = 0; i < numSamps; i++) {
                out[i] = val = generator.uniform(-1, 1);
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.onInputChanged = function (inputName) {
            if (inputName === "seed") {
                that.initGenerator();
            }
            flock.onMulAddInputChanged(that);
        };

        that.initGenerator = function () {
            var seed = that.inputs.seed;
            that.generator = seed ? new Random(seed) : new Random();
        };

        that.init = function () {
            that.initGenerator();
            that.calculateStrides();
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    flock.ugenDefaults("flock.ugen.random", {
        rate: "audio",
        inputs: {
            seed: null,
            mul: null,
            add: null
        }
    });

    // TODO: Unit tests.
    flock.ugen.random.exponential = function (inputs, output, options) {
        var that = flock.ugen.random(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                generator = that.generator,
                out = that.output,
                lambda = that.inputs.lambda.output,
                lambdaInc = that.model.strides.lambda,
                i,
                j,
                val;

            for (i = j = 0; i < numSamps; i++, j += lambdaInc) {
                out[i] = val = generator.exponential(lambda[j]);
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        return that;
    };

    flock.ugenDefaults("flock.ugen.random.exponential", {
        rate: "audio",
        inputs: {
            seed: null,
            lambda: 1,
            mul: null,
            add: null
        },

        ugenOptions: {
            strideInputs: ["lambda"]
        }
    });

    // TODO: Unit tests.
    flock.ugen.random.gamma = function (inputs, output, options) {
        var that = flock.ugen.random(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                inputs = that.inputs,
                generator = that.generator,
                out = that.output,
                alphaInc = m.strides.alpha,
                alpha = inputs.alpha.output,
                betaInc = m.strides.beta,
                beta = inputs.beta.output,
                i,
                j,
                k,
                val;

            for (i = j = k = 0; i < numSamps; i++, j += alphaInc, k += betaInc) {
                out[i] = val = generator.gamma(alpha[j], beta[k]);
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        return that;
    };

    flock.ugenDefaults("flock.ugen.random.gamma", {
        rate: "audio",
        inputs: {
            seed: null,
            alpha: 1,
            beta: 2,
            mul: null,
            add: null
        },

        ugenOptions: {
            strideInputs: ["alpha", "beta"]
        }
    });

    // TODO: Unit tests.
    flock.ugen.random.normal = function (inputs, output, options) {
        var that = flock.ugen.random(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                out = that.output,
                inputs = that.inputs,
                generator = that.generator,
                muInc = m.strides.mu,
                mu = inputs.mu.output,
                sigmaInc = m.strides.sigma,
                sigma = inputs.sigma.output,
                i,
                j,
                k,
                val;

            for (i = j = k = 0; i < numSamps; i++, j += muInc, k += sigmaInc) {
                out[i] = val = generator.normal(mu[j], sigma[k]);
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        return that;
    };

    flock.ugenDefaults("flock.ugen.random.normal", {
        rate: "audio",
        inputs: {
            seed: null,
            mu: 0,
            sigma: 1,
            mul: null,
            add: null
        },

        ugenOptions: {
            strideInputs: ["mu", "sigma"]
        }
    });

    // TODO: Unit tests.
    flock.ugen.random.pareto = function (inputs, output, options) {
        var that = flock.ugen.random(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                generator = that.generator,
                out = that.output,
                alphaInc = that.model.strides.alpha,
                alpha = that.inputs.alpha.output,
                i,
                j,
                val;

            for (i = j = 0; i < numSamps; i++, j += alphaInc) {
                out[i] = val = generator.pareto(alpha[j]);
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        return that;
    };

    flock.ugenDefaults("flock.ugen.random.pareto", {
        rate: "audio",
        inputs: {
            seed: null,
            alpha: 5,
            mul: null,
            add: null
        },

        ugenOptions: {
            strideInputs: ["alpha"]
        }
    });

    // TODO: Unit tests.
    flock.ugen.random.triangular = function (inputs, output, options) {
        var that = flock.ugen.random(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                generator = that.generator,
                out = that.output,
                modeInc = that.model.strides.mode,
                mode = that.inputs.mode.output,
                i,
                j,
                val;

            for (i = j = 0; i < numSamps; i++, j += modeInc) {
                out[i] = val = generator.triangular(-1, 1, mode[j]);
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        return that;
    };

    flock.ugenDefaults("flock.ugen.random.triangular", {
        rate: "audio",
        inputs: {
            seed: null,
            mode: 0.5,
            mul: null,
            add: null
        },

        ugenOptions: {
            strideInputs: ["mode"]
        }
    });

    // TODO: Unit tests.
    flock.ugen.random.weibull = function (inputs, output, options) {
        var that = flock.ugen.random(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                inputs = that.inputs,
                generator = that.generator,
                out = that.output,
                alphaInc = m.strides.alpha,
                alpha = inputs.alpha.output,
                betaInc = m.strides.beta,
                beta = inputs.beta.output,
                i,
                j,
                k,
                val;

            for (i = j = k = 0; i < numSamps; i++, j += alphaInc, k += betaInc) {
                out[i] = val = generator.weibull(alpha[j], beta[k]);
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        return that;
    };

    flock.ugenDefaults("flock.ugen.random.weibull", {
        rate: "audio",
        inputs: {
            seed: null,
            alpha: 1,
            beta: 1,
            mul: null,
            add: null
        },

        ugenOptions: {
            strideInputs: ["alpha", "beta"]
        }
    });

}());
