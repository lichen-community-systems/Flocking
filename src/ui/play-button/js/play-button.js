/*
 * Flocking UI Play Button
 *   Copyright 2014-2015, Colin Clark
 *
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var $ = fluid.registerNamespace("jQuery");

    fluid.defaults("flock.ui.toggleButton", {
        gradeNames: ["fluid.viewComponent"],

        selfRender: false,

        model: {
            isOn: false,
            isEnabled: true
        },

        invokers: {
            toggle: {
                funcName: "flock.ui.toggleButton.toggleModelState",
                args: ["{that}.model", "{that}.applier"]
            },

            on: {
                func: "{that}.applier.change",
                args: ["isOn", true]
            },

            off: {
                func: "{that}.applier.change",
                args: ["isOn", false]
            },

            enable: {
                changePath: "isEnabled",
                value: true
            },

            disable: {
                changePath: "isEnabled",
                value: false
            },

            refreshView: {
                funcName: "flock.ui.toggleButton.refreshView",
                args: ["{that}.model.isOn", "{that}.events.on.fire", "{that}.events.off.fire"]
            }
        },

        events: {
            on: null,
            off: null,
            enabled: null,
            disabled: null
        },

        listeners: {
            "onCreate.renderToggleButton": {
                funcName: "flock.ui.toggleButton.render",
                args: ["{that}"]
            },

            "onCreate.bindToggleButtonClick": {
                priority: "after:renderToggleButton",
                "this": "{that}.container",
                method: "click",
                args: "{that}.toggle"
            },

            "on.addEnabledStyling": {
                "this": "{that}.container",
                method: "addClass",
                args: ["{that}.options.styles.on"]
            },

            "on.removeDisabledStyling": {
                "this": "{that}.container",
                method: "removeClass",
                args: ["{that}.options.styles.off"]
            },

            "on.updateLabel": {
                "this": "{that}.container",
                method: "html",
                args: "{that}.options.strings.on"
            },

            "off.addDisabledStyle": {
                "this": "{that}.container",
                method: "addClass",
                args: ["{that}.options.styles.off"]
            },

            "off.removeEnabledStyle": {
                "this": "{that}.container",
                method: "removeClass",
                args: ["{that}.options.styles.on"]
            },

            "off.updateLabel": {
                "this": "{that}.container",
                method: "html",
                args: "{that}.options.strings.off"
            }
        },

        modelListeners: {
            "isOn": {
                func: "{that}.refreshView",
                priority: "first"
            },

            "isEnabled": {
                funcName: "flock.ui.toggleButton.updateEnabled",
                args: [
                    "{change}.value",
                    "{that}.container",
                    "{that}.events.enabled.fire",
                    "{that}.events.disabled.fire"
                ]
            }
        },

        strings: {
            on: "On",
            off: "Off",
        },

        markup: {
            button: "<button>%label</button>"
        },

        styles: {
            on: "on",
            off: "off"
        }
    });

    flock.ui.toggleButton.render = function (that) {
        if (!that.options.selfRender) {
            return;
        }

        var renderedMarkup = fluid.stringTemplate(that.options.markup.button, {
            label: that.options.strings.on
        });

        var button = $(renderedMarkup);
        that.container.append(button);
        that.container = button;
    };

    flock.ui.toggleButton.toggleModelState = function (model, applier) {
        applier.change("isOn", !model.isOn);
        return false;
    };

    flock.ui.toggleButton.refreshView = function (isOn, fireOn, fireOff) {
        if (isOn) {
            fireOn();
        } else {
            fireOff();
        }
    };

    flock.ui.toggleButton.updateEnabled = function (isEnabled, container, onEnabled, onDisabled) {
        container.prop("disabled", !isEnabled);

        if (isEnabled) {
            onEnabled();
        } else {
            onDisabled();
        }
    };


    /***************
     * Play Button *
     ***************/

    fluid.defaults("flock.ui.playButton", {
        gradeNames: ["flock.ui.toggleButton"],

        invokers: {
            play: {
                func: "{that}.on"
            },

            pause: {
                func: "{that}.off"
            }
        },

        events: {
            onPlay: "{that}.events.on",
            onPause: "{that}.events.off"
        },

        listeners: {
            "onCreate.addButtonStyle": {
                "this": "{that}.container",
                method: "addClass",
                args: "{that}.options.styles.playButton"
            },

            "onCreate.addIconFontStyle": {
                priority: "after:addButtonStyle",
                "this": "{that}.container",
                method: "addClass",
                args: "{that}.options.styles.iconFont"
            }
        },

        strings: {
            on: "Pause",
            off: "Play"
        },

        styles: {
            playButton: "flock-playButton",
            iconFont: "icon-",
            on: "playing",
            off: "paused"
        }
    });

    /**
     * A Play Button that starts and stops the Flocking environment,
     * fading in and out appropriately so as to avoid clicks.
     */
    fluid.defaults("flock.ui.enviroPlayButton", {
        gradeNames: ["flock.ui.playButton"],

        fadeDuration: 0.3,
        resetDelay: 0.0,

        members: {
            resetTime: "@expand:flock.ui.enviroPlayButton.calcResetTime({that}.options)"
        },

        components: {
            enviro: "{flock.enviro}",

            fader: {
                type: "flock.webAudio.outputFader",
                options: {
                    fadeDuration: "{enviroPlayButton}.options.fadeDuration"
                }
            }
        },

        events: {
            onFadeOut: null,
            onFadeIn: null,
            afterFadeOut: null
        },

        listeners: {
            "onFadeIn.startEnviro": "{that}.enviro.start()",

            "onFadeIn.fadeIn": {
                priority: "after:startEnviro",
                func: "{fader}.fadeIn",
                args: [1.0]
            },

            "onFadeOut.fadeOut": "{fader}.fadeTo(0.0)",

            "onFadeOut.disableButton": {
                priority: "after:fadeOut",
                funcName: "flock.ui.enviroPlayButton.disableForFadeOut",
                args: ["{that}.model", "{that}.applier"]
            },

            "onFadeOut.renableAfterFade": {
                priority: "after:disableButton",
                funcName: "flock.ui.enviroPlayButton.renableAfterFadeOutDelay",
                args: [
                    "{that}.enviro",
                    "{that}.model",
                    "{that}.applier",
                    "{that}.resetTime",
                    "{that}.events.afterFadeOut.fire"
                ]
            },

            "afterFadeOut.stopEnviro": {
                func: "{that}.enviro.stop",
                namespace: "stopEnviro"
            }
        },

        modelListeners: {
            isOn: {
                funcName: "flock.ui.enviroPlayButton.handleStateChange",
                args: ["{change}", "{that}.events.onFadeIn.fire", "{that}.events.onFadeOut.fire"],
                priority: "last"
            }
        }
    });

    flock.ui.enviroPlayButton.calcResetTime = function (o) {
        return o.fadeDuration + o.resetDelay;
    };

    flock.ui.enviroPlayButton.handleStateChange = function (change, onFadeIn, onFadeOut) {
        // TODO: Replace this with an excludeSource: "init" directive.
        if (!change.value) {
            // If we're in the initial model state, don't do anything.
            if (change.oldValue === undefined) {
                return;
            }

            onFadeOut();
        } else {
            onFadeIn();
        }
    };

    flock.ui.enviroPlayButton.disableForFadeOut = function (model, applier) {
        var didSelfDisable = model.isEnabled;
        applier.change("didSelfDisable", didSelfDisable);
        applier.change("isEnabled", false);
    };

    flock.ui.enviroPlayButton.renableAfterFadeOutDelay = function (enviro, model, applier, resetTime, afterFadeOut) {
        enviro.asyncScheduler.once(resetTime, function () {
            afterFadeOut();

            if (model.didSelfDisable) {
                applier.change("isEnabled", true);
            }
        });
    };

    /**
     * An enviroPlayButton that completely resets the environment
     * whenever it is paused, destroying any all
     */
    fluid.defaults("flock.ui.resetEnviroPlayButton", {
        gradeNames: ["flock.ui.enviroPlayButton"],

        listeners: {
            "afterFadeOut.resetEnviro": {
                func: "{that}.enviro.reset",
                priority: "after:stopEnviro"
            }
        }
    });

}());
