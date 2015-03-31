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
        gradeNames: ["fluid.viewRelayComponent", "autoInit"],

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


    /*********************
     * Visual Playground *
     *********************/

    fluid.defaults("flock.playground.visual", {
        gradeNames: ["flock.playground", "autoInit"],

        distributeOptions: [
            {
                source: "{that}.options.demoDefaults",
                removeSource: true,
                target: "{that flock.playground.demoSelector}.options.demoDefaults"
            }
        ],

        demoDefaults: {
            fileExt: "json"
        },

        components: {
            editor: {
                options: {
                    mode: "application/json"
                }
            },

            evaluator: {
                type: "flock.sourceEvaluator.json"
            },

            visualView: {
                type: "flock.playground.visualView",
                container: "#visual-view",
                options: {
                    listeners: {
                        // TODO: This toggling works inconsistently.
                        onRender: {
                            "this": "{playButton}.container",
                            method: "hide"
                        },
                        afterRender: {
                            "this": "{playButton}.container",
                            method: "show"
                        }
                    }
                }
            },

            demos: {
                type: "flock.playground.demos.live"
            }
        },

        events: {
            onSourceUpdated: "{editor}.events.onValidChange"
        },

        selectors: {
            visual: "#visual-view",
            synthSelector: ".playSynth"
        },

        listeners: {
            onSourceUpdated: [
                "{that}.parse()"
            ]
        }
    });


    /***************
     * Visual View *
     ***************/

    fluid.defaults("flock.playground.visualView", {
        gradeNames: ["fluid.viewRelayComponent", "autoInit"],

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
                        // TODO: Rename this to be consistent with the evaluator.
                        synthSpec: "{evaluator}.model.activeSynthSpec"
                    },

                    modelListeners: {
                        "synthSpec": "{synthDefRenderer}.refreshView()"
                    },

                    events: {
                        onRender: "{visualView}.events.onRender",
                        afterRender: "{visualView}.events.afterRender"
                    }
                }
            }
        },

        events: {
            onReady: "{jsPlumb}.events.onReady",
            onRender: null,
            afterRender: null
        }
    });


    /******************
     * Node Renderers *
     ******************/

    fluid.registerNamespace("flock.ui.nodeRenderers");

    fluid.defaults("flock.ui.nodeRenderers.ugen", {
        gradeNames: ["fluid.viewRelayComponent", "autoInit"],

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

        var defaults = fluid.defaults(ugenName);
        if (!defaults) {
            return false;
        }

        var defaultUGenOpts = defaults.ugenOptions;

        return defaultUGenOpts && defaultUGenOpts.tags && defaultUGenOpts.tags.indexOf(tagName) > -1;
    };

    flock.ui.nodeRenderers.ugen.prepareStrings = function (ugenDef) {
        // Come up with a display name for each unit generator.
        // For value ugens, this will be its actual value.
        // Other ugens will be displayed with their last path segment (tail).
        // TODO: This should become an option for all unit generators.
        var isValueUGen = flock.ui.nodeRenderers.ugen.hasTag(ugenDef.ugen, "flock.ugen.valueType"),
            displayName = isValueUGen ? ugenDef.inputs.value : ugenDef.ugen ?
                fluid.pathUtil.getTailPath(ugenDef.ugen) : "";

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
                args: ["{that}"],
                dynamic: true
            },

            clear: {
                funcName: "flock.ui.nodeRenderers.synth.clear",
                args: ["{that}.jsPlumb", "{that}.container", "{that}.ugenRenderers"]
            }
        },

        events: {
            onRender: null,
            afterRender: null,
            onRenderError: null
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

        // TODO: Handle arrays correctly here.

        ugen.id = ugen.id || fluid.allocateGuid();

        for (inputName in inputDefs) {
            inputDef = inputDefs[inputName];

            if (flock.input.shouldExpand(inputName, inputDef)) {
                flock.ui.nodeRenderers.synth.accumulateRenderers(inputDef, container, renderers);
            }

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

    flock.ui.nodeRenderers.synth.renderGraph = function (that) {
        var graphSpec = {
            nodes: {},
            edges: []
        };

        fluid.each(that.ugenRenderers, function (renderer) {
            renderer.refreshView();

            if (!renderer.node) {
                return;
            }

            graphSpec.nodes[renderer.model.ugenDef.id] = {
                width: renderer.node.innerWidth(),
                height: renderer.node.innerHeight()
            };

            graphSpec.edges = graphSpec.edges.concat(renderer.model.edges);
        });

        return graphSpec;
    };

    flock.ui.nodeRenderers.synth.layoutGraph = function (graphSpec) {
        // TODO: Wrap Dagre as a component.
        var g = new dagre.Digraph();

        fluid.each(graphSpec.nodes, function (node, id) {
            g.addNode(id, node);
        });

        fluid.each(graphSpec.edges, function (edge) {
            g.addEdge(null, edge.source, edge.target);
        });

        var outputGraph = dagre.layout().rankDir("BT").rankSep(100).nodeSep(25).run(g);

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

        return outputGraph;
    };

    flock.ui.nodeRenderers.synth.clear = function (jsPlumb, container, ugenRenderers) {
        if (!jsPlumb) {
            return;
        }

        jsPlumb.plumb.detachEveryConnection();
        container.children().remove();

        // TODO: Remove this when these renderers become dynamic components.
        fluid.each(ugenRenderers, function (renderer) {
            renderer.destroy();
        });
        ugenRenderers.length = 0;
    };

    flock.ui.nodeRenderers.synth.render = function (synthDef, that) {
        if (!that.jsPlumb) {
            return;
        }

        var expanded = flock.ui.nodeRenderers.synth.expandDef(synthDef);
        flock.ui.nodeRenderers.synth.accumulateRenderers(expanded, that.container, that.ugenRenderers);

        var graph = flock.ui.nodeRenderers.synth.renderGraph(that);
        flock.ui.nodeRenderers.synth.layoutGraph(graph);
        flock.ui.nodeRenderers.synth.renderEdges(that.jsPlumb.plumb, graph.edges);
    };

    flock.ui.nodeRenderers.synth.refreshView = function (that) {
        var synthSpec = that.model.synthSpec;
        if (!synthSpec || !synthSpec.synthDef || $.isEmptyObject(synthSpec.synthDef)) {
            return;
        }

        that.events.onRender.fire();

        flock.ui.nodeRenderers.synth.clear(that.jsPlumb,that. container, that.ugenRenderers);
        flock.ui.nodeRenderers.synth.render(synthSpec.synthDef, that);

        that.events.afterRender.fire();
    };

    flock.ui.nodeRenderers.synth.renderEdges = function (plumb, edges) {
        fluid.each(edges, function (edge, idx) {
            // TODO: Get rid of this conditional.
            if (!document.getElementById(edge.target) || !document.getElementById(edge.source)) {
                return;
            }

            plumb.connect({
                source: plumb.addEndpoint(edge.target, {
                    anchor: "Bottom",
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
                            label: edge.label,
                            location: idx % 2 ? 0.5 : 0.3
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
