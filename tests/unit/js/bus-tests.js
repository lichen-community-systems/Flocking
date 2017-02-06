/*!
* Flocking Bus Tests
* http://github.com/colinbdclark/flocking
*
* Copyright 2011-2017, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require*/
var fluid = fluid || require("infusion"),
    jqUnit = jqUnit || fluid.require("node-jqunit"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    fluid.registerNamespace("flock.test.bus");

    var QUnit = fluid.registerNamespace("QUnit");

    flock.test.bus.runTests = function (enviro, type, numBuses, expectedCalcFn) {
        for (var i = 0; i < numBuses; i++) {
            var actualBusNum = enviro.busManager.acquireNextBus(type);
            var expectedBusNum = expectedCalcFn(i, enviro);
            QUnit.equal(actualBusNum, expectedBusNum,
                "The correct " + type + " bus number should have been returned.");
        }

        try {
            enviro.busManager.acquireNextBus(type);
            QUnit.ok(false, "An error should have been thrown when " +
                "trying to acquire more than the available number of buses.");
        } catch (e) {
            QUnit.ok(e.message.indexOf("insufficient buses available") > -1,
                "The correct error should be thrown when trying to acquire " +
                "more than the available number of buses.");
        }
    };

    fluid.defaults("flock.test.bus.inputAcquisition", {
        gradeNames: "flock.test.testEnvironment",

        audioSystemOptions: {
            chans: 1,
            numBuses: 10,
            numInputBuses: 2
        },

        components: {
            tester: {
                type: "flock.test.bus.inputAcquisitionTester"
            }
        }
    });

    fluid.defaults("flock.test.bus.inputAcquisitionTester", {
        gradeNames: "fluid.test.testCaseHolder",

        busType: "input",
        numBusesToAcquire: 2,

        modules: [
            {
                name: "Input bus acquisition",
                tests: [
                    {
                        name: "Acquire too many buses",
                        expect: 3,
                        sequence: [
                            {
                                funcName: "flock.test.bus.runTests",
                                args: [
                                    "{environment}",
                                    "{that}.options.busType",
                                    "{that}.options.numBusesToAcquire",
                                    "{that}.expectedBusIndex"
                                ]
                            }
                        ]
                    }
                ]
            }
        ],

        invokers: {
            expectedBusIndex: {
                funcName: "flock.test.bus.inputAcquisitionTester.expectedBusIndex"
            }
        }
    });

    flock.test.bus.inputAcquisitionTester.expectedBusIndex = function (runIdx, enviro) {
        return runIdx + enviro.audioSystem.model.chans;
    };


    fluid.defaults("flock.test.bus.interconnectAcquisition", {
        gradeNames: "flock.test.testEnvironment",

        audioSystemOptions: {
            chans: 2,
            numBuses: 6,
            numInputBuses: 2
        },

        components: {
            tester: {
                type: "flock.test.bus.interconnectAcquisitionTester"
            }
        }
    });

    fluid.defaults("flock.test.bus.interconnectAcquisitionTester", {
        gradeNames: "fluid.test.testCaseHolder",

        busType: "interconnect",
        numBusesToAcquire: 2,

        modules: [
            {
                name: "Interconnect bus acquisition",
                tests: [
                    {
                        name: "Acquire too many buses",
                        expect: 3,
                        sequence: [
                            {
                                funcName: "flock.test.bus.runTests",
                                args: [
                                    "{environment}",
                                    "{that}.options.busType",
                                    "{that}.options.numBusesToAcquire",
                                    "{that}.expectedBusIndex"
                                ]
                            }
                        ]
                    }
                ]
            }
        ],

        invokers: {
            expectedBusIndex: {
                funcName: "flock.test.bus.interconnectAcquisitionTester.expectedBusIndex"
            }
        }
    });

    flock.test.bus.interconnectAcquisitionTester.expectedBusIndex = function (runIdx, enviro) {
        return runIdx + enviro.audioSystem.model.chans + enviro.audioSystem.model.numInputBuses;
    };


    fluid.defaults("flock.test.bus.acquistionAfterResetEnvironment", {
        gradeNames: "flock.test.testEnvironment",

        audioSystemOptions: {
            chans: 2,
            numBuses: 6,
            numInputBuses: 2
        },

        components: {
            tester: {
                type: "flock.test.bus.acquisitionAfterResetTester"
            }
        }
    });

    fluid.defaults("flock.test.bus.acquisitionAfterResetTester", {
        gradeNames: "fluid.test.testCaseHolder",

        modules: [
            {
                name: "Acquire interconnect bus after reset",
                tests: [
                    {
                        name: "Acquire a bus, reset, then acquire it again",
                        expect: 2,
                        sequence: [
                            {
                                funcName: "flock.test.bus.acquisitionAfterResetTester.test",
                                args: ["{environment}"]
                            }
                        ]
                    }
                ]
            }
        ]
    });

    flock.test.bus.acquisitionAfterResetTester.test = function (enviro) {
        var busNum = enviro.busManager.acquireNextBus("interconnect");
        QUnit.equal(busNum, 4,
            "The first interconnect bus should have been acquired.");

        enviro.reset();

        busNum = enviro.busManager.acquireNextBus("interconnect");
        QUnit.equal(busNum, 4,
            "The first interconnect bus should have been acquired.");
    };

    fluid.test.runTests("flock.test.bus.inputAcquisition");
    fluid.test.runTests("flock.test.bus.interconnectAcquisition");
    fluid.test.runTests("flock.test.bus.acquistionAfterResetEnvironment");
}());
