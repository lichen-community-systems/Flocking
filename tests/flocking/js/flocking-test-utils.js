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
    }
    
}());