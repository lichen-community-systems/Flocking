/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2011, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global module, test, expect, ok, equals, deepEqual, Float32Array*/

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
        for (var i = 0; i < expected.length; i++) {
            equals(actual[i], expected[i], msg + " Index: " + i);
        }
    };
    
    flock.test.assertNotNaN = function (buffer, msg) {
        var i;
        for (i = 0; i < buffer.length; i++) {
            if (isNaN(buffer[i])) {
                ok(false, "NaN value found at index " + i);
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
            
            if (Math.abs(current) === max) {
                isAscending = !isAscending;
                maxReached = true;
            }
            
            fail = isAscending ? (next < current) : (next > current);
            if (fail) {
                ok(fail, "Signal changed direction before reaching maximum value at index: " + i + 
                ". Current value: " + current + ", next value: " + next);
                break;
            }
        }
        
        ok(maxReached, msg);
    };
}());
