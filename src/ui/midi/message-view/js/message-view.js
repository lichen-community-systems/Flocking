/*
 * Flocking UI MIDI Message View
 *   Copyright 2015, Colin Clark
 *
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require*/

var fluid = fluid || require("infusion");

(function () {
    "use strict";

    /**
     * Logs incoming MIDI messages from all <code>flock.midi.connection</code>s, globally.
     */
    fluid.defaults("flock.ui.midiMessageView", {
        gradeNames: "fluid.codeMirror",

        codeMirrorOptions: {
            readOnly: true
        },

        theme: "flockingcm",
        lineNumbers: true,
        readOnly: true,

        strings: {
            midiLogMessage: "%hours:%minutes:%seconds.%millis - %manufacturer %name: %msg"
        },

        distributeOptions: {
            // TODO: This is probably, umm, a bit heavy-handed.
            target: "{/ flock.midi.connection}.options",
            record: {
                listeners: {
                    message: {
                        func: "flock.ui.midiMessageView.logMIDI",
                        args: [
                            "{midiMessageView}",
                            "{midiMessageView}.options.strings.midiLogMessage",
                            "{arguments}.0",
                            "{arguments}.1"
                        ]
                    }
                }
            }
        }
    });

    flock.ui.midiMessageView.logMIDI = function (that, msgTemplate, msg, rawEvent) {
        var content = that.getContent(),
            nowDate = new Date();

        var port = rawEvent.target,
            messageText = fluid.stringTemplate(msgTemplate, {
                hours: nowDate.getHours(),
                minutes: nowDate.getMinutes(),
                seconds: nowDate.getSeconds(),
                millis: nowDate.getMilliseconds(),
                manufacturer: port.manufacturer,
                name: port.name,
                msg: fluid.prettyPrintJSON(msg)
            });

        var lastLinePos = CodeMirror.Pos(that.editor.lastLine());
        that.editor.replaceRange(messageText + "\n\n", lastLinePos);
    };
}());
