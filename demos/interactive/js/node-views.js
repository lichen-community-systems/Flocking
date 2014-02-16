/*
 * Flocking Node Views
 *   Copyright 2014, Colin Clark
 *
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";
    
    var $ = fluid.registerNamespace("jQuery");
    
    fluid.registerNamespace("flock.ui.nodeRenderers");
    
    fluid.defaults("flock.ui.nodeRenderers.ugen", {
        gradeNames: ["fluid.viewRelayComponent", "autoInit"],
        
        model: {}, // A ugenDef.
        
        invokers: {
            refreshView: {
                funcName: "flock.ui.nodeRenderers.ugen.refreshView",
                args: [
                    "{that}.container",
                    "{that}.options.markup.node",
                    "{that}.model",
                    "{that}.events.afterRender.fire"
                ],
                dynamic: true
            }
        },
        
        events: {
            afterRender: null
        },
        
        markup: {
            node: "<div class='node %type'>%type</div>"
        }
    });
    
    flock.ui.nodeRenderers.ugen.refreshView = function (container, nodeMarkup, ugenDef, afterRender) {
        var strings = flock.ui.nodeRenderers.ugen.prepareStrings(ugenDef),
            renderedMarkup = fluid.stringTemplate(nodeMarkup, strings),
            node = $(renderedMarkup);
        
        container.append(node);
        
        if (afterRender) {
            afterRender(node, ugenDef);
        }
    };
    
    flock.ui.nodeRenderers.ugen.prepareStrings = function (ugenDef) {
        var toTailPath = fluid.pathUtil.getToTailPath(ugenDef.ugen),
            type;
        
        // Hardcoded. Need to read the unit generator's defaults and look for tags.
        if (ugenDef.ugen === "flock.ugen.value") {
            type = ugenDef.inputs.value;
        } else {
            // TODO: Make configurable.
            type = toTailPath === "flock.ugen" ? fluid.pathUtil.getTailPath(ugenDef.ugen) : ugenDef.ugen;
        }

        return {
            type: type
        };
    };
    
    
    fluid.defaults("flock.ui.nodeRenderers.synth", {
        gradeNames: ["fluid.viewRelayComponent", "autoInit"],
        
        model: {}, // A synthDef.
        
        invokers: {
            refreshView: {
                funcName: "flock.ui.nodeRenderers.synth.refreshView",
                args: [
                    "{that}.container",
                    "{arguments}.0",
                    "{that}.events.afterRender.fire"
                ]
            }
        },
        
        events: {
            afterRender: null
        },
        
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
        // TODO: These are wrong!
        var options = {
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
            inputName,
            inputDef,
            renderer;
            
        for (inputName in inputDefs) {
            inputDef = inputDefs[inputName];
            
            if (flock.input.shouldExpand(inputName, inputDef)) {
                flock.ui.nodeRenderers.synth.accumulateRenderers(inputDef, container, renderers);
            }
        }
        
        renderer = flock.ui.nodeRenderers.ugen(container, {
            model: ugen
        });
        
        renderers.push(renderer);
    };
    
    flock.ui.nodeRenderers.synth.render = function (renderers) {
        fluid.each(renderers, function (renderer) {
            renderer.refreshView();
        });
    };
    
    // TODO: use dynamic components instead.
    flock.ui.nodeRenderers.synth.refreshView = function (container, synthSpec, afterRender) {
        if (!synthSpec || $.isEmptyObject(synthSpec)) {
            return;
        }
        
        container.children().remove();
        
        var synthDef = synthSpec.synthDef;
        var expanded = flock.ui.nodeRenderers.synth.expandDef(synthDef);
        // TODO: Renderers leak?
        var renderers = flock.ui.nodeRenderers.synth.makeRenderers(expanded, container);
        var ugenEls = flock.ui.nodeRenderers.synth.render(renderers);
        
        if (afterRender) {
            afterRender(ugenEls);
        }
    };
    
}());
