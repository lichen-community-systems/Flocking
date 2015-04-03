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
                type: "flock.ui.nodeRenderer.synth",
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

    fluid.defaults("flock.ui.nodeRenderer", {
        gradeNames: ["fluid.viewRelayComponent", "autoInit"],

        nodeType: "",

        model: {
            node: {
                id: "@expand:fluid.allocateGuid()",
                def: {},
                nodeType: "{that}.options.nodeType",
                displayName: "{that}.options.nodeType"
            },
            edges: []
        },

        invokers: {
            prepareRenderModel: "fluid.identity({that}.model.node)",
            render: "flock.ui.nodeRenderer.render({that})",
            refreshView: "{that}.events.onRender.fire"
        },

        events: {
            onRender: null,
            afterRender: null
        },

        listeners: {
            onRender: [
                "{that}.prepareRenderModel()",
                "{that}.render()"
            ]
        },

        markup: {
            node: "<div id='%id' class='node %nodeType'><div class='label'>%displayName</div></div>"
        }
    });

    flock.ui.nodeRenderer.render = function (that) {
        var renderedMarkup = fluid.stringTemplate(that.options.markup.node, that.model.node),
            el = $(renderedMarkup);

        that.container.append(el);
        that.element = el;
        that.events.afterRender.fire(el, that.model.node);
    };

    flock.ui.nodeRenderer.rendererCreatorForInput = function (inputName, inputDef) {
        if (typeof inputDef === "number" || inputDef.ugen) {
            return flock.ui.nodeRenderer.ugen;
        }

        var creator = flock.ui.nodeRenderer[inputName];
        if (!creator) {
            flock.fail("No renderer was found for an input of type " + inputName);
        }

        return creator;
    };

    flock.ui.nodeRenderer.create = function (inputName, def, container) {
        var creator = flock.ui.nodeRenderer.rendererCreatorForInput(inputName, def);

        return creator(container, {
            model: {
                node: {
                    def: def
                }
            }
        });
    };


    fluid.defaults("flock.ui.nodeRenderer.ugen", {
        gradeNames: ["flock.ui.nodeRenderer", "autoInit"],

        invokers: {
            prepareRenderModel: {
                funcName: "flock.ui.nodeRenderer.ugen.prepareRenderModel",
                args: "{that}"
            }
        }
    });

    flock.ui.nodeRenderer.ugen.hasTag = function (ugenName, tagName) {
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

    flock.ui.nodeRenderer.ugen.prepareRenderModel = function (that) {
        var ugenDef = that.model.node.def;

        // Come up with a display name for each unit generator.
        // For value ugens, this will be its actual value.
        // Other ugens will be displayed with their last path segment (tail).
        // TODO: This should become an option for all unit generators.
        var type = ugenDef.ugen,
            isValueUGen = flock.ui.nodeRenderer.ugen.hasTag(type, "flock.ugen.valueType"),
            displayName = isValueUGen ? ugenDef.inputs.value : type ?
                fluid.pathUtil.getTailPath(type) : "";

        that.applier.change("node.displayName", displayName);
        that.applier.change("node.nodeType", type);
    };


    fluid.defaults("flock.ui.nodeRenderer.buffer", {
        gradeNames: ["flock.ui.nodeRenderer", "autoInit"],

        nodeType: "flock.buffer",

        invokers: {
            prepareRenderModel: "flock.ui.nodeRenderer.buffer.prepareRenderModel({that})"
        }
    });

    flock.ui.nodeRenderer.buffer.prepareRenderModel = function (that) {
        var buffer = that.model.node.def,
            bufId = typeof buffer !== "string" && !buffer.id ? "<buffer>" :
                "#" + (buffer.id || buffer);

        that.applier.change("node.displayName", bufId);
    };


    fluid.defaults("flock.ui.nodeRenderer.list", {
        gradeNames: ["flock.ui.nodeRenderer", "autoInit"],

        nodeType: "flock.list",

        invokers: {
            prepareRenderModel: "flock.ui.nodeRenderer.list.prepareRenderModel({that})"
        }
    });

    flock.ui.nodeRenderer.list.prepareRenderModel = function (that) {
        var displayName = JSON.stringify(that.model.node.def);
        that.applier.change("node.displayName", displayName);
    };


    fluid.defaults("flock.ui.nodeRenderer.table", {
        gradeNames: ["flock.ui.nodeRenderer", "autoInit"],
        nodeType: "table"
    });

    fluid.defaults("flock.ui.nodeRenderer.envelope", {
        gradeNames: ["flock.ui.nodeRenderer", "autoInit"],
        nodeType: "envelope"
    });


    fluid.defaults("flock.ui.nodeRenderer.synth", {
        gradeNames: ["fluid.viewRelayComponent", "autoInit"],

        members: {
            ugenRenderers: []
        },

        model: {
            synthSpec: {}
        },

        invokers: {
            refreshView: {
                funcName: "flock.ui.nodeRenderer.synth.refreshView",
                args: ["{that}"],
                dynamic: true
            },

            clear: {
                funcName: "flock.ui.nodeRenderer.synth.clear",
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

    flock.ui.nodeRenderer.synth.expandInputs = function (ugenDef) {
        // Expand scalar values into value unit generators.
        var expanded = flock.parse.expandValueDef(ugenDef);
        return flock.parse.expandInputs(expanded);
    };

    flock.ui.nodeRenderer.synth.expandAllInputs = function (ugenDef, options) {
        ugenDef = flock.ui.nodeRenderer.synth.expandInputs(ugenDef);

        var inputDefs = ugenDef.inputs,
            inputName,
            inputDef;

        for (inputName in inputDefs) {
            // Create ugens for all inputs except special inputs.
            inputDef = inputDefs[inputName];
            inputDefs[inputName] = flock.input.shouldExpand(inputName, ugenDef) ?
                flock.ui.nodeRenderer.synth.expandAllInputs(inputDef, options) : inputDef;
        }

        return ugenDef;
    };

    flock.ui.nodeRenderer.synth.expandDef = function (synthDef) {
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

        return flock.ui.nodeRenderer.synth.expandAllInputs(synthDef, options);
    };

    flock.ui.nodeRenderer.synth.accumulateRenderer = function (name, def, that) {
        var renderer = flock.ui.nodeRenderer.create(name, def, that.container);
        that.ugenRenderers.push(renderer);

        return renderer;
    };

    flock.ui.nodeRenderer.synth.nodeForInput = function (inputName, inputDef, that) {
        var renderer;

        if (flock.input.shouldExpand(inputName, inputDef)) {
            // TODO: Handle arrays of unit generators properly.
            if (flock.isIterable(inputDef)) {
                return;
            }

            renderer = flock.ui.nodeRenderer.synth.accumulateRenderers(inputName, inputDef, that);
        } else {
            renderer = flock.ui.nodeRenderer.synth.accumulateRenderer(inputName, inputDef, that);
        }

        return renderer.model.node;
    };

    flock.ui.nodeRenderer.synth.addInputEdges = function (inputName, inputNodeDef, parentRenderer) {
        if (!inputNodeDef) {
            return;
        }

        var nodeDef = parentRenderer.model.node,
            edges = parentRenderer.model.edges;

        edges.push({
            source: nodeDef.id,
            target: inputNodeDef.id,
            label: inputName
        });

        parentRenderer.applier.change("edges", edges);
    };

    flock.ui.nodeRenderer.synth.accumulateRenderers = function (ugenInputName, ugen, that) {
        var inputDefs = ugen.inputs,
            parentRenderer = flock.ui.nodeRenderer.synth.accumulateRenderer(ugenInputName, ugen, that);

        fluid.each(inputDefs, function (inputDef, inputName) {
            // TODO: Refactor value unit generators so they don't have inputs.
            if (inputName !== "value") {
                var inputNodeDef = flock.ui.nodeRenderer.synth.nodeForInput(inputName, inputDef, that);
                flock.ui.nodeRenderer.synth.addInputEdges(inputName, inputNodeDef, parentRenderer);
            }
        });

        return parentRenderer;
    };

    flock.ui.nodeRenderer.synth.renderGraph = function (that) {
        var graphSpec = {
            nodes: {},
            edges: []
        };

        // TODO: This whole workflow should be event-driven rather
        // than depending on imperative iteration.
        fluid.each(that.ugenRenderers, function (renderer) {
            renderer.refreshView();

            if (!renderer.element) {
                return;
            }

            graphSpec.nodes[renderer.model.node.id] = {
                width: renderer.element.innerWidth(),
                height: renderer.element.innerHeight()
            };

            graphSpec.edges = graphSpec.edges.concat(renderer.model.edges);
        });

        return graphSpec;
    };

    flock.ui.nodeRenderer.synth.layoutGraph = function (graphSpec) {
        // TODO: Wrap Dagre as a component.
        var g = new dagre.Digraph();

        // TODO: This whole workflow should be event-driven rather
        // than depending on imperative iteration.
        fluid.each(graphSpec.nodes, function (node, id) {
            g.addNode(id, node);
        });

        // TODO: This whole workflow should be event-driven rather
        // than depending on imperative iteration.
        fluid.each(graphSpec.edges, function (edge) {
            g.addEdge(null, edge.source, edge.target);
        });

        var outputGraph = dagre.layout().rankDir("BT").rankSep(100).nodeSep(25).run(g);

        // Position the nodes.
        // TODO: This whole workflow should be event-driven rather
        // than depending on imperative iteration.
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

    flock.ui.nodeRenderer.synth.clear = function (jsPlumb, container, ugenRenderers) {
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

    flock.ui.nodeRenderer.synth.render = function (synthDef, that) {
        if (!that.jsPlumb) {
            return;
        }

        var expanded = flock.ui.nodeRenderer.synth.expandDef(synthDef);
        flock.ui.nodeRenderer.synth.accumulateRenderers(undefined, expanded, that);

        var graph = flock.ui.nodeRenderer.synth.renderGraph(that);
        flock.ui.nodeRenderer.synth.layoutGraph(graph);
        flock.ui.nodeRenderer.synth.renderEdges(that.jsPlumb.plumb, graph.edges);
    };

    flock.ui.nodeRenderer.synth.refreshView = function (that) {
        var synthSpec = that.model.synthSpec;
        if (!synthSpec || !synthSpec.synthDef || $.isEmptyObject(synthSpec.synthDef)) {
            return;
        }

        that.events.onRender.fire();

        flock.ui.nodeRenderer.synth.clear(that.jsPlumb,that. container, that.ugenRenderers);
        flock.ui.nodeRenderer.synth.render(synthSpec.synthDef, that);

        that.events.afterRender.fire();
    };

    flock.ui.nodeRenderer.synth.renderEdges = function (plumb, edges) {
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
