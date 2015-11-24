/*
* Flocking Web Audio System
* http://github.com/colinbdclark/flocking
*
* Copyright 2013-2015, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*global require*/
/*jshint white: false, newcap: true, regexp: true, browser: true,
    forin: false, nomen: true, bitwise: false, maxerr: 100,
    indent: 4, plusplus: false, curly: true, eqeqeq: true,
    freeze: true, latedef: true, noarg: true, nonew: true, quotmark: double, undef: true,
    unused: true, strict: true, asi: false, boss: false, evil: false, expr: false,
    funcscope: false*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {

    "use strict";

    fluid.defaults("flock.webAudio.audioSystem", {
        gradeNames: ["flock.audioSystem"],

        channelRange: {
            min: "@expand:flock.webAudio.audioSystem.calcMinChannels()",
            max: "@expand:flock.webAudio.audioSystem.calcMaxChannels({that}.context.destination)"
        },

        members: {
            context: "@expand:flock.webAudio.audioSystem.createContext()"
        },

        model: {
            rates: {
                audio: "{that}.context.sampleRate"
            }
        },

        components: {
            outputManager: {
                type: "flock.webAudio.outputManager"
            },

            nativeNodeManager: {
                type: "flock.webAudio.nativeNodeManager"
            },

            inputDeviceManager: {
                type: "flock.webAudio.inputDeviceManager"
            },

            bufferWriter: {
                type: "flock.webAudio.bufferWriter"
            }
        },

        listeners: {
            onCreate: [
                "flock.webAudio.audioSystem.configureDestination({that}.context, {that}.model.chans)"
            ]
        }
    });

    flock.webAudio.audioSystem.createContext = function () {
        var system = flock.webAudio.audioSystem;
        if (!system.audioContextSingleton) {
            system.audioContextSingleton = new flock.shim.AudioContext();
        }

        return system.audioContextSingleton;
    };

    flock.webAudio.audioSystem.calcMaxChannels = function (destination) {
        return flock.platform.browser.safari ? destination.channelCount :
            destination.maxChannelCount;
    };

    flock.webAudio.audioSystem.calcMinChannels = function () {
        return flock.platform.browser.safari ? 2 : 1;
    };

    flock.webAudio.audioSystem.configureDestination = function (context, chans) {
        // Safari will throw an InvalidStateError DOM Exception 11 when
        // attempting to set channelCount on the audioContext's destination.
        // TODO: Remove this conditional when Safari adds support for multiple channels.
        if (!flock.platform.browser.safari) {
            context.destination.channelCount = chans;
            context.destination.channelCountMode = "explicit";
            context.destination.channelInterpretation = "discrete";
        }
    };

    fluid.defaults("flock.webAudio.enviroContextDistributor", {
        gradeNames: ["fluid.component"],

        distributeOptions: [
            {
                target: "{/ flock.enviro > audioSystem}.options",
                record: {
                    gradeNames: "flock.webAudio.audioSystem"
                }
            }
        ]
    });

    fluid.constructSingle([], {
        singleRootType: "flock.enviroContextDistributor",
        type: "flock.webAudio.enviroContextDistributor"
    });
}());
