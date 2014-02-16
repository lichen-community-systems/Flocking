/*
 * Flocking Playground
 *   Copyright 2014, Colin Clark
 *
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require, window*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";
    
    var $ = fluid.registerNamespace("jQuery");
    
    // TODO: Declarativize.
    flock.init();
    
    /**************
     * Playground *
     **************/
    
    fluid.defaults("flock.playground", {
        gradeNames: ["fluid.viewRelayComponent", "autoInit"],
        
        flockingSettings: {},
        
        model: {
            activeSynth: {}
        },
        
        components: {
            demos: {
                type: "flock.playground.demos"
            },
            
            editor: {
                type: "flock.ui.codeEditor.cm",
                container: "{that}.dom.editor",
                options: {
                    listeners: {
                        afterContentReplaced: {
                            func: "{playground}.evaluateSource"
                        }
                    }
                }
            },
            
            demoSelector: {
                type: "flock.playground.demoSelector",
                container: "{that}.dom.demoSelector",
                options: {
                    listeners: {
                        afterDemoLoaded: [
                            {
                                func: "{editor}.setContent",
                                args: ["{arguments}.0"]
                            }
                        ]
                    }
                }
            },
            
            playButton: {
                type: "flock.ui.enviroPlayButton",
                container: "{that}.dom.playButton"
            },
            
            viewToggleButton: {
                type: "flock.ui.toggleButton",
                container: "{that}.dom.viewToggler",
                options: {
                    model: {
                        isEnabled: true
                    },
                    
                    listeners: {
                        onEnabled: [
                            {
                                "this": "{playground}.dom.editor",
                                method: "hide"
                            },
                            {
                                "this": "{playground}.dom.visual",
                                method: "show"
                            },
                            {
                                func: "{visualView}.synthDefRenderer.refreshView"
                            }
                        ],
                        
                        onDisabled: [
                            {
                                "this": "{playground}.dom.visual",
                                method: "hide"
                            },
                            {
                                "this": "{playground}.dom.editor",
                                method: "show"
                            }
                        ]
                    },
                    
                    strings: {
                        enabled: "Source",
                        disabled: "Graph"
                    }
                }
            },
            
            visualView: {
                type: "flock.playground.visualView",
                container: "#visual-view",
                options: {
                    model: "{playground}.model.activeSynthSpec"
                }
            }
        },
        
        invokers: {
            evaluateSource: {
                funcName: "flock.playground.evaluateSource",
                args: ["{that}.applier", {
                    expander: {
                        funcName: "{editor}.getContent"
                    }
                }],
                dynamic: true
            }
        },
        
        events: {
            onEvaluateDemo: "{playButton}.events.onPlay"
        },
        
        listeners: {
            onCreate: [
                {
                    funcName: "{demoSelector}.loadDemoFromURL"
                }
            ],
            
            onEvaluateDemo: {
                funcName: "flock.playground.synthForActiveSynthSpec",
                args: "{that}.model.activeSynthSpec"
            }
        },
        
        modelListeners: {
            "activeSynthSpec": {
                func: "{visualView}.synthDefRenderer.refreshView",
                args: "{change}.value"
            }
        },

        selectors: {
            editor: "#source-view",
            visual: "#visual-view",
            playButton: "#playButton",
            demoSelector: "#demos",
            viewToggler: "#viewButton"
        }
    });
    
    flock.playground.evaluateSource = function (applier, source) {
        var synthSpec = JSON.parse(source);
        applier.change("", {
            activeSynthSpec: synthSpec
        });
    };
    
    // TODO: This synth needs to be a dynamic component!
    flock.playground.synthForActiveSynthSpec = function (activeSynthSpec) {
        return flock.synth(activeSynthSpec);
    };
    
    /*****************
     * Demo Selector *
     *****************/
    
    fluid.defaults("flock.playground.demoSelector", {
        gradeNames: ["fluid.viewComponent", "autoInit"],
        
        components: {
            selectBox: {
                type: "flock.ui.selectBox",
                container: "{that}.container",
                options: {
                    model: "{demos}.model"
                }
            }
        },
        
        demoDefaults: {
            pathPrefix: "../demos/",
            id: "sine",
            fileExt: "json"
        },
        
        invokers: {
            loadDemo: {
                funcName: "flock.playground.demoSelector.load",
                args: ["{arguments}.0", "{that}.options.demoDefaults", "{that}.events.afterDemoLoaded.fire"]
            },
            
            loadDemoFromURL: {
                funcName: "flock.playground.demoSelector.loadDemoFromURLHash",
                args: ["{that}.container", "{selectBox}", "{that}.loadDemo"]
            },
            
            updateURL: {
                funcName: "flock.playground.demoSelector.updateURLHash",
                args: ["{arguments}.0.id"]
            }
        },
        
        events: {
            onSelect: "{selectBox}.events.onSelect",    // Fires when the user selects a demo.
            afterDemoLoaded: null                       // Fires after a demo file has been loaded.
        },
        
        listeners: {
            onSelect: [
                {
                    funcName: "{that}.updateURL",
                    args: ["{arguments}.0"]
                },
                {
                    funcName: "{that}.loadDemo",
                    args: ["{arguments}.0"]
                }
            ]
        }
    });
    
    flock.playground.demoSelector.updateURLHash = function (id) {
        if (id) {
            window.location.hash = "#" + id;
        }
    };
    
    flock.playground.demoSelector.loadDemoFromURLHash = function (container, selectBox) {
        var hash = window.location.hash,
            id = hash ? hash.slice(1) : selectBox.model.defaultOption;
        
        selectBox.select(id);
    };
    
    flock.playground.demoSelector.load = function (demo, demoDefaults, afterDemoLoaded) {
        demo = demo || {
            id: demoDefaults.id
        };
        
        var url = demo.url || (demoDefaults.pathPrefix + demo.id + "." + demoDefaults.fileExt);
        
        $.ajax({
            type: "get",
            url: url,
            dataType: "text",
            success: afterDemoLoaded,
            error: function (xhr, textStatus, errorThrown) {
                throw new Error(textStatus + " while loading " + url + ": " + errorThrown);
            }
        });
    };
    
    
    fluid.defaults("flock.playground.jsPlumb", {
        gradeNames: ["fluid.viewComponent", "autoInit"],
        
        jsPlumbSettings: {},
        
        members: {
            /*plumb: {
                expander: {
                    funcName: "flock.playground.jsPlumb.create",
                    args: ["{that}.container", "{that}.options.jsPlumbSettings"]
                }
            }*/
        },
        
        events: {
            onReady: null
        },
        
        listeners: {
            onCreate: [
                {
                    "this": "jsPlumb",
                    method: "ready",
                    args: "{that}.events.onReady.fire"
                }
            ]
        }
    });
    
    /*flock.playground.jsPlumb.create = function (container, jsPlumbSettings) {
        jsPlumbSettings.Container = jsPlumbSettings.Container || container;
        return jsPlumb.getInstance(jsPlumbSettings);
    };*/
    
    
    /***************
     * Visual View *
     ***************/
    
    fluid.defaults("flock.playground.visualView", {
        gradeNames: ["fluid.viewRelayComponent", "autoInit"],
        
        model: {}, // The active synthSpec
        
        components: {
            jsPlumb: {
                type: "flock.playground.jsPlumb",
                container: "{that}.container"
            },
            
            synthDefRenderer: {
                type: "flock.ui.nodeRenderers.synth",
                container: "{that}.container",
                options: {
                    // TODO: Move this IoC reference upwards.
                    model: "{that}.model"
                }
            }
        },
        
        events: {
            onReady: "{jsPlumb}.events.onReady"
        }
    });
    
    /*flock.playground.visualView.test = function () {        
        var out = jsPlumb.addEndpoint("output"),
            sin = jsPlumb.addEndpoint("fake-sin");

        jsPlumb.connect({
            source: sin, 
            target: out
        });
    };*/
}());
