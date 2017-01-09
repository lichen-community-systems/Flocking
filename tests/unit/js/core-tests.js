/*!
* Flocking Core Tests
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

    fluid.registerNamespace("flock.test.core");

    var QUnit = fluid.registerNamespace("QUnit");

    /*****************************
     * Typed Array Merging Tests *
     *****************************/

    fluid.registerNamespace("flock.test.core.typedArrayMerging");

    fluid.defaults("flock.test.componentWithTypedArrayOption", {
        gradeNames: "fluid.component",
        buffer: new Float32Array([1, 1, 1, 1])
    });

    flock.test.core.typedArrayMerging.checkTypedArrayProperty = function(componentType,
        propertyPath, componentOptions) {

        var component = fluid.invokeGlobalFunction(componentType, [componentOptions]);
        var property = fluid.get(component, propertyPath);
        var isTyped = property instanceof Float32Array;
        QUnit.ok(isTyped,
            "A typed array stored as a component default should not be corrupted.");
    };

    flock.test.core.typedArrayMerging.componentDefaults = function () {
        var ta = new Float32Array([1.1, 2.2, 3.3]);
        QUnit.ok(ta instanceof Float32Array, "Sanity check: a Float32Array should be an instance of a Float32Array.");
        QUnit.ok(!fluid.isPlainObject(ta), "fluid.isPlainObject() should not recognize a typed array as a primitive.");
        QUnit.ok(!fluid.isPrimitive(ta), "fluid.isPrimitive() should not recognize a typed array as a primitive.");

        fluid.defaults("flock.test.typedArrayComponent", {
            gradeNames: ["fluid.component"],
            synthDef: {
                cat: ta
            }
        });

        // Check the property after it has been stored in fluid.defaults().
        var defaultProperty = fluid.defaults("flock.test.typedArrayComponent").synthDef.cat;
        QUnit.ok(defaultProperty instanceof Float32Array);

        // Instantiate the component with no options and check the typed array property.
        flock.test.core.typedArrayMerging.checkTypedArrayProperty(
            "flock.test.typedArrayComponent", "options.synthDef.cat");

        // Specify, in options, a typed array and check that it is not merged.
        flock.test.core.typedArrayMerging.checkTypedArrayProperty(
            "flock.test.typedArrayComponent", "options.synthDef.cat", {
            synthDef: {
                cat: new Float32Array([4.4, 5.5, 6.6])
            }
        });
    };

    flock.test.core.typedArrayMerging.componentOptions = function () {
        var c = flock.test.componentWithTypedArrayOption();
        QUnit.deepEqual(c.options.buffer, new Float32Array([1, 1, 1, 1]),
            "The component's typed array should be set to the default value.");

        c = flock.test.componentWithTypedArrayOption({
            buffer: new Float32Array([2, 2, 2, 2])
        });
        QUnit.deepEqual(c.options.buffer, new Float32Array([2, 2, 2, 2]),
            "The component's typed array should have been overriden.");
    };


    flock.test.module({
        name: "Typed array merging"
    });

    QUnit.test("Component defaults", flock.test.core.typedArrayMerging.componentDefaults);
    QUnit.test("Component options", flock.test.core.typedArrayMerging.componentOptions);


    /******************************
     * Audio Merging and Clamping *
     ******************************/

    fluid.defaults("flock.test.core.options", {
        gradeNames: "flock.test.module",

        name: "Options clamping and merging",

        enviroOptions: {
            components: {
                audioSystem: {
                    options: {
                        model: {
                            chans: 64,
                            numInputBuses: 128
                        }
                    }
                }
            }
        },

        invokers: {
            testClampTooLargeValues: {
                funcName: "flock.test.core.options.testClampTooLargeValues",
                args: ["{that}.environment"]
            }
        }
    });

    flock.test.core.options.testClampTooLargeValues = function (environment) {
        QUnit.expect(3);

        var audioSystemDefaults = fluid.defaults("flock.audioSystem"),
            defaultInputBusRange = audioSystemDefaults.inputBusRange,
            defaultMaxChans = audioSystemDefaults.channelRange.max;
        QUnit.ok(environment.audioSystem.model.chans <= defaultMaxChans,
            "The environment's number of channels should be clamped at " + defaultMaxChans);
        QUnit.equal(environment.audioSystem.model.numInputBuses, defaultInputBusRange.max,
            "The environment's number of input buses should be clamped at " + defaultInputBusRange.max);
        QUnit.ok(environment.audioSystem.model.numInputBuses >= defaultInputBusRange.min,
            "The environment should have at least " + defaultInputBusRange.min + " input buses.");
    };

    flock.test.core.options.testClamping = function () {
        QUnit.expect(5);

        var enviro = flock.init({
            chans: 64,
            numInputBuses: 128
        });

        var audioSystemDefaults = fluid.defaults("flock.audioSystem"),
            defaultInputBusRange = audioSystemDefaults.inputBusRange,
            defaultMaxChans = audioSystemDefaults.channelRange.max;
        QUnit.ok(enviro.audioSystem.model.chans <= defaultMaxChans,
            "The environment's number of channels should be clamped at " + defaultMaxChans);
        QUnit.equal(enviro.audioSystem.model.numInputBuses, defaultInputBusRange.max,
            "The environment's number of input buses should be clamped at " + defaultInputBusRange.max);
        QUnit.ok(enviro.audioSystem.model.numInputBuses >= defaultInputBusRange.min,
            "The environment should have at least " + defaultInputBusRange.min + " input buses.");
        enviro.destroy();

        enviro = flock.init({
            chans: 1,
            numBuses: 1
        });
        QUnit.ok(enviro.audioSystem.model.numBuses >= 2,
            "The environment should always have two or more buses.");
        enviro.destroy();

        enviro = flock.init({
            chans: 8,
            numBuses: 4
        });
        QUnit.ok(enviro.audioSystem.model.numBuses >= enviro.audioSystem.model.chans,
            "The environment should always have at least as many buses as channels.");
        enviro.destroy();
    };

    flock.test.core.options.testMerging = function () {
        QUnit.expect(3);

        var enviro = flock.init({
            numBuses: 24,
            chans: 1
        });

        var expectedNumChans = !flock.platform.browser.safari ? 1 : enviro.audioSystem.context.destination.channelCount;
        QUnit.equal(enviro.audioSystem.model.chans, expectedNumChans,
            "The environment should have been configured with the specified chans option (except on Safari).");

        QUnit.equal(enviro.audioSystem.model.numBuses, 24,
            "The environment should have been configured with the specified number of buses");

        QUnit.equal(enviro.busManager.buses.length, 24,
            "The environment should actually have the specified number of buses.");
        enviro.destroy();
    };

    var module = flock.test.core.options();
    QUnit.test("Large values should be clamped down", module.testClampTooLargeValues);
    QUnit.test("Options clamping", flock.test.core.options.testClamping);
    QUnit.test("Options merging", flock.test.core.options.testMerging);


    /*************************
     * Core Random Functions *
     *************************/
    fluid.registerNamespace("flock.test.core.randomGenerators");

    flock.test.core.randomGenerators.randomAudioValue = function () {
        var buf = new Float32Array(100000);
        flock.fillBuffer(buf, flock.randomAudioValue);
        flock.test.signalInRange(buf, -1.0, 1.0);
    };

    flock.test.core.randomGenerators.randomValue = function () {
        var buf = new Float32Array(100000);
        flock.fillBuffer(buf, function () {
            return flock.randomValue(-12, 2);
        });
        flock.test.signalInRange(buf, -12.0, 2.0);
    };

    module = flock.test.module({
        name: "Random number generating functions"
    });

    QUnit.test("flock.randomAudioValue", flock.test.core.randomGenerators.randomAudioValue);
    QUnit.test("flock.randomValue", flock.test.core.randomGenerators.randomValue);

}());
