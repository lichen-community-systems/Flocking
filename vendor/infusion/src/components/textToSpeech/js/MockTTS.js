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

(function (fluid) {
    "use strict";

    /*********************************************************************************************
     * fluid.mock.textToSpeech component
     *********************************************************************************************/

    // Mocks the fluid.textToSpeech component, removing calls to the
    // Web Speech API. This will allow for tests to run in browsers
    // that don't support the Web Speech API.
    fluid.defaults("fluid.mock.textToSpeech", {
        model: {
            throwError: false
        },
        members: {
            // An archive of all the calls to queueSpeech.
            // Will contain an ordered set of objects -- {text: String, options: Object}.
            speechRecord: [],
            // An archive of all the events fired
            // Will contain a key/value pairing where key is the name of the event and the
            // value is the number of times the event was fired.
            eventRecord: {},
            lastUtterance: null
        },
        listeners: {
            // records
            "utteranceOnStart.recordUtterance": {
                funcName: "fluid.set",
                args: ["{that}", "{that}.queue.0"]
            },
            "onStart.recordEvent": {
                listener: "{that}.recordEvent",
                args: ["onStart"]
            },
            "onStop.recordEvent": {
                listener: "{that}.recordEvent",
                args: ["onStop"]
            },
            "onSpeechQueued.recordEvent": {
                listener: "{that}.recordEvent",
                args: ["onSpeechQueued"]
            },
            "onSpeechQueued.recordSpeech": {
                listener: "fluid.mock.textToSpeech.recordSpeech",
                args: ["{that}.speechRecord", "{arguments}.0.text", "{arguments}.1"]
            },
            // remove cleanup
            "onCreate.unloadCleanup": {
                funcName: "fluid.identity"
            },
            "onDestroy.cleanup": {
                funcName: "fluid.identity"
            }
        },
        invokers: {
            invokeSpeechSynthesisFunc: {
                funcName: "fluid.mock.textToSpeech.invokeStub",
                args: ["{that}", "{arguments}.0", "{arguments}.1"]
            },
            recordEvent: {
                funcName: "fluid.mock.textToSpeech.recordEvent",
                args: ["{that}.eventRecord", "{arguments}.0"]
            },
            // override the speak invoker to return the utterance component instead of the SpeechSynthesisUtterance instance
            speak: {
                funcName: "fluid.mock.textToSpeech.speakOverride",
                args: ["{that}"]
            }
        },
        distributeOptions: {
            record: {
                gradeNames: "fluid.mock.textToSpeech.utterance",
                model: {
                    throwError: "{fluid.mock.textToSpeech}.model.throwError"
                }
            },
            target: "{that fluid.textToSpeech.utterance}.options",
            namespace: "utteranceMock"
        }
    });

    fluid.mock.textToSpeech.speakOverride = function (that) {
        var utterance = that.queue[that.queue.length - 1];
        that.invokeSpeechSynthesisFunc("speak", utterance);
    };

    fluid.mock.textToSpeech.invokeStub = function (that, method, args) {
        args = fluid.makeArray(args);
        args.unshift(that);
        fluid.invokeGlobalFunction(["fluid", "mock", "textToSpeech", "stubs", method], args);
    };

    fluid.registerNamespace("fluid.mock.textToSpeech.stubs");

    fluid.mock.textToSpeech.stubs.speak = function (that, utterance) {
        utterance.speakUtterance();
    };

    fluid.mock.textToSpeech.stubs.cancel = function (that) {
        if (that.lastUtterance) {
            that.lastUtterance.dispatchEvent("end");
            that.lastUtterance = null;
        }
    };

    fluid.mock.textToSpeech.stubs.pause = function (that) {
        var utterance = that.queue[0];
        if (utterance) {
            utterance.dispatchEvent("pause");
        }
    };

    fluid.mock.textToSpeech.stubs.resume = function (that) {
        var utterance = that.queue[0];
        if (utterance) {
            utterance.speakUtterance(true);
        }
    };

    fluid.mock.textToSpeech.voices =  [
        {voiceURI: "Alex", name: "Alex", lang: "en-US", localService: true, default: true},
        {voiceURI: "Alice", name: "Alice", lang: "it-IT", localService: true, default: false}
    ];

    fluid.mock.textToSpeech.stubs.getVoices = function () {
        return fluid.mock.textToSpeech.voices;
    };

    fluid.mock.textToSpeech.recordEvent = function (eventRecord, name) {
        eventRecord[name] = (eventRecord[name] || 0) + 1;
    };

    fluid.mock.textToSpeech.recordSpeech = function (speechRecord, text, interrupt) {
        speechRecord.push({
            interrupt: !!interrupt,
            text: text
        });
    };

    /*********************************************************************************************
     * fluid.mock.textToSpeech.utterance component
     *********************************************************************************************/

    // to be added to a fluid.textToSpeech.utterance grade when the underlying SpeechSynthesisUtterance should be mocked.
    fluid.defaults("fluid.mock.textToSpeech.utterance", {
        invokers: {
            dispatchEvent: {
                funcName: "fluid.mock.textToSpeech.utterance.dispatchEvent",
                args: ["{that}.utterance", "{arguments}.0"]
            },
            utteranceEnd: {
                funcName: "fluid.mock.textToSpeech.utterance.utteranceEnd",
                args: ["{that}"]
            },
            speakUtterance: {
                funcName: "fluid.mock.textToSpeech.utterance.speakUtterance",
                args: ["{that}", "{arguments}.0"]
            }
        },
        synchronous: false
    });

    fluid.mock.textToSpeech.utterance.dispatchEvent = function (utterance, type) {
        var newEvent = new Event(type);
        utterance.dispatchEvent(newEvent);
    };

    fluid.mock.textToSpeech.utterance.utteranceEnd = function (that) {
        that.dispatchEvent("boundary");
        that.dispatchEvent("end");
    };

    fluid.mock.textToSpeech.utterance.speakUtterance = function (that, resume) {
        if (that.model.throwError) {
            that.dispatchEvent("error");
        } else {
            that.dispatchEvent(resume ? "resume" : "start");

            if (that.options.synchronous) {
                that.utteranceEnd();
            } else {
                setTimeout(that.utteranceEnd, that.utterance.text.length);
            }
        }

    };

})(fluid_3_0_0);
