/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2011, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global fluid, ok, equal, deepEqual, Float32Array*/

var flock = flock || {};

(function () {
    "use strict";

    fluid.registerNamespace("flock.test");

    flock.test.silentBlock64 = new Float32Array(64);

    flock.test.fillBuffer = function (start, end, skip) {
        skip = skip || 1;

        var buf = [],
            numVals = Math.abs((end - start) / skip),
            inc = (end - start) > 0 ? skip : -skip,
            val = start;

        for (var i = 0; i <= numVals; i++) {
            buf.push(val);
            val += inc;
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


    fluid.registerNamespace("flock.test.line");

    // TODO: Unit tests.
    flock.test.line.step = function (numSamps, start, end, buffer) {
        buffer = buffer || new Float32Array(numSamps);

        buffer[0] = start;

        for (var i = 1; i < buffer.length; i++) {
            buffer[i] = end;
        }

        return buffer;
    };

    // TODO: Unit tests.
    flock.test.line.linear = function (numSamps, start, end, buffer) {
        buffer = buffer || new Float32Array(numSamps);
        var inc = (end - start) / numSamps,
            val = start;

        for (var i = 0; i < buffer.length; i++) {
            buffer[i] = val;
            val += inc;
        }

        return buffer;
    };

    // TODO: Unit tests.
    flock.test.line.squared = function (numSamps, start, end, buffer) {
        buffer = buffer || new Float32Array(numSamps);

        var startSqrt = Math.sqrt(start),
            endSqrt = Math.sqrt(end),
            inc = (endSqrt - startSqrt) / numSamps,
            y1 = startSqrt,
            val = start;

        for (var i = 0; i < buffer.length; i++) {
            buffer[i] = val;
            y1 += inc;
            val = y1 * y1;
        }

        return buffer;
    };

    // TODO: Unit tests.
    flock.test.line.cubed = function (numSamps, start, end, buffer) {
        buffer = buffer || new Float32Array(numSamps);

        var startCubed = Math.pow(start, 1/3),
            endCubed = Math.pow(end, 1/3),
            inc = (endCubed - startCubed) / numSamps,
            y1 = startCubed,
            val = start;

        for (var i = 0; i < buffer.length; i++) {
            buffer[i] = val;
            y1 += inc;
            val = y1 * y1 * y1;
        }

        return buffer;
    };

    // TODO: Unit tests. This implementation may not be correct.
    flock.test.line.exponential = function (numSamps, start, end, buffer) {
        buffer = buffer || new Float32Array(numSamps);

        var scaledStart = start === 0 ? 0.0000000000000001 : start,
            inc = Math.pow(end / scaledStart, 1.0 / numSamps),
            val = scaledStart * inc;

        buffer[0] = start;

        for (var i = 1; i < numSamps; i++) {
            buffer[i] = val;
            val *= inc;
        }

        return buffer;
    };

    // TODO: Unit tests.
    flock.test.line.sin = function (numSamps, start, end, buffer) {
        buffer = buffer || new Float32Array(numSamps);

        var w = Math.PI / numSamps,
            a2 = (end + start) * 0.5,
            b1 = 2.0 * Math.cos(w),
            y1 = (end - start) * 0.5,
            y2 = y1 * Math.sin(flock.HALFPI - w),
            val = a2 - y1,
            y0;

        for (var i = 0; i < numSamps; i++) {
            buffer[i] = val;

            y0 = b1 * y1 - y2;
            val = a2 - y0;
            y2 = y1;
            y1 = y0;
        }

        return buffer;
    };

    flock.test.line.welsh = function (numSamps, start, end, buffer) {
        buffer = buffer || new Float32Array(numSamps);

        var w = flock.HALFPI / numSamps,
            cosW = Math.cos(w),
            b1 = 2.0 * cosW,
            val = start,
            a2,
            y1,
            y2,
            y0;

        if (end >= start) {
            a2 = start;
            y1 = 0;
            y2 = -Math.sin(w) * (end - start);
        } else {
            a2 = end;
            y1 = start - end;
            y2 = cosW * (start - end);
        }

        for (var i = 0; i < numSamps; i++) {
            buffer[i] = val;
            y0 = b1 * y1 - y2;
            y2 = y1;
            y1 = y0;
            val = a2 + y0;
        }

        return buffer;
    };

    flock.test.line.curve = function (numSamps, curveVal, start, end, buffer) {
        buffer = buffer || new Float32Array(numSamps);

        if (Math.abs(curveVal) < 0.001) {
            return flock.test.linearBuffer(numSamps, start, end, buffer);
        }

        var a1 = (end - start) / (1.0 - Math.exp(curveVal)),
            a2 = start + a1,
            b1 = a1,
            inc = Math.exp(curveVal / numSamps),
            val = start;

        for (var i = 0; i < numSamps; i++) {
            buffer[i] = val;
            b1 *= inc;
            val = a2 - b1;
        }

        return buffer;
    };

    /**
     * Concatenates all arguments (arrays or individual objects)
     * into a single array.
     */
    flock.test.concat = function () {
        var expectations = [];

        for (var i = 0; i < arguments.length; i++) {
            expectations = expectations.concat(arguments[i]);
        }

        return expectations;
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

    flock.test.makeNewArrayLike = function (arr) {
        return (arr instanceof Float32Array) ?
            new Float32Array(arr.length) : new Array(arr.length);
    };

    flock.test.arrayEqualRounded = function (numDecimals, actual, expected, msg) {
        var roundedActual = flock.test.makeNewArrayLike(actual);

        for (var i = 0; i < actual.length; i++) {
            roundedActual[i] = flock.test.roundTo(actual[i], numDecimals);
        }

        deepEqual(roundedActual, expected, msg);
    };

    flock.test.arrayEqualBothRounded = function (numDecimals, actual, expected, msg) {
        if (!actual) {
            ok(false, msg + " - the actual array was undefined.");
            return;
        }

        if (actual.length !== expected.length) {
            ok(false, msg + " - the actual array was a different length (" +
                actual.length + " instead of " + expected.length + ")");
            return;
        }

        var roundedActual = [],
            roundedExpected = [];

        for (var i = 0; i < actual.length; i++) {
            roundedActual[i] = flock.test.roundTo(actual[i], numDecimals);
            roundedExpected[i] = flock.test.roundTo(expected[i], numDecimals);
        }

        deepEqual(roundedActual, roundedExpected, msg);
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

        equal(outOfRanges.length, 0, msg +
            (outOfRanges.length > 0 ? " Out of range values found at: " +
            fluid.prettyPrintJSON(outOfRanges) : ""));
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
        equal(unexpected.length, 0, msg + (unexpected.length ? " Unexpected values: " +
            fluid.prettyPrintJSON(unexpected) : ""));
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
            "The output should not be completely silent.");
        flock.test.arrayUnbroken(output,
            "The ugen should produce an unbroken audio tone.");
        flock.test.arrayWithinRange(output, expectedMin, expectedMax,
            "The ugen should produce output values ranging between " + expectedMin + " and " + expectedMax + ".");
    };


    fluid.registerNamespace("flock.test.ugen");

    flock.test.ugen.mock = function (inputs, output, options) {
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

    flock.test.ugen.mock.make = function (output, rate, options) {
        options = options || {};
        if (typeof (output) === "function") {
            output = flock.generate(64, output);
        }

        options.buffer = output;

        return flock.parse.ugenForDef({
            ugen: "flock.test.ugen.mock",
            rate: rate || flock.rates.AUDIO,
            options: options
        });
    };

    flock.test.ugen.mock.makeRandomInputGenerator = function (inputSpec, defaultScale, round) {
        defaultScale = defaultScale || 500;
        var scale = typeof (inputSpec) === "string" ? defaultScale : inputSpec.scale,
            val;

        return function () {
            val = Math.random() * scale;
            return round ? Math.round(val) : val;
        };
    };


    flock.test.ugen.record = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var recordBuffer = that.recordBuffer,
                m = that.model,
                idx = m.idx,
                source = that.inputs.source.output,
                out = that.output,
                i,
                j,
                val;

            for (i = 0, j = 0; i < numSamps; i++, j += m.strides.source) {
                val = source[j];
                out[i] = val;

                if (idx < recordBuffer.length) {
                    recordBuffer[idx] = val;
                    idx++;
                }
            }

            m.idx = idx;
        };

        that.init = function () {
            var m = that.model,
                durationSamps = that.options.maxDuration * that.model.sampleRate;

            that.recordBuffer = new Float32Array(durationSamps);
            m.sampsLeft = durationSamps;
            m.idx = 0;

            that.onInputChanged();
        };

        that.init();

        return that;
    };

    fluid.defaults("flock.test.ugen.record", {
        inputs: {
            source: null
        },

        ugenOptions: {
            maxDuration: 1, // Seconds.
            model: {
                idx: 0
            },
            strideInputs: ["source"]
        }
    });
}());
