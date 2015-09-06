/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2013, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global module, test, Float32Array*/

var flock = flock || {};

(function () {
    "use strict";

    module("Flocking Test Utilities Tests");

    test("arrayNotNaN", function () {
        var noNaNs = new Float32Array([1.1, 2.2, 3.3, 4.4, 5.5]);
        flock.test.arrayNotNaN(noNaNs, "An array with no NaNs in it should pass.");        
    });
    
    test("equalRounded expected success.", function () {
        flock.test.equalRounded(2, 2.334, 2.33,
            "Should round down to two decimal places.");
        flock.test.equalRounded(10, 2.333333333333, 2.3333333333,
            "Should round down to ten decimal places.");
        flock.test.equalRounded(1, 2.35, 2.4,
            "Should round up to one decimal place.");
    });
    
    test("arrayNotSilent expected success.", function () {
        var overTenPercent = new Float32Array([1.0, 0.0, 0.0, 0.0, 1.0]);
        flock.test.arrayNotSilent(overTenPercent,
            "arrayNotSilent should pass when less than 10% of values are 0.0.");
        
        var noisy = new Float32Array([1.1, 2.2, 3.3, 4.4, 3.3, 2.2, 1.1, 0.0, 1.1, 2.2]);
        flock.test.arrayNotSilent(noisy,
            "arrayNotSilent should pass when only one sample is 0.0.");
    });
    
    test("arraySilent expected success.", function () {
        var silent = new Float32Array([0.0, 0.0, 0.0, 0.0, 0.0]);
        flock.test.arraySilent(silent,
            "arraySilent should pass when all samples are 0.0.");
    });
    
    test("arrayUnbroken expected success.", function () {
        var smallGap = new Float32Array([1.1, 2.2, 0.0, 0.0, 0.0, 0.0, 0.0, 3.3, 4.4, 5.5]);
        flock.test.arrayUnbroken(smallGap,
            "arrayUnbroken should pass whenever there are five or fewer 0.0 samples in a row.");
            
        var severalGaps = new Float32Array([1.1, 2.2, 0.0, 0.0, 0.0, 0.0, 3.3, 4.4, 0.0, 0.0, 0.0, 0.0, 5.5]);
        flock.test.arrayUnbroken(severalGaps,
            "arrayUnbroken should pass whenever there are more than five 0.0, but the are discontiguous.");
        
        var noisy = new Float32Array([1.1, 2.2, 3.3, 4.4, 5.5]);
        flock.test.arrayUnbroken(noisy,
            "arrayUnbroken should pass when there are no silent samples");
    });
    
    test("arrayWithinRange expected success.", function () {
        var buffer = new Float32Array([1.0, 5.0, 6.6, -14, 8.8, 9.0, 10.1]);
        flock.test.arrayWithinRange(buffer, -14, 10.2, 
            "arrayWithinRange should pass when the min and max values are at the edges of the buffer.");
        flock.test.arrayWithinRange(buffer, -100, 100, 
            "arrayWithinRange should pass when the min and max values are well above the range of the buffer.");
    });
    
    test("continuousArray expected success.", function () {
        var smallSteps = new Float32Array([1.1, 1.2, 1.3, 1.34, 1.4, 1.5]);
        flock.test.continuousArray(smallSteps, 1.1,
            "continuousArray should pass when values in the buffer change at a rate smaller or equal to the threshold.");
         
        var directionChange = new Float32Array([1.1, 1.2, 1.1, 1.2]);
        flock.test.continuousArray(directionChange, 1.1,
            "continuousArray should pass when the direction changes within the step size."); 
    });
    
    test("rampingArray expected success.", function () {
        var ascending = new Float32Array([0.0, 1.1, 1.2, 3.0, 10.0]);
        flock.test.rampingArray(ascending, true,
            "rampingArray should pass when the array increases in value every sample.");
            
        var descending = new Float32Array([0.0, -0.1, -1.1, -1.2, -3.0, -10]);
        flock.test.rampingArray(descending, false,
            "rampingArray should pass when the array decreases in value every sample.");    
    });
    
    test("sineishArray expected success.", function () {
        var buffer = new Float32Array([-1.0, -0.5, 0.0, 0.5, 1.0]);
        flock.test.sineishArray(buffer, 1.0, false,
            "sineishArray should pass when the buffer rises and falls consistently.");
    });
    
    test("arrayContainsOnlyValues expected success", function () {
        var buffer = new Float32Array([1.5, 2.5, 3.5, 4.5, 5.5, 5.5, 5.5]);
        flock.test.arrayContainsOnlyValues(buffer, [1.5, 2.5, 3.5, 4.5, 5.5],
            "arrayContainsOnlyValues should pass when the buffer only contains the expected values.");
        flock.test.arrayContainsOnlyValues(buffer, [1.5, 2.5, 3.5, 4.5, 5.5, 6.5],
            "arrayContainsOnlyValues should pass when the buffer only contains fewer values than the expected values.");
    });
    
    test("containsSoleProperty expected success.", function () {
        var obj = {
            cat: "meow"
        };
        
        flock.test.containsSoleProperty(obj, "cat", "meow",
            "containsSoleProperty should pass when there is only one key in the object and its value matches the expected value.");
    });
    
    test("valueCount expected success.", function () {
        var buffer = new Float32Array([1.1, 2.2, 3.3, 4.4, 5.5, 5.5, 5.5]);
        flock.test.valueCount(buffer, 5.5, 3,
            "valueCount should pass when the value appears the expected number of times.");
    });
    
    
    
    test("arrayNotNaN expected failure.", function () {
        var nans = new Float32Array([1.1, 2.2, NaN, 4.4, 5.5]);
        flock.test.arrayNotNaN(nans, "THIS TEST SHOULD FAIL: An array with NaN in it should cause a failure.");
    });

    test("equalRounded expected failure.", function () {
        flock.test.equalRounded(1, 2.333, 2.4, 
            "THIS SHOULD FAIL: equalRounded should fail when two values aren't equal after rounding.");
    });
    
    test("arrayNotSilent expected failure.", function () {
        var silent = new Float32Array([0.0, 0.0, 0.0, 0.0, 0.0]);
        flock.test.arrayNotSilent(silent,
            "THIS SHOULD FAIL: arrayNotSilent should fail when all values are 0.0.");
        
        var partiallySilent = new Float32Array([0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0]);
        flock.test.arrayNotSilent(partiallySilent,
            "THIS SHOULD FAIL: arrayNotSilent should fail when 10% of values are 0.0.");
    });
    
    test("arraySilent expected failure.", function () {
        var mostlySilent = new Float32Array([0.0, 0.0, 0.0, 0.0, 1.0]);
        flock.test.arraySilent(mostlySilent,
            "THIS SHOULD FAIL: arraySilent should fail whenever there are any non-0.0 samples.");
    });
    
    test("arrayUnbroken expected failure.", function () {
        var broken = new Float32Array([1.1, 2.2, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 3.3, 4.4, 5.5]);
        flock.test.arrayUnbroken(broken,
            "THIS SHOULD FAIL: arrayUnbroken should fail whenever there are more than five 0.0 samples in a row.");
    });
    
    test("arrayWithinRange expected failure.", function () {
        var buffer = new Float32Array([1.0, 5.0, 6.6, -14, 8.8, 9.0, 10.1]);
        flock.test.arrayWithinRange(buffer, -1.0, 10.2, 
            "THIS SHOULD FAIL: arrayWithinRange should fail when buffer has values smaller than the min value.");
        flock.test.arrayWithinRange(buffer, -14, 1.0, 
            "THIS SHOULD FAIL: arrayWithinRange should fail when buffer has values larger than the max value.");
    });
    
    test("continuousArray expected failure.", function () {
        var largeSteps = new Float32Array([1.1, 1.2, 1.3, 1.4, 1.5]);
        flock.test.continuousArray(largeSteps, 0.05,
            "THIS SHOULD FAIL: continuousArray should fail when values in the buffer change at a rate larger than the threshold.");
         
        var unexpectedDirectionChange = new Float32Array([1.1, 1.2, -4, 1.3]);
        flock.test.continuousArray(unexpectedDirectionChange, 1.1,
            "THIS SHOULD FAIL: continuousArray should fail when the direction changes unexpectedly."); 
    });
    
    test("rampingArray expected failure.", function () {
        var notAscending = new Float32Array([0.0, 1.1, 1.0, 3.0, 10.0]);
        flock.test.rampingArray(notAscending, true,
            "THIS SHOULD FAIL: rampingArray should fail when the array doesn't increase in value every sample.");
            
        var notDescending = new Float32Array([0.0, -0.1, -1.1, 15, -3.0, -10]);
        flock.test.rampingArray(notDescending, false,
            "THIS SHOULD FAIL: rampingArray should fail when the array doesn't decrease every sample.");    
    });
    
    test("sineishArray expected failure.", function () {
        var unexpectedDirection = new Float32Array([-1.0, 0.0, -0.5, 1.0]);
        flock.test.sineishArray(unexpectedDirection, 1.0, false,
            "THIS SHOULD FAIL: sineishArray should fail when the buffer changes direction unexpectedly.");
        
        var doesntReachTarget = new Float32Array([-1.0, -0.5, 0.0, 0.5, 0.0, -0.5, -1.0]);
        flock.test.sineishArray(doesntReachTarget, 1.0, false, 
            "THIS SHOULD FAIL: sineishArray should fail when the buffer changes direction before meeting its target value.");
    });
    
    test("containsSoleProperty expected failure.", function () {
        var moreThanOne = {
            cat: "meow",
            dog: "bark"
        };
        
        flock.test.containsSoleProperty(moreThanOne, "cat", "meow",
            "THE SECOND ASSERT SHOULD FAIL: containsSoleProperty should fail when there is more than one key in the object.");
        
        var wrongValue = {
            cat: "woof"
        };
        flock.test.containsSoleProperty(wrongValue, "cat", "meow",
            "THE FIRST ASSERT SHOULD FAIL: containsSoleProperty should fail when there is one key in the object but the value doesn't match.");
    });
    
    test("arrayContainsOnlyValues expected failure.", function () {
        var buffer = new Float32Array([1.5, 2.5, 3.5, 4.5, 5.5, 5.5, 5.5, 6.5]);
        flock.test.arrayContainsOnlyValues(buffer, [1.5, 2.5, 3.5, 4.5, 5.5],
            "THIS SHOULD FAIL: arrayContainsOnlyValues should fail when the buffer contains values other than the expected values.");
    });
    
    test("valueCount expected failure.", function () {
        var buffer = new Float32Array([1.1, 2.2, 3.3, 4.4, 5.5, 5.5, 5.5]);
        flock.test.valueCount(buffer, 6.6, 5,
            "THIS SHOULD FAIL: valueCount should fail when the value doesn't appear at all in the array.");
        flock.test.valueCount(buffer, 5.5, 4,
            "THIS SHOULD FAIL: asserValueCount should fail when the value doesn't appear the expected number of times.");
    });
    
}());
