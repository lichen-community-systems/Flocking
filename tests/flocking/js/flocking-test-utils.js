/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2011, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global module, test, expect, ok, equals, deepEqual, Float32Array*/
/*jslint white: true, vars: true, plusplus: true, undef: true, newcap: true, regexp: true, browser: true, 
    forin: true, continue: true, nomen: true, bitwise: true, maxerr: 100, indent: 4 */

var flock = flock || {};

(function () {
    "use strict";
    
    flock.test = flock.test || {};
    
    flock.test.countKeys = function (obj) {
        var numKeys = 0,
            key;
        for (key in obj) {
            if (obj.hasOwnProperty(key)) {
                numKeys++;
            }
        }
        return numKeys;
    };
    
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
    
    flock.test.constantBuffer = function (size, val) {
        var buf = new Float32Array(size),
            i;
        for (i = 0; i < size; i++) {
            buf[i] = val;
        }
        return buf;
    };
    
    flock.test.assertArrayEquals = function (actual, expected, msg) {
        var i;
        for (i = 0; i < expected.length; i++) {
            equals(actual[i], expected[i], msg + " Index: " + i);
        }
    };
    
    flock.test.assertNotNaN = function (buffer, msg) {
        var i;
        for (i = 0; i < buffer.length; i++) {
            if (isNaN(buffer[i])) {
                ok(false, msg + " NaN value found at index " + i);
            }
        }
    };
    
    flock.test.assertNotSilent = function (buffer, msg) {
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
    
    flock.test.assertSilent = function (buffer, msg) {
        var silentBuffer = flock.test.constantBuffer(buffer.length, 0.0);
        deepEqual(buffer, silentBuffer, "The buffer should be silent by containing all zeros.");
    };
    
    flock.test.assertUnbroken = function (buffer, msg) {
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
    
    flock.test.assertWithinRange = function (buffer, min, max, msg) {
        var i,
            val;
        for (i = 0; i < buffer.length; i++) {
            val = buffer[i];
            ok(val >= min && val <= max, msg + " Index: " + i + ", value: " + val);
        }
    };
    
    flock.test.assertContinuous = function (buffer, threshold, msg) {
        var previous = buffer[0],
            current,
            i;
        for (i = 1; i < buffer.length; i++) {
            current = buffer[i];
            if (Math.abs(previous - current) > threshold) {
                ok(false, msg + " Jump is at index " + i + ". Previous value: " + previous + " current value: " + current);
                return;
            }
            previous = current;
        }
        ok(true, msg);
    };
    
    flock.test.assertRamping = function (buffer, isAscending, msg) {
        var previous = buffer[0],
            current,
            isExpectedDirection = false,
            i;
        for (i = 1; i < buffer.length; i++) {
            current = buffer[i];
            isExpectedDirection = isAscending ? current > previous : current < previous;
            ok(isExpectedDirection, msg + " Index " + current);
        }
    };
    
    flock.test.assertSineish = function (buffer, max, msg) {
        var maxReached = false,
            isAscending = true,
            fail = false,
            i,
            current,
            next;

        for (i = 0; i < buffer.length - 1; i++) {
            current = buffer[i];
            next = buffer[i + 1];
            
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
                ok(false, "Signal changed direction before reaching maximum value at index: " + i + 
                ". Current value: " + current + ", next value: " + next);
                break;
            }
        }
        
        ok(maxReached, msg);
    };
    
    flock.test.assertOnlyValues = function (buffer, values, msg) {
        var outlierVals = [],
            outlierIndices = [],
            i;
        
        for (i = 0; i < buffer.length; i++) {
            var val = buffer[i];
            if (values.indexOf(val) === -1) {
                outliers.push(val);
                outlierIndices.push(i);
            }
        }
        
        equal(outlierVals.length, 0, msg);
    };
    
    flock.test.assertValueCount = function (buffer, value, expectedNum, msg) {
        var count = 0,
            i;
        
        for (i = 0; i < buffer.length; i++) {
            if (buffer[i] === value) {
                count++;
            }
        }
        
        equal(count, expectedNum, msg);
    };
        
    flock.test.mockUGen = function (inputs, output, options) {
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
    
    flock.test.makeMockUGen = function (output, rate) {
        if (typeof (output) === "function") {
            output = flock.generate(64, output);
        }
        
        return flock.parse.ugenForDef({
            ugen: "flock.test.mockUGen",
            rate: rate || flock.rates.AUDIO,
            options: {
                buffer: output
            }
        });
    };
    
    flock.test.makeRandomInputGenerator = function (inputSpec, defaultScale, round) {
        defaultScale = defaultScale || 500;
        var scale = typeof (inputSpec) === "string" ? defaultScale : inputSpec.scale,
            val;

        return function () {
            val = Math.random() * scale;
            return round ? Math.round(val) : val;
        };
    };
    
    flock.test.ascendingBuffer = function (numSamps, start, step) {
        start = start === undefined ? 0 : start;
        step = step === undefined ? 1 : step;
        
        return flock.generate(numSamps, function (i) {
            return start + (i * step);
        });
    };
    
    flock.test.assertSoleProperty = function (obj, prop, value) {
        if (arguments.length === 2) {
            value = true;
        }
        
        equal(obj[prop], value,
            "The expected property should have the correct value.");
        equal(1, Object.keys(obj).length,
            "There should be no other properties in the object.");
    };
    
    
}());
