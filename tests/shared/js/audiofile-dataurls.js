/*!
* Flocking - Audio File Data URLs
* http://github.com/colinbdclark/flocking
*
* Copyright 2012, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

var flock = flock || {};
flock.test = flock.test || {};

(function () {
    "use strict";

    flock.test.audio = flock.test.audio || {};
    
    flock.test.audio.b64Int16WAVData = "UklGRnYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YVIAAAAAAM0MmRlmJjMzAEDMTJlZZmYyc/9/MnNmZplZzEwAQDMzZiaZGc0MAAAz82fmmtnNzADANLNnppqZzowBgM6MmplnpjSzAMDNzJrZZ+Yz8wAA";
    flock.test.audio.triangleInt16WAV = "data:audio/wav;base64," + flock.test.audio.b64Int16WAVData;
    flock.test.audio.triangleInt16AIFF = "data:audio/aiff;base64,Rk9STQAAAIBBSUZGQ09NTQAAABIAAQAAACkAEEAOrEQAAAAAAABTU05EAAAAWgAAAAAAAAAAAAAMzRmZJmYzM0AATMxZmWZmczJ//3MyZmZZmUzMQAAzMyZmGZkMzQAA8zPmZ9mazM3AALM0pmeZmozOgAGMzpmapmezNMAAzM3ZmuZn8zMAAA==";

})();
