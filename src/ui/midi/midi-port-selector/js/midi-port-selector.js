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
    fluid.defaults("flock.ui.midiPortSelector", {
        gradeNames: "fluid.viewComponent",

        portType: "input",

        model: {
            ports: []
        },

        components: {
            selectBox: {
                createOnEvent: "onReady",
                type: "flock.ui.selectBox",
                container: "{that}.dom.selectBox",
                options: {
                    model: {
                        options: "{midiPortSelector}.model.ports"
                    },

                    events: {
                        onSelect: "{midiPortSelector}.events.onPortSelected"
                    }
                }
            },

            midiSystem: {
                type: "flock.midi.system",
                options: {
                    events: {
                        onPortsAvailable: "{midiPortSelector}.events.onPortsAvailable"
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
                    funcName: "flock.ui.midiPortSelector.render",
                    args: [
                        "{that}.container",
                        "{that}.options.markup.label",
                        "{that}.options.selectBoxStrings"
                    ]
                },
                {
                    funcName: "flock.ui.midiPortSelector.render",
                    args: [
                        "{that}.container",
                        "{that}.options.markup.selectBox",
                        "{that}.options.selectBoxStrings"
                    ]
                },
                {
                    funcName: "flock.ui.midiPortSelector.renderRefreshButton",
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
                    changePath: "ports",
                    type: "DELETE"
                },
                {
                    funcName: "flock.ui.midiPortSelector.updatePortsModel",
                    args: ["{that}.options.portType", "{arguments}.0", "{that}"]
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
            selectBoxLabel: "MIDI Port",
            refreshButtonLabel: "Refresh"
        },

        selectors: {
            selectBox: ".flock-midi-selector-selectBox"
        }
    });

    flock.ui.midiPortSelector.updatePortsModel = function (portType, ports, that) {
        if (portType === "input") {
            portType = "inputs";
        } else if (portType === "output") {
            portType = "outputs";
        }

        var portsForType = ports[portType];
        that.applier.change("ports", portsForType);
    };

    // TODO: Move to the selectBox component.
    flock.ui.midiPortSelector.render = function (container, markup, strings) {
        var rendered = fluid.stringTemplate(markup, strings),
            el = jQuery(rendered);

        container.append(el);

        return el;
    };

    flock.ui.midiPortSelector.renderRefreshButton = function (container, markup, strings, onRefresh) {
        var button = flock.ui.midiPortSelector.render(container, markup, strings);
        button.click(function () {
            onRefresh();
            return false;
        });
    };

}());
