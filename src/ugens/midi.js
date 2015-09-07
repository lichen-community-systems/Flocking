/*
 * Flocking MIDI Unit Generators
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2011-2014, Colin Clark
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

    flock.ugen.midiFreq = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                a4 = m.a4,
                a4Freq = a4.freq,
                a4NoteNum = a4.noteNum,
                notesPerOctave = m.notesPerOctave,
                noteNum = that.inputs.note.output,
                out = that.output,
                i,
                j,
                val;

            for (i = 0, j = 0; i < numSamps; i++, j += m.strides.note) {
                out[i] = val = flock.midiFreq(noteNum[j], a4Freq, a4NoteNum, notesPerOctave);
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.init = function () {
            that.model.octaveScale = 1 / that.model.notesPerOctave;
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    flock.ugenDefaults("flock.ugen.midiFreq", {
        rate: "control",
        inputs: {
            note: 69
        },
        ugenOptions: {
            model: {
                unscaledValue: 0.0,
                value: 0.0,
                a4: {
                    noteNum: 69,
                    freq: 440
                },
                notesPerOctave: 12
            },
            strideInputs: [
                "note"
            ]
        }
    });


    flock.ugen.midiAmp = function (inputs, output, options) {
        var that = flock.ugen(inputs, output, options);

        that.gen = function (numSamps) {
            var m = that.model,
                velocity = that.inputs.velocity.output,
                out = that.output,
                i,
                j,
                val;

            for (i = 0, j = 0; i < numSamps; i++, j += m.strides.velocity) {
                out[i] = val = velocity[j] / 127;
            }

            m.unscaledValue = val;
            that.mulAdd(numSamps);
            m.value = flock.ugen.lastOutputValue(numSamps, out);
        };

        that.init = function () {
            that.onInputChanged();
        };

        that.init();
        return that;
    };

    flock.ugenDefaults("flock.ugen.midiAmp", {
        rate: "control",
        inputs: {
            velocity: 0
        },
        ugenOptions: {
            model: {
                unscaledValue: 0.0,
                value: 0.0
            },
            strideInputs: ["velocity"]
        }
    });

}());
