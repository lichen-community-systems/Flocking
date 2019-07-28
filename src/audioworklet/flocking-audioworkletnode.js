/*
 * Flocking AudioWorkletNode
 * https://github.com/colinbdclark/flocking
 *
 * Copyright 2019, Colin Clark
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global AudioWorkletNode*/
/*jshint esversion:6*/

class FlockingAudioWorkletNode extends AudioWorkletNode { // jshint ignore:line
    constructor (context) {
        super(context, "flocking-processor");
    }
}
