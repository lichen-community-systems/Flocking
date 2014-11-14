/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2011, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global ok, equal, deepEqual, Float32Array*/

var flock = flock || {};

(function () {
    "use strict";

    flock.test = flock.test || {};

    flock.test.fillBuffer = function (start, end, skip) {
        var buf = [],
            count = 0,
            val;
        skip = skip !== undefined ? skip : 1;

        for (val = start; val <= end; val += skip) {
            buf[count] = val;
            count++;
        }

        return new Float32Array(buf);
    };

    flock.test.ascendingBuffer = function (numSamps, start, step) {
        start = start === undefined ? 0 : start;
        step = step === undefined ? 1 : step;

        return flock.generate(numSamps, function (i) {
            return start + (i * step);
        });
    };

    flock.test.arrayNotNaN = function (buffer, msg) {
        var failures = [],
            i;

        for (i = 0; i < buffer.length; i++) {
            if (isNaN(buffer[i])) {
                failures.push(i);
            }
        }

        equal(failures.length, 0, msg + (failures.length ? " NaN values found at indices: " + failures : ""));
    };

    flock.test.roundTo = function (value, numDecimals) {
        return parseFloat(value.toFixed(numDecimals));
    };

    flock.test.equalRounded = function (numDecimals, actual, expected, msg) {
        var rounded = flock.test.roundTo(actual, numDecimals);
        equal(rounded, expected, msg);
    };

    flock.test.arrayEqualRounded = function (numDecimals, actual, expected, msg) {
        var i;

        for (i = 0; i < actual.length; i++) {
            flock.test.equalRounded(numDecimals, actual[i], expected[i], msg);
        }
    };

    flock.test.arrayNotSilent = function (buffer, msg) {
        var numNonZero = 0,
            foundAt = -1,
            i;
        for (i = 0; i < buffer.length; i++) {
            if (buffer[i] !== 0.0) {
                foundAt = foundAt <= 0 ? i : foundAt; // Record the first index where a zero sample was found.
                numNonZero++;
            }
        }

        ok(numNonZero > (buffer.length / 10), msg + " First silent sample found at: " + foundAt);
    };

    flock.test.arraySilent = function (buffer, msg) {
        var silentBuffer = flock.generate(buffer.length, 0.0);
        deepEqual(buffer, silentBuffer, msg);
    };

    flock.test.arrayExtremelyQuiet = function (buffer, msg) {
        var expected = flock.generate(buffer.length, 0);
        flock.test.arrayEqualRounded(10, buffer, expected, msg);
    };

    flock.test.arrayUnbroken = function (buffer, msg) {
        var numZero = 0,
            isBroken = false,
            foundAt = -1,
            i;

        for (i = 0; i < buffer.length; i++) {
            numZero = buffer[i] === 0 ? numZero + 1 : 0;

            // If we encounter more than 5 zero samples, we've got a drop.
            if (numZero > 5) {
                isBroken = true;
                foundAt = i;
                break;
            }
        }
        ok(!isBroken, msg + " Last silent sample found at: " + foundAt);
    };

    flock.test.arrayWithinRange = function (buffer, min, max, msg) {
        var outOfRanges = [],
            i,
            val;

        for (i = 0; i < buffer.length; i++) {
            val = buffer[i];
            if (val < min || val > max) {
                outOfRanges.push({
                    index: i,
                    value: val
                });
            }
        }

        equal(outOfRanges.length, 0, msg + "Out of range values found at:" + outOfRanges);
    };

    flock.test.continuousArray = function (buffer, threshold, msg) {
        var unexpected = [],
            previous = buffer[0],
            current,
            i;
        for (i = 1; i < buffer.length; i++) {
            current = buffer[i];
            if (Math.abs(previous - current) > threshold) {
                unexpected.push({
                    index: i,
                    value: current,
                    previous: previous
                });
            }
            previous = current;
        }
        equal(unexpected.length, 0, msg + (unexpected.length ? " Unexpected values: " + unexpected : ""));
    };

    flock.test.rampingArray = function (buffer, isAscending, msg) {
        var unexpected = [],
            previous = buffer[0],
            current,
            isExpectedDirection = false,
            i;
        for (i = 1; i < buffer.length; i++) {
            current = buffer[i];
            isExpectedDirection = isAscending ? current > previous : current < previous;
            if (!isExpectedDirection) {
                unexpected.push({
                    index: i,
                    value: current,
                    previous: previous
                });
            }
        }
        equal(unexpected.length, 0, msg + (unexpected.length ? " Unexpected values: " + unexpected : ""));
    };

    flock.test.sineishArray = function (buffer, max, isAscending, msg) {
        if (typeof isAscending === "string") {
            msg = isAscending;
            isAscending = true;
        }

        var unexpected = [],
            maxReached = false,
            fail = false,
            i,
            current,
            next;

        for (i = 0; i < buffer.length - 1; i++) {
            current = buffer[i];
            current = flock.test.roundTo(current, 6);
            next = buffer[i + 1];
            next = flock.test.roundTo(next, 6);

            if (current === next) {
                continue;
            }

            // TODO: Add support for a threshold.
            if (Math.abs(current) === max) {
                isAscending = !isAscending;
                maxReached = true;
            }

            fail = isAscending ? (next < current) : (next > current);
            if (fail) {
                unexpected.push("[index: " + i + " value: " + current + " next: " + next + "]");
            }
        }

        equal(unexpected.length, 0, msg + (unexpected.length ? " Unexpected values: " + unexpected : ""));
    };

    flock.test.arrayContainsOnlyValues = function (buffer, values, msg) {
        var outlierVals = [],
            outlierIndices = [],
            i;

        for (i = 0; i < buffer.length; i++) {
            var val = buffer[i];
            if (values.indexOf(val) === -1) {
                outlierVals.push(val);
                outlierIndices.push(i);
            }
        }

        equal(outlierVals.length, 0, msg);
    };

    flock.test.valueCount = function (buffer, value, expectedNum, msg) {
        var count = 0,
            i;

        for (i = 0; i < buffer.length; i++) {
            if (buffer[i] === value) {
                count++;
            }
        }

        equal(count, expectedNum, msg);
    };

    flock.test.containsSoleProperty = function (obj, prop, value, msg) {
        if (arguments.length === 2) {
            value = true;
        }

        equal(obj[prop], value,
            msg + " The expected property should have the correct value.");
        equal(Object.keys(obj).length, 1,
            msg + " There should be no other properties in the object.");
    };

    flock.test.unbrokenInRangeSignal = function (output, expectedMin, expectedMax, range) {
        output = range ? output.subarray(range.start, range.end) : output;
        flock.test.arrayNotNaN(output,
            "The ugen should never output NaN.");
        flock.test.arrayNotSilent(output,
            "The output should not be completely silent");
        flock.test.arrayUnbroken(output,
            "The ugen should produce an unbroken audio tone.");
        flock.test.arrayWithinRange(output, expectedMin, expectedMax,
            "The ugen should produce output values ranging between " + expectedMin + " and " + expectedMax + ".");
    };


    flock.mock = {};

    flock.mock.ugen = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);
        if (that.options.buffer) {
            that.output = that.options.buffer;
        }
        that.gen = function (numSamps) {
            if (that.options.gen) {
                that.options.gen(that, numSamps);
            }
        };
        return that;
    };

    flock.mock.makeMockUGen = function (output, rate) {
        if (typeof (output) === "function") {
            output = flock.generate(64, output);
        }

        return flock.parse.ugenForDef({
            ugen: "flock.mock.ugen",
            rate: rate || flock.rates.AUDIO,
            options: {
                buffer: output
            }
        });
    };

    flock.mock.makeRandomInputGenerator = function (inputSpec, defaultScale, round) {
        defaultScale = defaultScale || 500;
        var scale = typeof (inputSpec) === "string" ? defaultScale : inputSpec.scale,
            val;

        return function () {
            val = Math.random() * scale;
            return round ? Math.round(val) : val;
        };
    };

}());
