/*
 * Flocking Silent Enviro
 * https://github.com/colinbdclark/flocking
 *
 * Copyright 2013-2019, Colin Clark
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/**
 * An environment grade that is configured to always output
 * silence using a Web Audio GainNode. This is useful for unit testing,
 * where failures could produce painful or unexpected output.
 */
fluid.defaults("flock.silentEnviro", {
    gradeNames: "flock.enviro",

    listeners: {
        "onCreate.insertGainNode": {
            funcName: "flock.silentEnviro.insertOutputGainNode",
            args: "{that}"
        }
    }
});

flock.silentEnviro.insertOutputGainNode = function (that) {
    if (that.audioSystem.nativeNodeManager) {
        that.audioSystem.nativeNodeManager.createOutputNode({
            node: "Gain",
            params: {
                gain: 0
            }
        });
    }
};
