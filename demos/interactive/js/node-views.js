/*
 * Flocking Node Views
 *   Copyright 2014, Colin Clark
 *
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require, dagre*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var $ = fluid.registerNamespace("jQuery");

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
        that.node = node; // TODO: C'mon, seriously?

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
        var toTailPath = fluid.pathUtil.getToTailPath(ugenDef.ugen),
            type = toTailPath === "flock.ugen" ? fluid.pathUtil.getTailPath(ugenDef.ugen) : ugenDef.ugen,
            displayName;

        // Come up with a display name for each unit generator.
        // For value ugens, this will be its actual value. Other ugens will be
        // displayed with their last path segment (tail).
        // TODO: Do this more gracefully.
        if (flock.ui.nodeRenderers.ugen.hasTag(ugenDef.ugen,"flock.ugen.valueType")) {
            displayName = ugenDef.inputs.value;
        } else {
            // TODO: Make configurable.
            displayName = type;
        }

        // TODO: We should have some other ID that represents the view, not the model.
        // TODO: and this is the wrong time to do this.
        if (!ugenDef.id) {
            ugenDef.id = fluid.allocateGuid();
        }

        return {
            id: ugenDef.id,
            type: type,
            displayName: displayName
        };
    };


    fluid.defaults("flock.ui.nodeRenderers.synth", {
        gradeNames: ["fluid.viewComponent", "autoInit"],

        model: {
            synthDef: {},
            nodeGraph: {}
        },

        invokers: {
            refreshView: {
                funcName: "flock.ui.nodeRenderers.synth.refreshView",
                args: [
                    "{that}",
                    "{that}.applier",
                    "{that}.container",
                    "{arguments}.0",
                    "{that}.events.afterRender.fire"
                ]
            }
        },

        events: {
            afterRender: null
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
            rate: flock.rates.AUDIO, // TODO: This is hardcoded to audio rate, which is fine until we can edit value synths.
            audioSettings: flock.enviro.shared.options.audioSettings,
            buses: flock.enviro.shared.buses,
            buffers: flock.enviro.shared.buffers
        };

        if (!flock.parse.synthDef.hasOutUGen(synthDef)) {
            synthDef = flock.parse.synthDef.makeOutUGen(synthDef, options);
        }

        return flock.ui.nodeRenderers.synth.expandAllInputs(synthDef, options);
    };

    flock.ui.nodeRenderers.synth.makeRenderers = function (synthDef, container) {
        var renderers = [];

        flock.ui.nodeRenderers.synth.accumulateRenderers(synthDef, container, renderers);

        return renderers;
    };

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
                    target: inputDef.id
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

    flock.ui.nodeRenderers.synth.render = function (renderers) {
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

        var outputGraph = dagre.layout().rankDir("LR").run(g);

        // Position the nodes.
        outputGraph.eachNode(function (id, graphNode) {
            var nodeEl = $("#" + id);
            nodeEl.css({
                "position": "absolute",
                // TODO: calculate position from centre, which is what Dagre gives us.
                // TODO: Offset based on the container's position on screen.
                "top": graphNode.y + 125,
                "left": graphNode.x + 25
            });
        });
    };

    // TODO: use dynamic components instead.
    flock.ui.nodeRenderers.synth.refreshView = function (that, applier, container, synthSpec, afterRender) {
        if (!synthSpec || $.isEmptyObject(synthSpec)) {
            return;
        }

        container.children().remove();

        var synthDef = synthSpec.synthDef;
        var expanded = flock.ui.nodeRenderers.synth.expandDef(synthDef);
        // TODO: Renderers leak?
        that.ugenRenderers = flock.ui.nodeRenderers.synth.makeRenderers(expanded, container);
        var graph = flock.ui.nodeRenderers.synth.render(that.ugenRenderers);

        flock.ui.nodeRenderers.synth.layoutGraph(container, graph);
        flock.ui.nodeRenderers.synth.renderEdges(that.jsPlumb.plumb, graph.edges);

        if (afterRender) {
            afterRender();
        }
    };

    flock.ui.nodeRenderers.synth.renderEdges = function (plumb, edges) {
        fluid.each(edges, function (edge) {
            plumb.connect({
                source: plumb.addEndpoint(edge.source),
                target: plumb.addEndpoint(edge.target)
            });
        });
    };

}());
