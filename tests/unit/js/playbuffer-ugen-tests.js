/*!
* Flocking PlayBuffer Unit Generator Tests
* http://github.com/colinbdclark/flocking
*
* Copyright 2011-17, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require*/

var fluid = fluid || require("infusion"),
    jqUnit = jqUnit || fluid.require("node-jqunit"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    fluid.registerNamespace("flock.test");

    flock.test.registerBuffer = function (enviro, id, left, right) {
        var bufDesc = flock.bufferDesc({
            id: id,
            format: {
                sampleRate: enviro.audioSystem.model.rates.audio
            },
            data: {
                channels: right ? [left, right] : [left]
            }
        });

        // TODO: Why this instead of enviroment.registerBuffer(bufDesc)?
        flock.parse.bufferForDef.resolveBuffer(bufDesc, undefined, enviro);
    };

    fluid.registerNamespace("flock.test.ugen.playBuffer");

    fluid.defaults("flock.test.bufferEnviro", {
        gradeNames: "flock.silentEnviro",

        listeners: {
            "onCreate.registerAscendingTestBuffer": {
                funcName: "flock.test.registerBuffer",
                args: [
                    "{that}",
                    "playBuffer-unit-tests-ascending",
                    "@expand:flock.test.generateSequence(1, 64)"
                ]
            },

            "onCreate.registerOnesTestBuffer": {
                funcName: "flock.test.registerBuffer",
                args: [
                    "{that}",
                    "playBuffer-unit-tests-ones",
                    "@expand:flock.generateBufferWithValue(64, 1)"
                ]
            }
        }
    });

    fluid.defaults("flock.test.ugen.playBuffer.testCaseHolder", {
        gradeNames: "fluid.test.testCaseHolder",

        testBufferName: "fluid.mustBeOverridden",

        ugenDef: {
            ugen: "flock.ugen.playBuffer",
            buffer: {
                id: "{that}.options.testBufferName"
            },

            speed: 1.0
        }
    });


    fluid.defaults("flock.test.playBufferTriggerResetTester", {
        gradeNames: "flock.test.ugen.playBuffer.testCaseHolder",

        testBufferName: "playBuffer-unit-tests-ones",

        ugenDef: {
            ugen: "flock.ugen.playBuffer",
            start: 0,
            end: { // To trigger gh-202
                ugen: "flock.ugen.value",
                rate: "control",
                value: 1.0
            },
            trigger: 0.0
        },

        members: {
            player: {
                expander: {
                    funcName: "flock.parse.ugenForDef",
                    args: ["{that}.options.ugenDef", "{environment}"]
                }
            },

            blockOfOnes: {
                expander: {
                    funcName: "flock.generateBufferWithValue",
                    args: [64, 1.0]
                }
            }
        },

        modules: [
            {
                name: "flock.ugen.playBuffer",
                tests: [
                    {
                        name: "Trigger resets buffer playback",
                        expect: 4,
                        sequence: [
                            {
                                func: "{that}.player.gen",
                                args: [64]
                            },
                            {
                                // Sanity check silence.
                                funcName: "jqUnit.assertDeepEq",
                                args: [
                                    "Before the trigger has opened, the unit generator should be silent",
                                    flock.test.silentBlock64,
                                    "{that}.player.output"
                                ]
                            },
                            {
                                func: "{that}.player.input",
                                args: ["trigger", 1.0]
                            },
                            {
                                func: "{that}.player.gen",
                                args: [64]
                            },
                            {
                                funcName: "jqUnit.assertDeepEq",
                                args: [
                                    "When the trigger has opened, the unit generator should output the buffer",
                                    "{that}.blockOfOnes",
                                    "{that}.player.output"
                                ]
                            },
                            {
                                func: "{that}.player.input",
                                args: ["trigger", 0.0]
                            },
                            {
                                func: "{that}.player.gen",
                                args: [64]
                            },
                            {
                                funcName: "jqUnit.assertDeepEq",
                                args: [
                                    "After the buffer has run to its end, the unit generator should be silent",
                                    flock.test.silentBlock64,
                                    "{that}.player.output"
                                ]
                            },
                            {
                                func: "{that}.player.input",
                                args: ["trigger", 1.0]
                            },
                            {
                                func: "{that}.player.gen",
                                args: [64]
                            },
                            {
                                funcName: "jqUnit.assertDeepEq",
                                args: [
                                    "When the trigger has fired again, the unit generator should output the buffer",
                                    "{that}.blockOfOnes",
                                    "{that}.player.output"
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    });

    fluid.defaults("flock.test.ugen.playBuffer.testTriggerReset", {
        gradeNames: "flock.test.testEnvironment",

        components: {
            environment: {
                type: "flock.test.bufferEnviro"
            },

            tester: {
                type: "flock.test.playBufferTriggerResetTester"
            }
        }
    });

    fluid.test.runTests("flock.test.ugen.playBuffer.testTriggerReset");

    fluid.defaults("flock.test.ugen.playBuffer.inputRateTestCaseHolder", {
        gradeNames: "flock.test.ugen.playBuffer.testCaseHolder",

        ugenInputRate: "fluid.mustBeOverridden",

        testBufferName: "playBuffer-unit-tests-ascending"
    });

    fluid.defaults("flock.test.ugen.playBuffer.closedTriggerTester", {
        gradeNames: "flock.test.ugen.playBuffer.inputRateTestCaseHolder",

        members: {
            ugen: {
                expander: {
                    funcName: "flock.test.ugen.playBuffer.makeUGen",
                    args: ["{that}.options.ugenDef", {
                        trigger: {
                            ugen: "flock.ugen.value",
                            value: 0.0,
                            rate: "{that}.options.ugenInputRate"
                        }
                    }]
                }
            },
        },

        modules: [
            {
                name: "flock.ugen.playBuffer trigger tests",
                tests: [
                    {
                        name: "Closed trigger",
                        expect: 2,
                        sequence: [
                            {
                                funcName: "{that}.ugen.gen",
                                args: [64]
                            },
                            {
                                funcName: "jqUnit.assertDeepEq",
                                args: [
                                    "When not looping, and before the trigger has fired, the unit generator should output silence.",
                                    "@expand:flock.generateBufferWithValue(64, 0)",
                                    "{that}.ugen.output"
                                ]
                            },
                            {
                                funcName: "{that}.ugen.set",
                                args: ["loop", {
                                    ugen: "flock.ugen.value",
                                    value: 1.0,
                                    rate: "{that}.options.inputUGenRate"
                                }]
                            },
                            {
                                funcName: "{that}.ugen.gen",
                                args: [64]
                            },
                            {
                                funcName: "jqUnit.assertDeepEq",
                                args: [
                                    "When looping, but before the trigger has fired, the unit generator should output silence.",
                                    "@expand:flock.generateBufferWithValue(64, 0)",
                                    "{that}.ugen.output"
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    });

    fluid.defaults("flock.test.ugen.playBuffer.inputRateTestEnvironment", {
        gradeNames: "flock.test.testEnvironment",

        ugenInputRate: "fluid.mustBeOverridden",
        testerGradeName: "fluid.mustBeOverridden",

        components: {
            environment: {
                type: "flock.test.bufferEnviro"
            },

            tester: {
                type: "{that}.options.testerGradeName",
                options: {
                    ugenInputRate: "{inputRateTestEnvironment}.options.ugenInputRate"
                }
            }
        }
    });

    fluid.defaults("flock.test.ugen.playBuffer.testClosedTriggerAudio", {
        gradeNames: "flock.test.ugen.playBuffer.inputRateTestEnvironment",
        ugenInputRate: "audio",
        testerGradeName: "flock.test.ugen.playBuffer.closedTriggerTester"
    });

    fluid.defaults("flock.test.ugen.playBuffer.testClosedTriggerControl", {
        gradeNames: "flock.test.ugen.playBuffer.inputRateTestEnvironment",
        ugenInputRate: "control",
        testerGradeName: "flock.test.ugen.playBuffer.closedTriggerTester"
    });

    fluid.defaults("flock.test.ugen.playBuffer.testClosedTriggerConstant", {
        gradeNames: "flock.test.ugen.playBuffer.inputRateTestEnvironment",
        ugenInputRate: "constant",
        testerGradeName: "flock.test.ugen.playBuffer.closedTriggerTester"
    });

    fluid.test.runTests("flock.test.ugen.playBuffer.testClosedTriggerAudio");
    fluid.test.runTests("flock.test.ugen.playBuffer.testClosedTriggerControl");
    fluid.test.runTests("flock.test.ugen.playBuffer.testClosedTriggerConstant");


    fluid.defaults("flock.test.ugen.playBuffer.speedTester", {
        gradeNames: "flock.test.ugen.playBuffer.inputRateTestCaseHolder",

        members: {
            normal: {
                expander: {
                    funcName: "flock.test.ugen.playBuffer.makeUGen",
                    args: ["{that}.options.ugenDef", {
                        speed: {
                            ugen: "flock.ugen.value",
                            value: 1.0,
                            rate: "{that}.options.ugenInputRate"
                        }
                    }]
                }
            },

            double: {
                expander: {
                    funcName: "flock.test.ugen.playBuffer.makeUGen",
                    args: ["{that}.options.ugenDef", {
                        speed: {
                            ugen: "flock.ugen.value",
                            value: 2.0,
                            rate: "{that}.options.ugenInputRate"
                        }
                    }]
                }
            },

            backwards: {
                expander: {
                    funcName: "flock.test.ugen.playBuffer.makeUGen",
                    args: ["{that}.options.ugenDef", {
                        speed: {
                            ugen: "flock.ugen.value",
                            value: -1.0,
                            rate: "{that}.options.ugenInputRate"
                        }
                    }]
                }
            }
        },

        invokers: {
            getTestBuffer: {
                funcName: "flock.test.ugen.playBuffer.getBufferNamed",
                args: ["{that}.options.testBufferName", "{environment}"]
            }
        },

        modules: [
            {
                name: "playBuffer speed tests",
                tests: [
                    {
                        name: "Normal speed playback",
                        expect: 3,
                        sequence: [
                            {
                                funcName: "flock.test.ugen.playBuffer.genSpeedInput",
                                args: ["{that}.normal.inputs.speed"]
                            },
                            {
                                func: "{that}.normal.gen",
                                args: [64]
                            },
                            {
                                funcName: "jqUnit.assertDeepEq",
                                args: [
                                    "With a playback speed of 1.0, the output buffer should be identical to the source buffer.",
                                    "@expand:{that}.getTestBuffer()",
                                    "{that}.normal.output"
                                ]
                            },

                            {
                                func: "{that}.normal.gen",
                                args: [64]
                            },
                            {
                                funcName: "jqUnit.assertDeepEq",
                                args: [
                                    "With looping turned off, the output buffer should be silent once we hit the end of the source buffer.",
                                    "@expand:flock.generateBufferWithValue(64, 0)",
                                    "{that}.normal.output"
                                ]
                            },

                            {
                                func: "{that}.normal.input",
                                args: ["loop", 1.0]
                            },
                            {
                                func: "{that}.normal.gen",
                                args: [64]
                            },
                            {
                                funcName: "jqUnit.assertDeepEq",
                                args: [
                                    "With looping turned on, the output buffer should repeat the source buffer from the beginning.",
                                    "@expand:{that}.getTestBuffer()",
                                    "{that}.normal.output"
                                ]
                            }
                        ]
                    },

                    {
                        name: "Double speed playback",
                        expect: 3,
                        sequence: [
                            {
                                funcName: "flock.test.ugen.playBuffer.genSpeedInput",
                                args: ["{that}.double.inputs.speed"]
                            },
                            {
                                func: "{that}.double.gen",
                                args: [64]
                            },
                            {
                                funcName: "jqUnit.assertDeepEq",
                                args: [
                                    "At double speed, the output buffer should contain the odd values from the source buffer, end-padded with zeros.",
                                    "@expand:flock.test.ugen.playBuffer.expectedDoubleSpeedNoLoop()",
                                    "{that}.double.output"
                                ]
                            },

                            {
                                func: "{that}.double.gen",
                                args: [64]
                            },
                            {
                                funcName: "jqUnit.assertDeepEq",
                                args: [
                                    "With looping turned off, the output buffer should be silent once we hit the end of the source buffer.",
                                    "@expand:flock.generateBufferWithValue(64, 0.0)",
                                    "{that}.double.output"
                                ]
                            },

                            {
                                func: "{that}.double.input",
                                args: ["loop", 1.0]
                            },
                            {
                                func: "{that}.double.gen",
                                args: [64]
                            },
                            {
                                funcName: "jqUnit.assertDeepEq",
                                args: [
                                    "At double speed with looping on, the output buffer should contain two repetitions of the odd values from the source buffer.",
                                    "@expand:flock.test.ugen.playBuffer.expectedDoubleSpeedLoop()",
                                    "{that}.double.output"
                                ]
                            }
                        ]
                    },

                    {
                        name: "Backwards playback",
                        expect: 3,
                        sequence: [
                            {
                                funcName: "flock.test.ugen.playBuffer.genSpeedInput",
                                args: ["{that}.backwards.inputs.speed"]
                            },
                            {
                                func: "{that}.backwards.gen",
                                args: [64]
                            },
                            {
                                funcName: "jqUnit.assertDeepEq",
                                args: [
                                    "The buffer should be read in reverse",
                                    "@expand:flock.test.generateSequence(64, 1)",
                                    "{that}.backwards.output"
                                ]
                            },

                            {
                                func: "{that}.backwards.gen",
                                args: [64]
                            },
                            {
                                funcName: "jqUnit.assertDeepEq",
                                args: [
                                    "Playback should not loop.",
                                    "@expand:flock.generateBufferWithValue(64, 0)",
                                    "{that}.backwards.output"
                                ]
                            },

                            {
                                func: "{that}.backwards.input",
                                args: ["loop", 1.0]
                            },
                            {
                                func: "{that}.backwards.gen",
                                args: [64]
                            },
                            {
                                funcName: "jqUnit.assertDeepEq",
                                args: [
                                    "With looping turned on, the buffer should again be read in reverse",
                                    "@expand:flock.test.generateSequence(64, 1)",
                                    "{that}.backwards.output"
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    });

    flock.test.ugen.playBuffer.makeUGen = function (template, overrides) {
        var options = fluid.extend({}, template, overrides);
        return flock.parse.ugenForDef(options);
    };

    flock.test.ugen.playBuffer.genSpeedInput = function (speed) {
        if (speed.rate !== "constant") {
            speed.gen(64);
        }
    };

    flock.test.ugen.playBuffer.ascendingOddOnly = flock.test.generateSequence(1, 63, 2);
    flock.test.ugen.playBuffer.halfSilent = flock.generateBufferWithValue(32, 0);

    flock.test.ugen.playBuffer.expectedDoubleSpeedNoLoop = function () {
        var expected = new Float32Array(64);

        expected.set(flock.test.ugen.playBuffer.ascendingOddOnly);
        expected.set(flock.test.ugen.playBuffer.halfSilent, 32);

        return expected;
    };

    flock.test.ugen.playBuffer.expectedDoubleSpeedLoop = function () {
        var expected = new Float32Array(64);

        expected.set(flock.test.ugen.playBuffer.ascendingOddOnly);
        expected.set(flock.test.ugen.playBuffer.ascendingOddOnly, 32);

        return expected;
    };

    flock.test.ugen.playBuffer.getBufferNamed = function (name, enviro) {
        return enviro.buffers[name].data.channels[0];
    };

    fluid.defaults("flock.test.ugen.playBuffer.testSpeedAudio", {
        gradeNames: "flock.test.ugen.playBuffer.inputRateTestEnvironment",
        ugenInputRate: "audio",
        testerGradeName: "flock.test.ugen.playBuffer.speedTester"
    });

    fluid.defaults("flock.test.ugen.playBuffer.testSpeedControl", {
        gradeNames: "flock.test.ugen.playBuffer.inputRateTestEnvironment",
        ugenInputRate: "control",
        testerGradeName: "flock.test.ugen.playBuffer.speedTester"
    });

    fluid.defaults("flock.test.ugen.playBuffer.testSpeedConstant", {
        gradeNames: "flock.test.ugen.playBuffer.inputRateTestEnvironment",
        ugenInputRate: "constant",
        testerGradeName: "flock.test.ugen.playBuffer.speedTester"
    });

    fluid.test.runTests("flock.test.ugen.playBuffer.testSpeedAudio");
    fluid.test.runTests("flock.test.ugen.playBuffer.testSpeedControl");
    fluid.test.runTests("flock.test.ugen.playBuffer.testSpeedConstant");


    fluid.defaults("flock.test.ugen.playBuffer.bufferInputTester", {
        gradeNames: "fluid.test.testCaseHolder",

        rawBufferArray: "@expand:flock.test.generateSequence(1, 64)",

        components: {
            rawBufferSynth: {
                type: "flock.synth",
                options: {
                    components: {
                        enviro: "{environment}"
                    },

                    addToEnvironment: false,

                    synthDef: {
                        id: "player",
                        ugen: "flock.ugen.playBuffer",
                        trigger: 1.0,
                        loop: 0.0,
                        buffer: "{bufferInputTester}.options.rawBufferArray"
                    }
                }
            },

            bufDescSynth: {
                type: "flock.synth",
                options: {
                    components: {
                        enviro: "{environment}"
                    },

                    addToEnvironment: false,

                    synthDef: {
                        id: "player",
                        ugen: "flock.ugen.playBuffer",
                        trigger: 1.0,
                        loop: 0.0,
                        buffer: {
                            data: {
                                channels: ["{bufferInputTester}.options.rawBufferArray"]
                            },
                            format: {
                                numChannels: 1
                            }
                        }
                    }
                }
            }
        },

        modules: [
            {
                name: "playBuffer buffer input tests",
                tests: [
                    {
                        name: "Raw buffer specified as the buffer input",
                        expect: 1,
                        sequence: [
                            {
                                funcName: "flock.evaluate.synth",
                                args: ["{rawBufferSynth}"]
                            },
                            {
                                funcName: "jqUnit.assertDeepEq",
                                args: [
                                    "The output is the raw buffer",
                                    "{that}.options.rawBufferArray",
                                    "{rawBufferSynth}.nodeList.namedNodes.player.output"
                                ]
                            }
                        ]
                    },
                    {
                        name: "BufferDesc specified as the buffer input",
                        expect: 1,
                        sequence: [
                            {
                                funcName: "flock.evaluate.synth",
                                args: ["{bufDescSynth}"]
                            },
                            {
                                funcName: "jqUnit.assertDeepEq",
                                args: [
                                    "The output is the raw buffer",
                                    "{that}.options.rawBufferArray",
                                    "{bufDescSynth}.nodeList.namedNodes.player.output"
                                ]
                            }

                        ]
                    }
                ]
            }
        ]
    });

    fluid.defaults("flock.test.ugen.playBuffer.bufferInputTests", {
        gradeNames: "flock.test.testEnvironment",

        rate: "fluid.mustBeOverridden",

        components: {
            tester: {
                type: "flock.test.ugen.playBuffer.bufferInputTester"
            }
        }
    });

    fluid.defaults("flock.test.ugen.playBuffer.bufferInputTestsAudio", {
        gradeNames: "flock.test.ugen.playBuffer.bufferInputTests",

        rate: "audio"
    });

    fluid.defaults("flock.test.ugen.playBuffer.bufferInputTestsControl", {
        gradeNames: "flock.test.ugen.playBuffer.bufferInputTests",

        rate: "control"
    });

    fluid.defaults("flock.test.ugen.playBuffer.bufferInputTestsConstant", {
        gradeNames: "flock.test.ugen.playBuffer.bufferInputTests",

        rate: "constant"
    });

    fluid.test.runTests("flock.test.ugen.playBuffer.bufferInputTestsAudio");
    fluid.test.runTests("flock.test.ugen.playBuffer.bufferInputTestsControl");
    fluid.test.runTests("flock.test.ugen.playBuffer.bufferInputTestsConstant");
}());
