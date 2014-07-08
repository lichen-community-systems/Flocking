/*
 * Flocking Node Views
 *   Copyright 2014, Colin Clark
 *
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require, dagre, jsPlumb*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var $ = fluid.registerNamespace("jQuery");

    /*****************************
     * JSPlumb Component Wrapper *
     *****************************/

    fluid.defaults("flock.playground.jsPlumb", {
        gradeNames: ["fluid.viewComponent", "autoInit"],

        jsPlumbSettings: {},

        members: {
            plumb: {
                expander: {
                    funcName: "flock.playground.jsPlumb.create",
                    args: ["{that}.container"]
                }
            }
        },

        events: {
            onReady: null
        },

        listeners: {
            onCreate: [
                {
                    "this": "{that}.plumb",
                    method: "ready",
                    args: "{that}.events.onReady.fire"
                }
            ]
        }
    });

    flock.playground.jsPlumb.create = function (container) {
        jsPlumb.setContainer(container[0]);
        return jsPlumb;
    };


    /***********************************
     * Graph/Source View Taggle Button *
     ***********************************/

    fluid.defaults("flock.playground.editorModeToggle", {
        gradeNames: ["flock.ui.toggleButton", "autoInit"],

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
    });


    /*********************
     * Visual Playground *
     *********************/

    fluid.defaults("flock.playground.visual", {
        gradeNames: ["flock.playground", "autoInit"],

        components: {
            viewToggleButton: {
                type: "flock.playground.editorModeToggle",
                container: "{that}.dom.synthSelector",
                options: {
                    selfRender: true,
                    model: {
                        isEnabled: true
                    },
                    modelListeners: {
                        "isEnabled": [
                            {
                                func: "{visual}.events.onSourceUpdated.fire"
                            },
                            {
                                "this": "{editor}.editor",
                                method: "refresh"
                            }
                        ]
                    }
                }
            },

            visualView: {
                type: "flock.playground.visualView",
                container: "#visual-view"
            }
        },

        selectors: {
            visual: "#visual-view",
            synthSelector: ".synthSelector"
        },

        modelListeners: {
            isDeclarative: {
                funcName: "flock.playground.visual.updateToggleButton",
                args: ["{change}.value", "{viewToggleButton}.container"]
            }
        }
    });

    flock.playground.visual.updateToggleButton = function (isDeclarative, button) {
        button.attr("disabled", !isDeclarative);
    };


    /***************
     * Visual View *
     ***************/

    fluid.defaults("flock.playground.visualView", {
        gradeNames: ["fluid.viewComponent", "autoInit"],

        components: {
            jsPlumb: {
                type: "flock.playground.jsPlumb",
                container: "{that}.container"
            },

            synthDefRenderer: {
                createOnEvent: "onReady",
                type: "flock.ui.nodeRenderers.synth",
                container: "{that}.container",
                options: {
                    components: {
                        jsPlumb: "{jsPlumb}"
                    },

                    model: {
                        synthSpec: "{playground}.model.activeSynthSpec"
                    }
                }
            }
        },

        events: {
            onReady: "{jsPlumb}.events.onReady"
        }

    });


    /******************
     * Node Renderers *
     ******************/

    fluid.registerNamespace("flock.ui.nodeRenderers");

    fluid.defaults("flock.ui.nodeRenderers.ugen", {
        gradeNames: ["fluid.viewComponent", "autoInit"],

        model: {
            ugenDef: {}, // A ugenDef.
            edges: {}
        },

        invokers: {
            refreshView: {
                funcName: "flock.ui.nodeRenderers.ugen.refreshView",
                args: [
                    "{that}",
                    "{that}.container",
                    "{that}.options.markup.node",
                    "{that}.model.ugenDef",
                    "{that}.events.afterRender.fire"
                ],
                dynamic: true
            }
        },

        events: {
            afterRender: null
        },

        markup: {
            node: "<div id='%id' class='node %type'><div class='label'>%displayName</div></div>"
        }
    });

    flock.ui.nodeRenderers.ugen.refreshView = function (that, container, nodeMarkup, ugenDef, afterRender) {
        var strings = flock.ui.nodeRenderers.ugen.prepareStrings(ugenDef),
            renderedMarkup = fluid.stringTemplate(nodeMarkup, strings),
            node = $(renderedMarkup);

        container.append(node);
        that.node = node;

        if (afterRender) {
            afterRender(node, ugenDef);
        }
    };

    flock.ui.nodeRenderers.ugen.hasTag = function (ugenName, tagName) {
        if (!ugenName) {
            return false;
        }

        var defaults = fluid.defaults(ugenName),
            defaultUGenOpts = defaults.ugenOptions;

        return defaultUGenOpts && defaultUGenOpts.tags && defaultUGenOpts.tags.indexOf(tagName) > -1;
    };

    flock.ui.nodeRenderers.ugen.prepareStrings = function (ugenDef) {
        // Come up with a display name for each unit generator.
        // For value ugens, this will be its actual value.
        // Other ugens will be displayed with their last path segment (tail).
        // TODO: This should become an option for all unit generators.
        var isValueUGen = flock.ui.nodeRenderers.ugen.hasTag(ugenDef.ugen, "flock.ugen.valueType"),
            displayName = isValueUGen ? ugenDef.inputs.value : fluid.pathUtil.getTailPath(ugenDef.ugen);

        // TODO: We should have some other ID that represents the view, not the model.
        // TODO: and this is the wrong time to do this.
        if (!ugenDef.id) {
            ugenDef.id = fluid.allocateGuid();
        }

        return {
            id: ugenDef.id,
            type: ugenDef.ugen,
            displayName: displayName
        };
    };


    fluid.defaults("flock.ui.nodeRenderers.synth", {
        gradeNames: ["fluid.viewRelayComponent", "autoInit"],

        members: {
            ugenRenderers: []
        },

        model: {
            synthSpec: {}
        },

        invokers: {
            refreshView: {
                funcName: "flock.ui.nodeRenderers.synth.refreshView",
                args: [
                    "{viewToggleButton}.model.isEnabled",
                    "{that}",
                    "{that}.applier",
                    "{that}.container",
                    "{that}.model.synthSpec",
                    "{that}.events.afterRender.fire"
                ],
                dynamic: true
            }
        },

        events: {
            afterRender: null
        },

        listeners: {
            onCreate: {
                func: "{that}.refreshView"
            }
        },

        modelListeners: {
            "synthSpec": {
                func: "{that}.refreshView"
            }
        }
    });

    flock.ui.nodeRenderers.synth.expandInputs = function (ugenDef) {
        // Expand scalar values into value unit generators.
        var expanded = flock.parse.expandValueDef(ugenDef);
        return flock.parse.expandInputs(expanded);
    };

    flock.ui.nodeRenderers.synth.expandAllInputs = function (ugenDef, options) {
        ugenDef = flock.ui.nodeRenderers.synth.expandInputs(ugenDef);

        var inputDefs = ugenDef.inputs,
            inputName,
            inputDef;

        for (inputName in inputDefs) {
            // Create ugens for all inputs except special inputs.
            inputDef = inputDefs[inputName];
            inputDefs[inputName] = flock.input.shouldExpand(inputName, ugenDef) ?
                flock.ui.nodeRenderers.synth.expandAllInputs(inputDef, options) : inputDef;
        }

        return ugenDef;
    };

    flock.ui.nodeRenderers.synth.expandDef = function (synthDef) {
        // TODO: Copy pasted from flock.parser.ugenForDef. It needs refactoring.
        // TODO: should this be sourced elsewhere in this context?
        var options = {
            // TODO: This is hardcoded to audio rate, which is fine until we can edit value synths.
            rate: flock.rates.AUDIO,
            audioSettings: flock.enviro.shared.options.audioSettings,
            buses: flock.enviro.shared.buses,
            buffers: flock.enviro.shared.buffers
        };

        if (!flock.parse.synthDef.hasOutUGen(synthDef)) {
            synthDef = flock.parse.synthDef.makeOutUGen(synthDef, options);
        }

        return flock.ui.nodeRenderers.synth.expandAllInputs(synthDef, options);
    };

    // TODO: use dynamic components instead.
    flock.ui.nodeRenderers.synth.accumulateRenderers = function (ugen, container, renderers) {
        var inputDefs = ugen.inputs,
            edges = [],
            inputName,
            inputDef,
            renderer;

        for (inputName in inputDefs) {
            inputDef = inputDefs[inputName];

            if (flock.input.shouldExpand(inputName, inputDef)) {
                flock.ui.nodeRenderers.synth.accumulateRenderers(inputDef, container, renderers);
            }

            ugen.id = ugen.id || fluid.allocateGuid(); // TODO: This is already elsewhere.
            if (inputName !== "value") {
                inputDef.id = inputDef.id || fluid.allocateGuid();
                edges.push({
                    source: ugen.id,
                    target: inputDef.id,
                    label: inputName
                });
            }
        }

        renderer = flock.ui.nodeRenderers.ugen(container, {
            model: {
                ugenDef: ugen,
                edges: edges
            }
        });

        renderers.push(renderer);
    };

    flock.ui.nodeRenderers.synth.renderGraph = function (renderers) {
        var graphSpec = {
            nodes: {},
            edges: []
        };

        fluid.each(renderers, function (renderer) {
            renderer.refreshView();

            graphSpec.nodes[renderer.model.ugenDef.id] = {
                width: renderer.node.innerWidth(),
                height: renderer.node.innerHeight()
            };

            graphSpec.edges = graphSpec.edges.concat(renderer.model.edges);
        });

        return graphSpec;
    };

    flock.ui.nodeRenderers.synth.layoutGraph = function (container, graphSpec) {
        // TODO: Wrap Dagre as a component.
        var g = new dagre.Digraph();

        fluid.each(graphSpec.nodes, function (node, id) {
            g.addNode(id, node);
        });

        fluid.each(graphSpec.edges, function (edge) {
            g.addEdge(null, edge.source, edge.target);
        });

        var outputGraph = dagre.layout().rankDir("RL").rankSep(75).run(g);

        // Position the nodes.
        outputGraph.eachNode(function (id, graphNode) {
            var nodeEl = $("#" + id);
            nodeEl.css({
                "position": "absolute",
                // TODO: calculate position from centre, which is what Dagre gives us.
                // TODO: Offset based on the container's position on screen.
                "top": graphNode.y + 120,
                "left": graphNode.x
            });
        });
    };

    flock.ui.nodeRenderers.synth.clear = function (jsPlumb, container, ugenRenderers) {
        jsPlumb.plumb.detachEveryConnection();
        container.children().remove();

        // TODO: Remove this when these renderers become dynamic components.
        fluid.each(ugenRenderers, function (renderer) {
            renderer.destroy();
        });
        ugenRenderers.length = 0;
    };

    flock.ui.nodeRenderers.synth.render = function (jsPlumb, synthDef, container, ugenRenderers) {
        var expanded = flock.ui.nodeRenderers.synth.expandDef(synthDef);
        flock.ui.nodeRenderers.synth.accumulateRenderers(expanded, container, ugenRenderers);

        var graph = flock.ui.nodeRenderers.synth.renderGraph(ugenRenderers);
        flock.ui.nodeRenderers.synth.layoutGraph(container, graph);
        flock.ui.nodeRenderers.synth.renderEdges(jsPlumb.plumb, graph.edges);
    };

    flock.ui.nodeRenderers.synth.refreshView = function (isVisible, that, applier, container, synthSpec, afterRender) {
        if (!synthSpec || !synthSpec.synthDef || $.isEmptyObject(synthSpec.synthDef)) {
            return;
        }

        flock.ui.nodeRenderers.synth.clear(that.jsPlumb, container, that.ugenRenderers);

        if (isVisible) {
            flock.ui.nodeRenderers.synth.render(that.jsPlumb, synthSpec.synthDef, container, that.ugenRenderers);
        }

        afterRender();
    };

    flock.ui.nodeRenderers.synth.renderEdges = function (plumb, edges) {
        fluid.each(edges, function (edge) {
            plumb.connect({
                source: plumb.addEndpoint(edge.target, {
                    anchor: "Right",
                    width: 2,
                    endpoint: [
                        "Dot",
                        {
                            radius: 4
                        }
                    ]
                }),
                target: plumb.addEndpoint(edge.source, {
                    endpoint: [
                        "Dot",
                        {
                            radius: 4
                        }
                    ],
                    anchor: [
                        "Perimeter",
                        {
                            shape: "Rectangle",
                        }
                    ]
                }),
                connector: "Straight",
                overlays: [
                    [
                        "Label", {
                            label: edge.label
                        }
                    ],
                    [
                        "PlainArrow", {
                            location: 1
                        }
                    ]
                ]
            });
        });
    };

}());
