/*
 * Flocking UI MIDI Port Selector
 *   Copyright 2015, Colin Clark
 *
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require, jQuery*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    // TODO: add support for rendering errors
    // TODO: add user-friendly rendering in the case when no midi ports are available
    // TODO: move selectBox container rendering into the selectBox component
    fluid.defaults("flock.ui.midiInputSelector", {
        gradeNames: "fluid.viewComponent",

        model: {
            inputs: []
        },

        components: {
            selectBox: {
                createOnEvent: "onReady",
                type: "flock.ui.selectBox",
                container: "{that}.dom.selectBox",
                options: {
                    model: {
                        options: "{midiInputSelector}.model.inputs"
                    },

                    events: {
                        onSelect: "{midiInputSelector}.events.onPortSelected"
                    }
                }
            },

            midiSystem: {
                type: "flock.midi.system",
                options: {
                    events: {
                        onPortsAvailable: "{midiInputSelector}.events.onPortsAvailable"
                    }
                }
            }
        },

        invokers: {
            refreshView: "{that}.events.onRender.fire()"
        },

        events: {
            onPortsAvailable: null,
            onRender: null,
            afterRender: null,
            onReady: {
                events: {
                    onPortsAvailable: "{that}.events.onPortsAvailable",
                    afterRender: "{that}.events.afterRender"
                }
            },
            onRefresh: null,
            onPortSelected: null
        },

        listeners: {
            onCreate: [
                "{that}.refreshView()"
            ],

            // TODO: Move the selectBox portions of this to the selectBox component.
            onRender: [
                {
                    funcName: "flock.ui.midiInputSelector.render",
                    args: [
                        "{that}.container",
                        "{that}.options.markup.label",
                        "{that}.options.selectBoxStrings"
                    ]
                },
                {
                    funcName: "flock.ui.midiInputSelector.render",
                    args: [
                        "{that}.container",
                        "{that}.options.markup.selectBox",
                        "{that}.options.selectBoxStrings"
                    ]
                },
                {
                    funcName: "flock.ui.midiInputSelector.renderRefreshButton",
                    args: [
                        "{that}.container",
                        "{that}.options.markup.refreshButton",
                        "{that}.options.strings",
                        "{that}.events.onRefresh.fire"
                    ]
                },
                {
                    func: "{that}.events.afterRender.fire"
                }
            ],

            onRefresh: [
                "{midiSystem}.refreshPorts()"
            ],

            onPortsAvailable: [
                {
                    changePath: "inputs",
                    type: "DELETE"
                },
                {
                    changePath: "inputs",
                    value: "{arguments}.0.inputs"
                }
            ]
        },

        markup: {
            label: "<label for='%selectBoxID'>%selectBoxLabel:</label>",
            selectBox: "<select class='flock-midi-selector-selectBox' id='%selectBoxId'></select>",
            refreshButton: "<button name='refresh'>%refreshButtonLabel</button>"
        },

        // TODO: Move this to the selectBox component.
        selectBoxStrings: {
            selectBoxID: "@expand:fluid.allocateGuid()",
            selectBoxLabel: "{that}.options.strings.selectBoxLabel"
        },

        strings: {
            selectBoxLabel: "MIDI Input",
            refreshButtonLabel: "Refresh"
        },

        selectors: {
            selectBox: ".flock-midi-selector-selectBox"
        }
    });


    // TODO: Move to the selectBox component.
    flock.ui.midiInputSelector.render = function (container, markup, strings) {
        var rendered = fluid.stringTemplate(markup, strings),
            el = jQuery(rendered);

        container.append(el);

        return el;
    };

    flock.ui.midiInputSelector.renderRefreshButton = function (container, markup, strings, onRefresh) {
        var button = flock.ui.midiInputSelector.render(container, markup, strings);
        button.click(function () {
            onRefresh();
            return false;
        });
    };

}());
