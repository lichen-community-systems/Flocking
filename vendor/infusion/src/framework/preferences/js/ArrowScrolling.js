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

    /************************************************************************************
     * Scrolling Panel Prefs Editor:                                                    *
     * This is a mixin grade to be applied to a fluid.prefs.prefsEditor type component. *
     * Typically used for responsive small screen presentations of the separated panel  *
     * to allow for scrolling by clicking on left/right arrows                          *
     ************************************************************************************/

    fluid.defaults("fluid.prefs.arrowScrolling", {
        gradeNames: ["fluid.modelComponent"],
        selectors: {
            // panels: "", // should be supplied by the fluid.prefs.prefsEditor grade.
            scrollContainer: ".flc-prefsEditor-scrollContainer"
        },
        onScrollDelay: 100, // in ms, used to set the delay for debouncing the scroll event relay
        model: {
            // panelMaxIndex: null, // determined by the number of panels calculated after the onPrefsEditorMarkupReady event fired

            // Due to FLUID-6249 ( https://issues.fluidproject.org/browse/FLUID-6249 ) the default value for panelIndex
            // needs to be commented out or it will interfere with reading in the panelIndex value saved in the store.
            // panelIndex: 0 // the index of the panel to open on
        },
        events: {
            beforeReset: null, // should be fired by the fluid.prefs.prefsEditor grade
            onScroll: null
        },
        modelRelay: {
            target: "panelIndex",
            forward: {excludeSource: "init"},
            namespace: "limitPanelIndex",
            singleTransform: {
                type: "fluid.transforms.limitRange",
                input: "{that}.model.panelIndex",
                min: 0,
                max: "{that}.model.panelMaxIndex"
            }
        },
        modelListeners: {
            "panelIndex": {
                listener: "fluid.prefs.arrowScrolling.scrollToPanel",
                args: ["{that}", "{change}.value"],
                excludeSource: ["scrollEvent"],
                namespace: "scrollToPanel"
            }
        },
        listeners: {
            "onReady.scrollEvent": {
                "this": "{that}.dom.scrollContainer",
                method: "on",
                args: [
                    "scroll",
                    {
                        expander: {
                            // Relaying the scroll event to onScroll but debounced to reduce the rate of fire.  A high rate
                            // of fire may negatively effect performance for complex handlers.
                            func: "fluid.debounce",
                            args: ["{that}.events.onScroll.fire", "{that}.options.onScrollDelay"]
                        }
                    }
                ]
            },
            "onReady.windowResize": {
                "this": window,
                method: "addEventListener",
                args: ["resize", "{that}.events.onSignificantDOMChange.fire"]
            },
            "onDestroy.removeWindowResize": {
                "this": window,
                method: "removeEventListener",
                args: ["resize", "{that}.events.onSignificantDOMChange.fire"]
            },
            // Need to set panelMaxIndex after onPrefsEditorMarkupReady to ensure that the template has been
            // rendered before we try to get the number of panels.
            "onPrefsEditorMarkupReady.setPanelMaxIndex": {
                changePath: "panelMaxIndex",
                value: {
                    expander: {
                        funcName: "fluid.prefs.arrowScrolling.calculatePanelMaxIndex",
                        args: ["{that}.dom.panels"]
                    }
                }
            },
            "beforeReset.resetPanelIndex": {
                listener: "{that}.applier.fireChangeRequest",
                args: {path: "panelIndex", value: 0, type: "ADD", source: "reset"}
            },
            "onScroll.setPanelIndex": {
                changePath: "panelIndex",
                value: {
                    expander: {
                        funcName: "fluid.prefs.arrowScrolling.getClosestPanelIndex",
                        args: "{that}.dom.panels"
                    }
                },
                source: "scrollEvent"
            }
        },
        invokers: {
            eventToScrollIndex: {
                funcName: "fluid.prefs.arrowScrolling.eventToScrollIndex",
                args: ["{that}", "{arguments}.0"]
            }
        },
        distributeOptions: {
            "arrowScrolling.panel.listeners.bindScrollArrows": {
                record: {
                    "afterRender.bindScrollArrows": {
                        "this": "{that}.dom.header",
                        method: "on",
                        args: ["click", "{prefsEditor}.eventToScrollIndex"]
                    }
                },
                target: "{that > fluid.prefs.panel}.options.listeners"
            }
        }
    });

    fluid.prefs.arrowScrolling.calculatePanelMaxIndex = function (panels) {
        return Math.max(0, panels.length - 1);
    };

    fluid.prefs.arrowScrolling.eventToScrollIndex = function (that, event) {
        event.preventDefault();
        var target = $(event.target);
        var midPoint = target.width() / 2;
        var currentIndex = that.model.panelIndex || 0;
        var scrollToIndex = currentIndex + (event.offsetX < midPoint ? -1 : 1);
        that.applier.change("panelIndex", scrollToIndex, "ADD", "eventToScrollIndex");
    };

    fluid.prefs.arrowScrolling.scrollToPanel = function (that, panelIndex) {
        panelIndex = panelIndex || 0;
        var panels = that.locate("panels");
        var scrollContainer = that.locate("scrollContainer");
        var panel = panels.eq(panelIndex);

        // only attempt to scroll the container if the panel exists and has been rendered.
        if (panel.width()) {
            scrollContainer.scrollLeft(scrollContainer.scrollLeft() + panels.eq(panelIndex).offset().left);
        }
    };

    fluid.prefs.arrowScrolling.getClosestPanelIndex = function (panels) {
        var panelArray = fluid.transform(panels, function (panel, idx) {
            return {
                index: idx,
                offset: Math.abs($(panel).offset().left)
            };
        });
        panelArray.sort(function (a, b) {
            return a.offset - b.offset;
        });
        return fluid.get(panelArray, ["0", "index"]) || 0;
    };

})(jQuery, fluid_3_0_0);
