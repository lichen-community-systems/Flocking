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
        gradeNames: ["fluid.viewComponent"],

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


    /**
     * Toggles the state of the play button based on
     * evaluation and rendering process.
     *
     * This helps ensure that dropouts don't occur while JSPlumb
     * is tediously doing its job rendering.
     */
    fluid.defaults("flock.playground.playToggler", {
        gradeNames: ["fluid.component"],

        listeners: {
            "{visualView}.events.afterRender": {
                func: "{playButton}.enable",
                priority: "last"
            },

            "{demoSelector}.events.onSelect": {
                func: "{playButton}.disable",
                priority: "first"
            }
        }
    });


    /*********************
     * Visual Playground *
     *********************/

    fluid.defaults("flock.playground.visual", {
        gradeNames: ["flock.playground"],

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
                container: "{that}.dom.visualPanel"
            },

            playButtonManager: {
                type: "flock.playground.playToggler"
            }
        },

        events: {
            onSourceUpdated: "{editor}.events.onValidChange"
        },

        selectors: {
            visualPanel: "#visual-view",
            synthSelector: ".playSynth"
        },

        listeners: {
            onSourceUpdated: [
                "{that}.parse()"
            ],

            onEvaluateDemo: [
                "{evaluator}.evaluate()"
            ]
        }
    });


    /***************
     * Visual View *
     ***************/

    fluid.defaults("flock.playground.visualView", {
        gradeNames: ["fluid.viewComponent"],

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
                        activeSynthSpec: "{evaluator}.model.activeSynthSpec"
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
        gradeNames: ["fluid.viewComponent"],

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
        var creator = flock.ui.nodeRenderer.rendererCreatorForInput(inputName, def) ||
             flock.ui.nodeRenderer;

        return creator(container, {
            model: {
                node: {
                    def: def
                }
            }
        });
    };


    fluid.defaults("flock.ui.nodeRenderer.ugen", {
        gradeNames: ["flock.ui.nodeRenderer"],

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

        var defaults = flock.ugenDefaults(ugenName);
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
                fluid.model.getTailPath(type) : "";

        that.applier.change("node.displayName", displayName);
        that.applier.change("node.nodeType", type);
    };


    fluid.defaults("flock.ui.nodeRenderer.buffer", {
        gradeNames: ["flock.ui.nodeRenderer"],

        nodeType: "flock.buffer",

        model: {
            node: {
                displayName: "&lt;buffer&gt;"
            }
        },

        invokers: {
            prepareRenderModel: "flock.ui.nodeRenderer.buffer.prepareRenderModel({that})"
        }
    });

    flock.ui.nodeRenderer.buffer.prepareRenderModel = function (that) {
        var buffer = that.model.node.def,
            bufId;

        if (typeof buffer === "string") {
            bufId = buffer;
        } else if (buffer.id) {
            bufId = buffer.id;
        }

        if (bufId) {
            that.applier.change("node.displayName", "#" + bufId);
        }
    };


    fluid.defaults("flock.ui.nodeRenderer.list", {
        gradeNames: ["flock.ui.nodeRenderer"],

        nodeType: "flock.list",

        invokers: {
            prepareRenderModel: "flock.ui.nodeRenderer.list.prepareRenderModel({that})"
        }
    });

    flock.ui.nodeRenderer.list.prepareRenderModel = function (that) {
        var displayName = JSON.stringify(that.model.node.def);
        that.applier.change("node.displayName", displayName);
    };

    fluid.defaults("flock.ui.nodeRenderer.values", {
        gradeNames: ["flock.ui.nodeRenderer.list"]
    });

    fluid.defaults("flock.ui.nodeRenderer.durations", {
        gradeNames: ["flock.ui.nodeRenderer.list"]
    });

    fluid.defaults("flock.ui.nodeRenderer.table", {
        gradeNames: ["flock.ui.nodeRenderer"],
        nodeType: "flock.table",
        model: {
            node: {
                displayName: "&lt;table&gt;"
            }
        }
    });

    fluid.defaults("flock.ui.nodeRenderer.envelope", {
        gradeNames: ["flock.ui.nodeRenderer"],
        nodeType: "flock.envelope",
        model: {
            node: {
                displayName: "&lt;envelope&gt;"
            }
        }
    });


    fluid.defaults("flock.ui.nodeRenderer.synth", {
        gradeNames: ["fluid.viewComponent"],

        members: {
            ugenRenderers: []
        },

        model: {
            activeSynthSpec: {}
        },

        components: {
            enviro: "{flock.enviro}"
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
            "activeSynthSpec": {
                func: "{that}.refreshView"
            }
        }
    });

    flock.ui.nodeRenderer.synth.expandInputs = function (ugenDef) {
        // Expand scalar values into value unit generators.
        var expanded = flock.parse.expandValueDef(ugenDef);
        return flock.parse.expandInputs(expanded);
    };

    flock.ui.nodeRenderer.synth.expandMultiInput = function (ugenDefs, options) {
        return fluid.transform(ugenDefs, function (ugenDef) {
            return flock.ui.nodeRenderer.synth.expandAllInputs(ugenDef, options);
        });
    };

    flock.ui.nodeRenderer.synth.expandAllInputs = function (ugenDef, options) {
        if (flock.isIterable(ugenDef)) {
            return flock.ui.nodeRenderer.synth.expandMultiInput(ugenDef, options);
        }

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

    flock.ui.nodeRenderer.synth.expandDef = function (synthDef, enviro) {
        // TODO: Copy pasted from flock.parser.ugenForDef. It needs refactoring.
        // TODO: should this be sourced elsewhere in this context?
        var options = {
            // TODO: This is hardcoded to audio rate, which is fine until we can edit value synths.
            rate: flock.rates.AUDIO,
            audioSettings: enviro.audioSystem.model,
            buses: enviro.buses,
            buffers: enviro.buffers
        };

        if (!flock.parse.synthDef.hasOutUGen(synthDef)) {
            synthDef = flock.parse.synthDef.makeOutUGenDef(synthDef, options);
        }

        return flock.ui.nodeRenderer.synth.expandAllInputs(synthDef, options);
    };

    flock.ui.nodeRenderer.synth.accumulateRenderer = function (name, def, that) {
        var renderer = flock.ui.nodeRenderer.create(name, def, that.container);
        that.ugenRenderers.push(renderer);

        return renderer;
    };

    flock.ui.nodeRenderer.synth.addEdges = function (inputName, inputRenderers, parentRenderer) {
        if (!inputRenderers) {
            return;
        }
        inputRenderers = fluid.makeArray(inputRenderers);

        var inputEdges = fluid.transform(inputRenderers, function (inputRenderer) {
            return {
                source: parentRenderer.model.node.id,
                target: inputRenderer.model.node.id,
                label: inputName
            };
        });

        var allEdges = parentRenderer.model.edges.concat(inputEdges);
        parentRenderer.applier.change("edges", allEdges);
    };


    flock.ui.nodeRenderer.synth.accumulateMultiInputRenderers = function (inputName, inputDefs, that) {
        return fluid.transform(inputDefs, function (inputDef) {
            return flock.ui.nodeRenderer.synth.accumulateRenderers(inputName, inputDef, that);
        });
    };

    flock.ui.nodeRenderer.synth.accumulateRenderers = function (ugenInputName, ugen, that) {
        var inputDefs = ugen.inputs,
            parentRenderer = flock.ui.nodeRenderer.synth.accumulateRenderer(ugenInputName, ugen, that);

        fluid.each(inputDefs, function (inputDef, inputName) {
            // TODO: Refactor value unit generators so they don't have inputs.
            if (inputName === "value") {
                return;
            }

            var shouldExpand = flock.input.shouldExpand(inputName, inputDef),
                fn = !shouldExpand ? flock.ui.nodeRenderer.synth.accumulateRenderer :
                    flock.isIterable(inputDef) ? flock.ui.nodeRenderer.synth.accumulateMultiInputRenderers :
                    flock.ui.nodeRenderer.synth.accumulateRenderers;

            var inputRenderers = fn(inputName, inputDef, that);
            flock.ui.nodeRenderer.synth.addEdges(inputName, inputRenderers, parentRenderer);
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
        var g = new dagre.graphlib.Graph();
        g.setGraph({
            rankdir: "BT",
            ranksep: 100,
            nodesep: 25
        });
        g.setDefaultEdgeLabel(function() { return {}; });

        // TODO: This whole workflow should be event-driven rather
        // than depending on imperative iteration.
        fluid.each(graphSpec.nodes, function (node, id) {
            g.setNode(id, node);
        });

        // TODO: This whole workflow should be event-driven rather
        // than depending on imperative iteration.
        fluid.each(graphSpec.edges, function (edge) {
            g.setEdge(edge.source, edge.target);
        });

        dagre.layout(g);

        // Position the nodes.
        // TODO: This whole workflow should be event-driven rather
        // than depending on imperative iteration.
        g.nodes().forEach(function (id) {
            var node = g.node(id),
                nodeEl = $("#" + id);

            nodeEl.css({
                "position": "absolute",
                // TODO: calculate position from centre, which is what Dagre gives us.
                // TODO: Offset based on the container's position on screen.
                "top": node.y + 120,
                "left": node.x
            });
        });

        return g;
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

        var expanded = flock.ui.nodeRenderer.synth.expandDef(synthDef, that.enviro);
        flock.ui.nodeRenderer.synth.accumulateRenderers(undefined, expanded, that);

        var graph = flock.ui.nodeRenderer.synth.renderGraph(that);
        flock.ui.nodeRenderer.synth.layoutGraph(graph);
        flock.ui.nodeRenderer.synth.renderEdges(that.jsPlumb.plumb, graph.edges);
    };

    flock.ui.nodeRenderer.synth.refreshView = function (that) {
        var activeSynthSpec = that.model.activeSynthSpec;
        if (!activeSynthSpec || !activeSynthSpec.synthDef || $.isEmptyObject(activeSynthSpec.synthDef)) {
            return;
        }

        that.events.onRender.fire();
        flock.ui.nodeRenderer.synth.clear(that.jsPlumb, that.container, that.ugenRenderers);
        flock.ui.nodeRenderer.synth.render(activeSynthSpec.synthDef, that);
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
