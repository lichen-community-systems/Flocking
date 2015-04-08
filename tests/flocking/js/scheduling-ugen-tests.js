/*!
* Flocking Scheduling Unit Generator Tests
*
* Copyright 2014-2015, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require, module, test, deepEqual, expect*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var $ = fluid.registerNamespace("jQuery");

    flock.init();

    module("flock.ugen.change");

    var changeDef = {
        id: "changer",
        ugen: "flock.ugen.change",
        initial: 1.0,
        target: 2.0,
        time: 1/750
    };

    var makeUGen = function (def) {
        return flock.parse.ugenForDef(fluid.copy(def), {
            audioSettings: {
                rates: {
                    audio: 48000
                }
            }
        });
    };

    test("Change at specified time", function () {
        expect(2);

        var changer = makeUGen(changeDef);

        flock.test.evaluateUGen(changer);
        deepEqual(changer.output, flock.generate(64, 1),
            "For the first sample block, the output should be the initial input's output.");

        flock.test.evaluateUGen(changer);
        deepEqual(changer.output, flock.generate(64, 2),
            "For the second sample block, the output should be the target input's output.");
    });

    test("Crossfade", function () {
        expect(3);

        var crossFadeDef = $.extend({}, changeDef, {
            crossfade: 1/750
        });

        var changer = makeUGen(crossFadeDef),
            crossfadeBuffer = flock.generate(64, function (i) {
                var targetLevel = i / 64,
                    initialLevel = 1 - targetLevel;
                return (1 * initialLevel) + (2 * targetLevel);
            });

        flock.test.evaluateUGen(changer);
        deepEqual(changer.output, flock.generate(64, 1),
            "For the first sample block, the output should be the initial input's output.");

        flock.test.evaluateUGen(changer);
        deepEqual(changer.output, crossfadeBuffer,
            "For the second sample block, the output should crossfade from the initial to the target input.");

        flock.test.evaluateUGen(changer);
        deepEqual(changer.output, flock.generate(64, 2),
            "For the third sample block, the output should be the target input's output.");
    });
}());
