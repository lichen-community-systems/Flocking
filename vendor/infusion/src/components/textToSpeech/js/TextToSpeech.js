/*
Copyright The Infusion copyright holders
See the AUTHORS.md file at the top-level directory of this distribution and at
https://github.com/fluid-project/infusion/raw/main/AUTHORS.md.

Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.

You may obtain a copy of the ECL 2.0 License and BSD License at
https://github.com/fluid-project/infusion/raw/main/Infusion-LICENSE.txt

*/

(function ($, fluid) {
    "use strict";

    /*********************************************************************************************
     * fluid.window is a singleton component to be used for registering event bindings to        *
     * events fired by the window object                                                         *
     *********************************************************************************************/

    fluid.defaults("fluid.window", {
        gradeNames: ["fluid.component", "fluid.resolveRootSingle"],
        singleRootType: "fluid.window",
        members: {
            window: window
        },
        listeners: {
            "onCreate.bindEvents": {
                funcName: "fluid.window.bindEvents",
                args: ["{that}"]
            }
        }
    });

    /**
     * Adds a lister to a window event for each event defined on the component.
     * The name must match a valid window event.
     *
     * @param {fluid.window} that - an instance of `fluid.window`
     */
    fluid.window.bindEvents = function (that) {
        fluid.each(that.options.events, function (type, eventName) {
            window.addEventListener(eventName, that.events[eventName].fire);
        });
    };

    /*********************************************************************************************
     * fluid.textToSpeech provides a wrapper around the SpeechSynthesis Interface                *
     * from the Web Speech API ( https://w3c.github.io/speech-api/speechapi.html#tts-section )   *
     *********************************************************************************************/

    fluid.registerNamespace("fluid.textToSpeech");

    fluid.textToSpeech.isSupported = function () {
        return !!(window && window.speechSynthesis);
    };

    /*********************************************************************************************
     * fluid.textToSpeech component
     *********************************************************************************************/

    fluid.defaults("fluid.textToSpeech", {
        gradeNames: ["fluid.modelComponent", "fluid.resolveRootSingle"],
        singleRootType: "fluid.textToSpeech",
        events: {
            onStart: null,
            onStop: null,
            onError: null,
            onSpeechQueued: null,
            utteranceOnBoundary: null,
            utteranceOnEnd: null,
            utteranceOnError: null,
            utteranceOnMark: null,
            utteranceOnPause: null,
            utteranceOnResume: null,
            utteranceOnStart: null
        },
        members: {
            queue: []
        },
        components: {
            wndw: {
                type: "fluid.window",
                options: {
                    events: {
                        beforeunload: null
                    }
                }
            }
        },
        dynamicComponents: {
            utterance: {
                type: "fluid.textToSpeech.utterance",
                createOnEvent: "onSpeechQueued",
                options: {
                    listeners: {
                        "onBoundary.relay": "{textToSpeech}.events.utteranceOnBoundary.fire",
                        "onEnd.relay": {
                            listener: "{textToSpeech}.events.utteranceOnEnd.fire",
                            priority: "before:resolvePromise"
                        },
                        "onError.relay": {
                            listener: "{textToSpeech}.events.utteranceOnError.fire",
                            priority: "before:rejectPromise"
                        },
                        "onError.destroy": {
                            listener: "{that}.destroy",
                            priority: "after:rejectPromise"
                        },
                        "onMark.relay": "{textToSpeech}.events.utteranceOnMark.fire",
                        "onPause.relay": "{textToSpeech}.events.utteranceOnPause.fire",
                        "onResume.relay": "{textToSpeech}.events.utteranceOnResume.fire",
                        "onStart.relay": "{textToSpeech}.events.utteranceOnStart.fire",
                        "onCreate.followPromise": {
                            funcName: "fluid.promise.follow",
                            args: ["{that}.promise", "{that}.options.onSpeechQueuePromise"]
                        },
                        "onCreate.queue": {
                            "this": "{fluid.textToSpeech}.queue",
                            method: "push",
                            args: ["{that}"],
                            priority: "after:followPromise"
                        },
                        "onCreate.speak": {
                            listener: "{textToSpeech}.speak",
                            args: ["{that}.utterance"],
                            priority: "after:queue"
                        },
                        "onEnd.destroy": {
                            func: "{that}.destroy",
                            priority: "last"
                        }
                    },
                    onSpeechQueuePromise: "{arguments}.2",
                    utterance: "{arguments}.0"
                }
            }
        },
        // Model paths: speaking, pending, paused, utteranceOpts, pauseRequested, resumeRequested
        model: {
            // Changes to the utteranceOpts will only affect text that is queued after the change.
            // All of these options can be overridden in the queueSpeech method by passing in
            // options directly there. It is useful in cases where a single instance needs to be
            // spoken with different options (e.g. single text in a different language.)
            utteranceOpts: {
                // text: "", // text to synthesize. Avoid using, it will be overwritten by text passed in directly to a queueSpeech
                // lang: "", // the language of the synthesized text
                // voice: {} // a WebSpeechSynthesis object; if not set, will use the default one provided by the browser
                // volume: 1, // a Floating point number between 0 and 1
                // rate: 1, // a Floating point number from 0.1 to 10 although different synthesizers may have a smaller range
                // pitch: 1, // a Floating point number from 0 to 2
            }
        },
        modelListeners: {
            "speaking": {
                listener: "fluid.textToSpeech.toggleSpeak",
                args: ["{that}", "{change}.value"]
            },
            "pauseRequested": {
                listener: "fluid.textToSpeech.requestControl",
                args: ["{that}", "pause", "{change}"]
            },
            "resumeRequested": {
                listener: "fluid.textToSpeech.requestControl",
                args: ["{that}", "resume", "{change}"]
            }
        },
        invokers: {
            queueSpeech: {
                funcName: "fluid.textToSpeech.queueSpeech",
                args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"]
            },
            queueSpeechSequence: {
                funcName: "fluid.textToSpeech.queueSpeechSequence",
                args: ["{that}", "{arguments}.0", "{arguments}.1"]
            },
            cancel: {
                funcName: "fluid.textToSpeech.cancel",
                args: ["{that}"]
            },
            pause: {
                changePath: "pauseRequested",
                value: true,
                source: "pause"
            },
            resume: {
                changePath: "resumeRequested",
                value: true,
                source: "resume"
            },
            getVoices: {
                func: "{that}.invokeSpeechSynthesisFunc",
                args: ["getVoices"]
            },
            speak: {
                func: "{that}.invokeSpeechSynthesisFunc",
                args: ["speak", "{arguments}.0"]
            },
            invokeSpeechSynthesisFunc: "fluid.textToSpeech.invokeSpeechSynthesisFunc"
        },
        listeners: {
            "utteranceOnStart.speaking": {
                changePath: "speaking",
                value: true,
                source: "utteranceOnStart"
            },
            "utteranceOnEnd.stop": {
                funcName: "fluid.textToSpeech.handleEnd",
                args: ["{that}"]
            },
            "onError.stop": {
                funcName: "fluid.textToSpeech.handleEnd",
                args: ["{that}"]
            },
            "utteranceOnError.forward": "{that}.events.onError",
            "utteranceOnPause.pause": {
                changePath: "paused",
                value: true,
                source: "utteranceOnPause"
            },
            "utteranceOnResume.resume": {
                changePath: "paused",
                value: false,
                source: "utteranceOnResume"
            },
            "onDestroy.cleanup": {
                func: "{that}.invokeSpeechSynthesisFunc",
                args: ["cancel"]
            },
            "{wndw}.events.beforeunload": {
                funcName: "{that}.invokeSpeechSynthesisFunc",
                args: ["cancel"],
                namespace: "cancelSpeechSynthesisOnUnload"
            }
        }
    });

    /**
     * Wraps the SpeechSynthesis API
     *
     * @param {String} method - a SpeechSynthesis method name
     * @param {Array} args - arguments to call the method with. If args isn't an array, it will be added as the first
     *                       element of one.
     */
    fluid.textToSpeech.invokeSpeechSynthesisFunc = function (method, args) {
        args = fluid.makeArray(args);
        speechSynthesis[method].apply(speechSynthesis, args);
    };

    fluid.textToSpeech.toggleSpeak = function (that, speaking) {
        that.events[speaking ? "onStart" : "onStop"].fire();
    };

    fluid.textToSpeech.requestControl = function (that, control, change) {
        // If there's a control request (value change to true), clear and
        // execute it
        if (change.value) {
            that.applier.change(change.path, false, "ADD", "requestControl");
            that.invokeSpeechSynthesisFunc(control);
        }
    };

    /*
     * After an utterance has finished, the utterance is removed from the queue and the model is updated as needed.
     */
    fluid.textToSpeech.handleEnd = function (that) {
        that.queue.shift();

        var resetValues = {
            speaking: false,
            pending: false,
            paused: false
        };

        if (that.queue.length) {
            that.applier.change("pending", true, "ADD", "handleEnd.pending");
        } else if (!that.queue.length) {
            var newModel = $.extend({}, that.model, resetValues);
            that.applier.change("", newModel, "ADD", "handleEnd.reset");
        }
    };

    /**
     * Options to configure the SpeechSynthesis Utterance with.
     * See: https://w3c.github.io/speech-api/speechapi.html#utterance-attributes
     *
     * @typedef {Object} UtteranceOpts
     * @property {String} text - The text to Synthesize
     * @property {String} lang - The BCP 47 language code for the synthesized text
     * @property {WebSpeechSynthesis} voice - If not set, will use the default one provided by the browser
     * @property {Float} volume - A Floating point number between 0 and 1
     * @property {Float} rate - A Floating point number from 0.1 to 10 although different synthesizers may have a smaller range
     * @property {Float} pitch - A Floating point number from 0 to 2
     */

    /**
     * Assembles the utterance options and fires onSpeechQueued which will kick off the creation of an utterance
     * component. If "interrupt" is true, this utterance will replace any existing ones.
     *
     * @param {fluid.textToSpeech} that - an instance of the component
     * @param {String} text - the text to be synthesized
     * @param {Boolean} interrupt - used to indicate if this text should be queued or replace existing utterances
     * @param {UtteranceOpts} options - options to configure the {SpeechSynthesisUtterance} with. It is merged on top of
     *                                  the `utteranceOpts` from the component's model.
     *
     * @return {Promise} - returns a promise that is resolved/rejected from the related `fluid.textToSpeech.utterance`
     *                     instance.
     */
    fluid.textToSpeech.queueSpeech = function (that, text, interrupt, options) {
        var promise = fluid.promise();
        if (interrupt) {
            that.cancel();
        }

        var utteranceOpts = $.extend({}, that.model.utteranceOpts, options, {text: text});

        // The setTimeout is needed for Safari to fully cancel out the previous speech.
        // Without this the synthesizer gets confused and may play multiple utterances at once.
        setTimeout(function () {
            that.events.onSpeechQueued.fire(utteranceOpts, interrupt, promise);
        }, 100);
        return promise;
    };

    /**
     * Values to configure the SpeechSynthesis Utterance with.
     * See: https://w3c.github.io/speech-api/speechapi.html#utterance-attributes
     *
     * @typedef {Object} Speech
     * @property {String} text - the text to Synthesize
     * @property {UtteranceOpts} options - options to configure the {SpeechSynthesisUtterance} with. It is merged on top
     *                                     of the `utteranceOpts` from the component's model.
     */

    /**
     * Queues a {Speech[]}, calling `that.queueSpeech` for each. This is useful for sets of text that should be
     * synthesized with differing {UtteranceOpts}, but still treated as an atomic unit. For example, if a set of text
     * includes words from different languages.
     *
     * @param  {fluid.textToSpeech} that - an instance of the component
     * @param  {Speech[]} speeches - the set of text to queue as a unit
     * @param  {Boolean} interrupt - used to indicate if the related text should be queued or replace existing
     *                               utterances
     *
     * @return {Promise} - returns a promise that is resolved/rejected after all of the speeches have finish or any
     *                     have been rejected.
     */
    fluid.textToSpeech.queueSpeechSequence = function (that, speeches, interrupt) {
        var sequence = fluid.transform(speeches, function (speech, index) {
            var toInterrupt = interrupt && !index; // only interrupt on the first string
            return that.queueSpeech(speech.text, toInterrupt, speech.options);
        });
        return fluid.promise.sequence(sequence);
    };

    /**
     * Manually fires the `onEnd` event of each remaining `fluid.textToSpeech.utterance` component in the queue. This
     * is required because if the SpeechSynthesis is cancelled remaining {SpeechSynthesisUtterance} are ignored and do
     * not fire their `onend` event.
     *
     * @param  {fluid.textToSpeech} that - an instance of the component
     */
    fluid.textToSpeech.cancel = function (that) {
        // Safari does not fire the onend event from an utterance when the speech synthesis is cancelled.
        // Manually triggering the onEnd event for each utterance as we empty the queue, before calling cancel.
        while (that.queue.length) {
            var utterance = that.queue[0];
            utterance.events.onEnd.fire();
        }

        that.invokeSpeechSynthesisFunc("cancel");
        // clear any paused state.
        that.invokeSpeechSynthesisFunc("resume");
    };

    /*********************************************************************************************
     * fluid.textToSpeech.utterance component
     *********************************************************************************************/

    fluid.defaults("fluid.textToSpeech.utterance", {
        gradeNames: ["fluid.modelComponent"],
        members: {
            utterance: {
                expander: {
                    funcName: "fluid.textToSpeech.utterance.construct",
                    args: ["{that}", "{that}.options.utteranceEventMap", "{that}.options.utterance"]
                }
            },
            promise: {
                expander: {
                    funcName: "fluid.promise"
                }
            }
        },
        model: {
            boundary: 0
        },
        utterance: {
            // text: "", // text to synthesize. avoid as it will override any other text passed in
            // lang: "", // the language of the synthesized text
            // voice: {} // a WebSpeechSynthesis object; if not set, will use the default one provided by the browser
            // volume: 1, // a Floating point number between 0 and 1
            // rate: 1, // a Floating point number from 0.1 to 10 although different synthesizers may have a smaller range
            // pitch: 1, // a Floating point number from 0 to 2
        },
        utteranceEventMap: {
            onboundary: "onBoundary",
            onend: "onEnd",
            onerror: "onError",
            onmark: "onMark",
            onpause: "onPause",
            onresume: "onResume",
            onstart: "onStart"
        },
        events: {
            onBoundary: null,
            onEnd: null,
            onError: null,
            onMark: null,
            onPause: null,
            onResume: null,
            onStart: null
        },
        listeners: {
            "onBoundary.updateModel": {
                changePath: "boundary",
                value: "{arguments}.0.charIndex"
            },
            "onEnd.resolvePromise": "{that}.promise.resolve",
            "onError.rejectPromise": "{that}.promise.reject"
        }
    });

    /**
     * Creates a SpeechSynthesisUtterance instance and configures it with the utteranceOpts and utteranceMap. For any
     * event provided in the utteranceEventMap, any corresponding event binding passed in directly through the
     * utteranceOpts will be rebound as component event listeners with the "external" namespace.
     *
     * @param {fluid.textToSpeech.utterance} that - an instance of the component
     * @param {Object} utteranceEventMap - a mapping from {SpeechSynthesisUtterance} events to component events.
     * @param {UtteranceOpts} utteranceOpts - options to configure the {SpeechSynthesisUtterance} with.
     *
     * @return {SpeechSynthesisUtterance} - returns the created {SpeechSynthesisUtterance} object
     */
    fluid.textToSpeech.utterance.construct = function (that, utteranceEventMap, utteranceOpts) {
        var utterance = new SpeechSynthesisUtterance();
        $.extend(utterance, utteranceOpts);

        fluid.each(utteranceEventMap, function (compEventName, utteranceEvent) {
            var compEvent = that.events[compEventName];
            var origHandler = utteranceOpts[utteranceEvent];

            utterance[utteranceEvent] = compEvent.fire;

            if (origHandler) {
                compEvent.addListener(origHandler, "external");
            }
        });

        return utterance;
    };


})(jQuery, fluid_3_0_0);
