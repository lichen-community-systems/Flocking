/*
 * Flocking Media Element Input Demo
 *   Copyright 2013-2014, Colin Clark
 *
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global fluid*/

(function () {
    "use strict";

    fluid.defaults("flock.demo.mediaElementInput", {
        gradeNames: ["fluid.viewComponent", "flock.band", "autoInit"],

        components: {
            synth: {
                type: "flock.synth",
                options: {
                    synthDef: {
                        ugen: "flock.ugen.granulator",
                        numGrains: {
                            ugen: "flock.ugen.lfNoise",
                            freq: 1/5,
                            mul: 50,
                            add: 52,
                            options: {
                                interpolation: "linear"
                            }
                        },
                        grainDur: {
                            ugen: "flock.ugen.sinOsc",
                            freq: {
                                ugen: "flock.ugen.lfNoise",
                                freq: 1/2,
                                mul: 1/3,
                                add: 1/3,
                                options: {
                                    interpolation: "linear"
                                }
                            },
                            mul: 0.1,
                            add: 0.2
                        },
                        source: {
                            ugen: "flock.ugen.mediaIn",
                            options: {
                                selector: "{that}.container"
                            }
                        }
                    }
                }
            }
        },

        listeners: {
            onCreate: {
                func: "{that}.play"
            }
        }
    });

}());
