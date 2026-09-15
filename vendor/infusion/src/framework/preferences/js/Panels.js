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

    /**********************
     * msgLookup grade *
     **********************/

    fluid.defaults("fluid.prefs.msgLookup", {
        gradeNames: ["fluid.component"],
        members: {
            msgLookup: {
                expander: {
                    funcName: "fluid.prefs.stringLookup",
                    args: ["{msgResolver}", "{that}.options.stringArrayIndex"]
                }
            }
        },
        stringArrayIndex: {}
    });

    fluid.prefs.stringLookup = function (messageResolver, stringArrayIndex) {
        var that = {id: fluid.allocateGuid()};
        that.singleLookup = function (value) {
            var looked = messageResolver.lookup([value]);
            return fluid.get(looked, "template");
        };
        that.multiLookup = function (values) {
            return fluid.transform(values, function (value) {
                return that.singleLookup(value);
            });
        };
        that.lookup = function (value) {
            var values = fluid.get(stringArrayIndex, value) || value;
            var lookupFn = fluid.isArrayable(values) ? "multiLookup" : "singleLookup";
            return that[lookupFn](values);
        };
        that.resolvePathSegment = that.lookup;
        return that;
    };

    /***********************************************
     * Base grade panel
     ***********************************************/

    fluid.defaults("fluid.prefs.panel", {
        gradeNames: ["fluid.prefs.msgLookup", "fluid.rendererComponent"],
        events: {
            onDomBind: null
        },
        // Any listener that requires a DOM element, should be registered
        // to the onDomBind listener. By default it is fired by onCreate, but
        // when used as a subpanel, it will be triggered by the resetDomBinder invoker.
        listeners: {
            "onCreate.onDomBind": "{that}.events.onDomBind"
        },
        components: {
            msgResolver: {
                type: "fluid.messageResolver"
            }
        },
        rendererOptions: {
            messageLocator: "{msgResolver}.resolve"
        },
        distributeOptions: {
            "panel.msgResolver.messageBase": {
                source: "{that}.options.messageBase",
                target: "{that > msgResolver}.options.messageBase"
            }
        }
    });

    /***************************
     * Base grade for subpanel *
     ***************************/

    fluid.defaults("fluid.prefs.subPanel", {
        gradeNames: ["fluid.prefs.panel", "{that}.getDomBindGrade"],
        listeners: {
            "{compositePanel}.events.afterRender": {
                listener: "{that}.events.afterRender",
                args: ["{that}"],
                namespce: "boilAfterRender"
            },
            // Changing the firing of onDomBind from the onCreate.
            // This is due to the fact that the rendering process, controlled by the
            // composite panel, will set/replace the DOM elements.
            "onCreate.onDomBind": null, // remove listener
            "afterRender.onDomBind": "{that}.resetDomBinder"
        },
        rules: {
            expander: {
                func: "fluid.prefs.subPanel.generateRules",
                args: ["{that}.options.preferenceMap"]
            }
        },
        invokers: {
            refreshView: "{compositePanel}.refreshView",
            // resetDomBinder must fire the onDomBind event
            resetDomBinder: {
                funcName: "fluid.prefs.subPanel.resetDomBinder",
                args: ["{that}"]
            },
            getDomBindGrade: {
                funcName: "fluid.prefs.subPanel.getDomBindGrade",
                args: ["{prefsEditor}"]
            }
        },
        strings: {},
        parentBundle: "{compositePanel}.messageResolver",
        renderOnInit: false
    });

    fluid.defaults("fluid.prefs.subPanel.domBind", {
        gradeNames: ["fluid.component"],
        listeners: {
            "onDomBind.domChange": {
                listener: "{prefsEditor}.events.onSignificantDOMChange"
            }
        }
    });

    fluid.prefs.subPanel.getDomBindGrade = function (prefsEditor) {
        var hasListener = fluid.get(prefsEditor, "options.events.onSignificantDOMChange") !== undefined;
        if (hasListener) {
            return "fluid.prefs.subPanel.domBind";
        }
    };

    /*
     * Since the composite panel manages the rendering of the subpanels
     * the markup used by subpanels needs to be completely replaced.
     * The subpanel's container is refereshed to point at the newly
     * rendered markup, and the domBinder is re-initialized. Once
     * this is all done, the onDomBind event is fired.
     */
    fluid.prefs.subPanel.resetDomBinder = function (that) {
        // TODO: The line below to find the container jQuery instance was copied from the framework code -
        // https://github.com/fluid-project/infusion/blob/main/src/framework/core/js/FluidView.js#L145
        // in order to reset the dom binder when panels are in an iframe.
        // It can be be eliminated once we have the new renderer.
        var userJQuery = that.container.constructor;
        var context = that.container[0].ownerDocument;
        var selector = that.container.selector;
        that.container = userJQuery(selector, context);
        // To address FLUID-5966, manually adding back the selector and context properties that were removed from jQuery v3.0.
        // ( see: https://jquery.com/upgrade-guide/3.0/#breaking-change-deprecated-context-and-selector-properties-removed )
        // In most cases the "selector" property will already be restored through the DOM binder or fluid.container.
        // However, in this case we are manually recreating the container to ensure that it is referencing an element currently added
        // to the correct Document ( e.g. iframe ) (also see: FLUID-4536). This manual recreation of the container requires us to
        // manually add back the selector and context from the original container. This code and fix parallels that in
        // FluidView.js fluid.container line 129
        that.container.selector = selector;
        that.container.context = context;
        if (that.container.length === 0) {
            fluid.fail("resetDomBinder got no elements in DOM for container searching for selector " + that.container.selector);
        }
        fluid.initDomBinder(that, that.options.selectors);
        that.events.onDomBind.fire(that);
    };

    fluid.prefs.subPanel.safePrefKey = function (prefKey) {
        return prefKey.replace(/[.]/g, "_");
    };

    /*
     * Generates the model relay rules for a subpanel.
     * Takes advantage of the fact that compositePanel
     * uses the preference key (with "." replaced by "_"),
     * as its model path.
     */
    fluid.prefs.subPanel.generateRules = function (preferenceMap) {
        var rules = {};
        fluid.each(preferenceMap, function (prefObj, prefKey) {
            fluid.each(prefObj, function (value, prefRule) {
                if (prefRule.indexOf("model.") === 0) {
                    rules[fluid.prefs.subPanel.safePrefKey(prefKey)] = prefRule.slice("model.".length);
                }
            });
        });
        return rules;
    };

    /**********************************
     * Base grade for composite panel *
     **********************************/

    fluid.registerNamespace("fluid.prefs.compositePanel");

    fluid.prefs.compositePanel.arrayMergePolicy = function (target, source) {
        target = fluid.makeArray(target);
        source = fluid.makeArray(source);
        fluid.each(source, function (selector) {
            if (target.indexOf(selector) < 0) {
                target.push(selector);
            }
        });
        return target;
    };

    fluid.defaults("fluid.prefs.compositePanel", {
        gradeNames: ["fluid.prefs.panel", "{that}.getDistributeOptionsGrade", "{that}.getSubPanelLifecycleBindings"],
        mergePolicy: {
            subPanelOverrides: "noexpand",
            selectorsToIgnore: fluid.prefs.compositePanel.arrayMergePolicy
        },
        selectors: {}, // requires selectors into the template which will act as the containers for the subpanels
        selectorsToIgnore: [], // should match the selectors that are used to identify the containers for the subpanels
        repeatingSelectors: [],
        events: {
            initSubPanels: null
        },
        listeners: {
            "onCreate.combineResources": "{that}.combineResources",
            "onCreate.appendTemplate": {
                "this": "{that}.container",
                "method": "append",
                "args": ["{that}.options.resources.template.resourceText"]
            },
            "onCreate.initSubPanels": "{that}.events.initSubPanels",
            "onCreate.hideInactive": "{that}.hideInactive",
            "afterRender.hideInactive": "{that}.hideInactive"
        },
        invokers: {
            getDistributeOptionsGrade: {
                funcName: "fluid.prefs.compositePanel.assembleDistributeOptions",
                args: ["{that}.options.components"]
            },
            getSubPanelLifecycleBindings: {
                funcName: "fluid.prefs.compositePanel.subPanelLifecycleBindings",
                args: ["{that}", "{that}.options.components"]
            },
            combineResources: {
                funcName: "fluid.prefs.compositePanel.combineTemplates",
                args: ["{that}.options.resources", "{that}.options.selectors"]
            },
            produceSubPanelTrees: {
                funcName: "fluid.prefs.compositePanel.produceSubPanelTrees",
                args: ["{that}"]
            },
            expandProtoTree: {
                funcName: "fluid.prefs.compositePanel.expandProtoTree",
                args: ["{that}"]
            },
            produceTree: {
                funcName: "fluid.prefs.compositePanel.produceTree",
                args: ["{that}"]
            },
            hideInactive: {
                funcName: "fluid.prefs.compositePanel.hideInactive",
                args: ["{that}"]
            },
            handleRenderOnPreference: {
                funcName: "fluid.prefs.compositePanel.handleRenderOnPreference",
                args: ["{that}", "{that}.refreshView", "{that}.conditionalCreateEvent", "{arguments}.0", "{arguments}.1", "{arguments}.2"]
            },
            conditionalCreateEvent: {
                funcName: "fluid.prefs.compositePanel.conditionalCreateEvent"
            }
        },
        subPanelOverrides: {
            gradeNames: ["fluid.prefs.subPanel"]
        },
        rendererFnOptions: {
            noexpand: true,
            cutpointGenerator: "fluid.prefs.compositePanel.cutpointGenerator",
            subPanelRepeatingSelectors: {
                expander: {
                    funcName: "fluid.prefs.compositePanel.surfaceRepeatingSelectors",
                    args: ["{that}.options.components"]
                }
            }
        },
        components: {},
        resources: {} // template is reserved for the compositePanel's template, the subpanel template should have same key as the selector for its container.
    });

    /*
     * Attempts to prefetch a components options before it is instantiated.
     * Only use in cases where the instantiated component cannot be used.
     */
    fluid.prefs.compositePanel.prefetchComponentOptions = function (type, options) {
        var baseOptions = fluid.getMergedDefaults(type, fluid.get(options, "gradeNames"));
        // TODO: awkwardly, fluid.merge is destructive on each argument!
        return fluid.merge(baseOptions.mergePolicy, fluid.copy(baseOptions), options);
    };
    /*
     * Should only be used when fluid.prefs.compositePanel.isActivatePanel cannot.
     * While this implementation doesn't require an instantiated component, it may in
     * the process miss some configuration provided by distribute options and demands.
     */
    fluid.prefs.compositePanel.isPanel = function (type, options) {
        var opts = fluid.prefs.compositePanel.prefetchComponentOptions(type, options);
        return fluid.hasGrade(opts, "fluid.prefs.panel");
    };

    fluid.prefs.compositePanel.isActivePanel = function (comp) {
        return comp && fluid.hasGrade(comp.options, "fluid.prefs.panel");
    };

    /*
     * Creates a grade containing the distributeOptions rules needed for the subcomponents
     */
    fluid.prefs.compositePanel.assembleDistributeOptions = function (components) {
        var gradeName = "fluid.prefs.compositePanel.distributeOptions_" + fluid.allocateGuid();
        var distributeOptions = {};
        var relayOption = {};
        fluid.each(components, function (componentOptions, componentName) {
            if (fluid.prefs.compositePanel.isPanel(componentOptions.type, componentOptions.options)) {
                distributeOptions[componentName + ".subPanelOverrides"] = {
                    source: "{that}.options.subPanelOverrides",
                    target: "{that > " + componentName + "}.options"
                };
            }

            // Construct the model relay btw the composite panel and its subpanels
            var componentRelayRules = {};
            var definedOptions = fluid.prefs.compositePanel.prefetchComponentOptions(componentOptions.type, componentOptions.options);
            var preferenceMap = fluid.get(definedOptions, ["preferenceMap"]);
            fluid.each(preferenceMap, function (prefObj, prefKey) {
                fluid.each(prefObj, function (value, prefRule) {
                    if (prefRule.indexOf("model.") === 0) {
                        fluid.set(componentRelayRules, prefRule.slice("model.".length), "{compositePanel}.model." + fluid.prefs.subPanel.safePrefKey(prefKey));
                    }
                });
            });
            relayOption[componentName] = componentRelayRules;
            distributeOptions[componentName + ".modelRelay"] = {
                source: "{that}.options.relayOption." + componentName,
                target: "{that > " + componentName + "}.options.model"
            };
        });
        fluid.defaults(gradeName, {
            relayOption: relayOption,
            distributeOptions: distributeOptions
        });
        return gradeName;
    };

    fluid.prefs.compositePanel.conditionalCreateEvent = function (value, createEvent) {
        if (value) {
            createEvent();
        }
    };


    fluid.prefs.compositePanel.handleRenderOnPreference = function (that, refreshViewFunc, conditionalCreateEventFunc, value, createEvent, componentNames) {
        componentNames = fluid.makeArray(componentNames);
        conditionalCreateEventFunc(value, createEvent);
        fluid.each(componentNames, function (componentName) {
            var comp = that[componentName];
            if (!value && comp) {
                comp.destroy();
            }
        });
        refreshViewFunc();
    };

    fluid.prefs.compositePanel.creationEventName = function (pref) {
        return "initOn_" + pref;
    };

    fluid.prefs.compositePanel.generateModelListeners = function (conditionals) {
        return fluid.transform(conditionals, function (componentNames, pref) {
            var eventName = fluid.prefs.compositePanel.creationEventName(pref);
            return {
                func: "{that}.handleRenderOnPreference",
                args: ["{change}.value", "{that}.events." + eventName + ".fire", componentNames],
                namespace: "handleRenderOnPreference_" + pref
            };
        });
    };

    fluid.prefs.compositePanel.rebaseSelectorName = function (memberName, selectorName) {
        return memberName + "_" + selectorName;
    };

    fluid.prefs.compositePanel.rebaseSelector = function (compositePanelSelector, selector) {
        return compositePanelSelector + " " + selector;
    };

    /*
     * Creates a grade containing all of the lifecycle binding configuration needed for the subpanels.
     * This includes the following:
     * - adding events used to trigger the initialization of the subpanels
     * - adding the createOnEvent configuration for the subpanels
     * - binding handlers to model changed events
     * - binding handlers to afterRender and onCreate
     * - surfacing selectors from the subpanels to the composite panel
     */
    fluid.prefs.compositePanel.subPanelLifecycleBindings = function (that, components) {
        var gradeName = "fluid.prefs.compositePanel.subPanelCreationTimingDistibution_" + fluid.allocateGuid();
        var distributeOptions = {};
        var subPanelCreationOpts = {
            "default": "initSubPanels"
        };
        var conditionals = {};
        var listeners = {};
        var events = {};
        var selectors = {};
        fluid.each(components, function (componentOptions, componentName) {
            if (fluid.prefs.compositePanel.isPanel(componentOptions.type, componentOptions.options)) {
                var creationEventOpt = "default";
                // would have had renderOnPreference directly sourced from the componentOptions
                // however, the set of configuration specified there is restricted.
                var renderOnPreference = fluid.get(componentOptions, "options.renderOnPreference");
                if (renderOnPreference) {
                    var pref = fluid.prefs.subPanel.safePrefKey(renderOnPreference);
                    var onCreateListener = "onCreate." + pref;
                    creationEventOpt = fluid.prefs.compositePanel.creationEventName(pref);
                    subPanelCreationOpts[creationEventOpt] = creationEventOpt;
                    events[creationEventOpt] = null;
                    conditionals[pref] = conditionals[pref] || [];
                    conditionals[pref].push(componentName);
                    listeners[onCreateListener] = {
                        listener: "{that}.conditionalCreateEvent",
                        args: ["{that}.model." + pref, "{that}.events." + creationEventOpt + ".fire"]
                    };
                }
                distributeOptions[componentName + ".subPanelCreationOpts"] = {
                    source: "{that}.options.subPanelCreationOpts." + creationEventOpt,
                    target: "{that}.options.components." + componentName + ".createOnEvent"
                };


                var opts = fluid.prefs.compositePanel.prefetchComponentOptions(componentOptions.type, componentOptions.options);
                fluid.each(opts.selectors, function (selector, selName) {
                    if (!opts.selectorsToIgnore || opts.selectorsToIgnore.indexOf(selName) < 0) {
                        // Sets an expander for each surfaced selector because we need to prepend the the subpanel's own
                        // container selector to ensure that the dom binder scopes those selectors to the appropriate
                        // component's container. Other options for obtaining the composite panel's container required
                        // either modifying the options after resolution or would trigger the resolution of composite
                        // panel's selectors and prevent accepting any more options merged on top.
                        selectors[fluid.prefs.compositePanel.rebaseSelectorName(componentName, selName)] = {
                            expander: {
                                funcName: "fluid.prefs.compositePanel.rebaseSelector",
                                args: ["{that}.options.selectors." + componentName, selector]
                            }
                        };
                    }
                });
            }
        });

        fluid.defaults(gradeName, {
            events: events,
            listeners: listeners,
            modelListeners: fluid.prefs.compositePanel.generateModelListeners(conditionals),
            subPanelCreationOpts: subPanelCreationOpts,
            distributeOptions: distributeOptions,
            selectors: selectors
        });
        return gradeName;
    };

    /*
     * Used to hide the containers of inactive sub panels.
     * This is necessary as the composite panel's template is the one that has their containers and
     * it would be undesirable to have them visible when their associated panel has not been created.
     * Also, hiding them allows for the subpanel to initialize, as it requires their container to be present.
     * The subpanels need to be initialized before rendering, for the produce function to source the rendering
     * information from it.
     */
    fluid.prefs.compositePanel.hideInactive = function (that) {
        fluid.each(that.options.components, function (componentOpts, componentName) {
            if (fluid.prefs.compositePanel.isPanel(componentOpts.type, componentOpts.options) && !fluid.prefs.compositePanel.isActivePanel(that[componentName])) {
                that.locate(componentName).hide();
            }
        });
    };

    /*
     * Use the renderer directly to combine the templates into a single
     * template to be used by the components actual rendering.
     */
    fluid.prefs.compositePanel.combineTemplates = function (resources, selectors) {
        var cutpoints = [];
        var tree = {children: []};

        fluid.each(resources, function (resource, resourceName) {
            if (resourceName !== "template") {
                tree.children.push({
                    ID: resourceName,
                    markup: resource.resourceText
                });
                cutpoints.push({
                    id: resourceName,
                    selector: selectors[resourceName]
                });
            }
        });

        var resourceSpec = {
            base: {
                resourceText: resources.template.resourceText,
                href: ".",
                resourceKey: ".",
                cutpoints: cutpoints
            }
        };

        var templates = fluid.parseTemplates(resourceSpec, ["base"]);
        var renderer = fluid.renderer(templates, tree, {cutpoints: cutpoints, debugMode: true});
        resources.template.resourceText = renderer.renderTemplates();
    };

    fluid.prefs.compositePanel.surfaceRepeatingSelectors = function (components) {
        var repeatingSelectors = [];
        fluid.each(components, function (compOpts, compName) {
            if (fluid.prefs.compositePanel.isPanel(compOpts.type, compOpts.options)) {
                var opts = fluid.prefs.compositePanel.prefetchComponentOptions(compOpts.type, compOpts.options);
                var rebasedRepeatingSelectors = fluid.transform(opts.repeatingSelectors, function (selector) {
                    return fluid.prefs.compositePanel.rebaseSelectorName(compName, selector);
                });
                repeatingSelectors = repeatingSelectors.concat(rebasedRepeatingSelectors);
            }
        });
        return repeatingSelectors;
    };

    fluid.prefs.compositePanel.cutpointGenerator = function (selectors, options) {
        var opts = {
            selectorsToIgnore: options.selectorsToIgnore,
            repeatingSelectors: options.repeatingSelectors.concat(options.subPanelRepeatingSelectors)
        };
        return fluid.renderer.selectorsToCutpoints(selectors, opts);
    };

    fluid.prefs.compositePanel.rebaseID = function (value, memberName) {
        return memberName + "_" + value;
    };

    fluid.prefs.compositePanel.rebaseParentRelativeID = function (val, memberName) {
        var slicePos = "..::".length; // ..:: refers to the parentRelativeID prefix used in the renderer
        return val.slice(0, slicePos) + fluid.prefs.compositePanel.rebaseID(val.slice(slicePos), memberName);
    };

    fluid.prefs.compositePanel.rebaseValueBinding = function (value, modelRelayRules) {
        return fluid.find(modelRelayRules, function (oldModelPath, newModelPath) {
            if (value === oldModelPath) {
                return newModelPath;
            } else if (value.indexOf(oldModelPath) === 0) {
                return value.replace(oldModelPath, newModelPath);
            }
        }) || value;
    };

    fluid.prefs.compositePanel.rebaseTreeComp = function (msgResolver, model, treeComp, memberName, modelRelayRules) {
        var rebased = fluid.copy(treeComp);

        if (rebased.ID) {
            rebased.ID = fluid.prefs.compositePanel.rebaseID(rebased.ID, memberName);
        }

        if (rebased.children) {
            rebased.children = fluid.prefs.compositePanel.rebaseTree(msgResolver, model, rebased.children, memberName, modelRelayRules);
        } else if (rebased.selection) {
            rebased.selection = fluid.prefs.compositePanel.rebaseTreeComp(msgResolver, model, rebased.selection, memberName, modelRelayRules);
        } else if (rebased.messagekey) {
            // converts the "UIMessage" renderer component into a "UIBound"
            // and passes in the resolved message as the value.
            rebased.componentType = "UIBound";
            rebased.value = msgResolver.resolve(rebased.messagekey.value, rebased.messagekey.args);
            delete rebased.messagekey;
        } else if (rebased.parentRelativeID) {
            rebased.parentRelativeID = fluid.prefs.compositePanel.rebaseParentRelativeID(rebased.parentRelativeID, memberName);
        } else if (rebased.valuebinding) {
            rebased.valuebinding = fluid.prefs.compositePanel.rebaseValueBinding(rebased.valuebinding, modelRelayRules);

            if (rebased.value) {
                var modelValue = fluid.get(model, rebased.valuebinding);
                rebased.value = modelValue !== undefined ? modelValue : rebased.value;
            }
        }

        return rebased;
    };

    fluid.prefs.compositePanel.rebaseTree = function (msgResolver, model, tree, memberName, modelRelayRules) {
        var rebased;

        if (fluid.isArrayable(tree)) {
            rebased = fluid.transform(tree, function (treeComp) {
                return fluid.prefs.compositePanel.rebaseTreeComp(msgResolver, model, treeComp, memberName, modelRelayRules);
            });
        } else {
            rebased = fluid.prefs.compositePanel.rebaseTreeComp(msgResolver, model, tree, memberName, modelRelayRules);
        }

        return rebased;
    };

    fluid.prefs.compositePanel.produceTree = function (that) {
        var produceTreeOption = that.options.produceTree;
        var ownTree = produceTreeOption ?
            (typeof(produceTreeOption) === "string" ? fluid.getGlobalValue(produceTreeOption) : produceTreeOption)(that) :
            that.expandProtoTree();
        var subPanelTree = that.produceSubPanelTrees();
        var tree = {
            children: ownTree.children.concat(subPanelTree.children)
        };
        return tree;
    };

    fluid.prefs.compositePanel.expandProtoTree = function (that) {
        var expanderOptions = fluid.renderer.modeliseOptions(that.options.expanderOptions, {ELstyle: "${}"}, that);
        var expander = fluid.renderer.makeProtoExpander(expanderOptions, that);
        return expander(that.options.protoTree || {});
    };

    fluid.prefs.compositePanel.produceSubPanelTrees = function (that) {
        var tree = {children: []};
        fluid.each(that.options.components, function (options, componentName) {
            var subPanel = that[componentName];
            if (fluid.prefs.compositePanel.isActivePanel(subPanel)) {
                var expanderOptions = fluid.renderer.modeliseOptions(subPanel.options.expanderOptions, {ELstyle: "${}"}, subPanel);
                var expander = fluid.renderer.makeProtoExpander(expanderOptions, subPanel);
                var subTree = subPanel.produceTree();
                subTree = fluid.get(subPanel.options, "rendererFnOptions.noexpand") ? subTree : expander(subTree);
                var rebasedTree = fluid.prefs.compositePanel.rebaseTree(subPanel.msgResolver, that.model, subTree, componentName, subPanel.options.rules);
                tree.children = tree.children.concat(rebasedTree.children);
            }
        });
        return tree;
    };

    /********************************************************************************
     * The grade that contains the connections between a panel and the prefs editor *
     ********************************************************************************/

    fluid.defaults("fluid.prefs.prefsEditorConnections", {
        gradeNames: ["fluid.component"],
        listeners: {
            // No namespace supplied because this grade is added to every panel. Suppling a
            // namespace would mean that only one panel's refreshView method was bound to the
            // onPrefsEditorRefresh event.
            "{fluid.prefs.prefsEditor}.events.onPrefsEditorRefresh": "{fluid.prefs.panel}.refreshView"
        },
        strings: {},
        parentBundle: "{fluid.prefs.prefsEditorLoader}.msgResolver"
    });

    /*******************************************
     * A base grade for switch adjuster panels *
     *******************************************/

    fluid.defaults("fluid.prefs.panel.switchAdjuster", {
        gradeNames: ["fluid.prefs.panel"],
        // preferences maps should map model values to "model.value"
        // model: {value: ""}
        selectors: {
            header: ".flc-prefsEditor-header",
            switchContainer: ".flc-prefsEditor-switch",
            label: ".flc-prefsEditor-label",
            description: ".flc-prefsEditor-description"
        },
        selectorsToIgnore: ["header", "switchContainer"],
        components: {
            switchUI: {
                type: "fluid.switchUI",
                container: "{that}.dom.switchContainer",
                createOnEvent: "afterRender",
                options: {
                    strings: {
                        on: "{fluid.prefs.panel.switchAdjuster}.msgLookup.switchOn",
                        off: "{fluid.prefs.panel.switchAdjuster}.msgLookup.switchOff"
                    },
                    model: {
                        enabled: "{fluid.prefs.panel.switchAdjuster}.model.value"
                    },
                    attrs: {
                        "aria-labelledby": {
                            expander: {
                                funcName: "fluid.allocateSimpleId",
                                args: ["{fluid.prefs.panel.switchAdjuster}.dom.description"]
                            }
                        }
                    }
                }
            }
        },
        protoTree: {
            label: {messagekey: "label"},
            description: {messagekey: "description"}
        }
    });

    /************************************************
     * A base grade for themePicker adjuster panels *
     ************************************************/

    fluid.defaults("fluid.prefs.panel.themePicker", {
        gradeNames: ["fluid.prefs.panel"],
        mergePolicy: {
            "controlValues.theme": "replace",
            "stringArrayIndex.theme": "replace"
        },
        // The controlValues are the ordered set of possible modelValues corresponding to each theme option.
        // The order in which they are listed will determine the order they are presented in the UI.
        // The stringArrayIndex contains the ordered set of namespaced strings in the message bundle.
        // The order must match the controlValues in order to provide the proper labels to the theme options.
        controlValues: {
            theme: [] // must be supplied by the integrator
        },
        stringArrayIndex: {
            theme: [] // must be supplied by the integrator
        },
        selectID: "{that}.id", // used for the name attribute to group the selection options
        listeners: {
            "afterRender.style": "{that}.style"
        },
        selectors: {
            themeRow: ".flc-prefsEditor-themeRow",
            themeLabel: ".flc-prefsEditor-theme-label",
            themeInput: ".flc-prefsEditor-themeInput",
            label: ".flc-prefsEditor-themePicker-label",
            description: ".flc-prefsEditor-themePicker-descr"
        },
        styles: {
            defaultThemeLabel: "fl-prefsEditor-themePicker-defaultThemeLabel"
        },
        repeatingSelectors: ["themeRow"],
        protoTree: {
            label: {messagekey: "label"},
            description: {messagekey: "description"},
            expander: {
                type: "fluid.renderer.selection.inputs",
                rowID: "themeRow",
                labelID: "themeLabel",
                inputID: "themeInput",
                selectID: "{that}.options.selectID",
                tree: {
                    optionnames: "${{that}.msgLookup.theme}",
                    optionlist: "${{that}.options.controlValues.theme}",
                    selection: "${value}"
                }
            }
        },
        markup: {
            // Aria-hidden needed on fl-preview-A and Display 'a' created as pseudo-content in css to prevent AT from reading out display 'a' on IE, Chrome, and Safari
            // Aria-hidden needed on fl-crossout to prevent AT from trying to read crossout symbol in Safari
            label: "<span class=\"fl-preview-A\" aria-hidden=\"true\"></span><span class=\"fl-hidden-accessible\">%theme</span><div class=\"fl-crossout\" aria-hidden=\"true\"></div>"
        },
        invokers: {
            style: {
                funcName: "fluid.prefs.panel.themePicker.style",
                args: [
                    "{that}.dom.themeLabel",
                    "{that}.msgLookup.theme",
                    "{that}.options.markup.label",
                    "{that}.options.controlValues.theme",
                    "default",
                    "{that}.options.classnameMap.theme",
                    "{that}.options.styles.defaultThemeLabel"
                ]
            }
        }
    });

    fluid.prefs.panel.themePicker.style = function (labels, strings, markup, theme, defaultThemeName, style, defaultLabelStyle) {
        fluid.each(labels, function (label, index) {
            label = $(label);

            var themeValue = strings[index];
            label.html(fluid.stringTemplate(markup, {
                theme: themeValue
            }));

            var labelTheme = theme[index];
            if (labelTheme === defaultThemeName) {
                label.addClass(defaultLabelStyle);
            }
            label.addClass(style[labelTheme]);
        });
    };

    /******************************************************
     * A base grade for textfield stepper adjuster panels *
     ******************************************************/

    fluid.defaults("fluid.prefs.panel.stepperAdjuster", {
        gradeNames: ["fluid.prefs.panel"],
        // preferences maps should map model values to "model.value"
        // model: {value: ""}
        selectors: {
            header: ".flc-prefsEditor-header",
            textfieldStepperContainer: ".flc-prefsEditor-textfieldStepper",
            label: ".flc-prefsEditor-label",
            descr: ".flc-prefsEditor-descr"
        },
        selectorsToIgnore: ["header", "textfieldStepperContainer"],
        components: {
            textfieldStepper: {
                type: "fluid.textfieldStepper",
                container: "{that}.dom.textfieldStepperContainer",
                createOnEvent: "afterRender",
                options: {
                    model: {
                        value: "{fluid.prefs.panel.stepperAdjuster}.model.value",
                        range: {
                            min: "{fluid.prefs.panel.stepperAdjuster}.options.range.min",
                            max: "{fluid.prefs.panel.stepperAdjuster}.options.range.max"
                        },
                        step: "{fluid.prefs.panel.stepperAdjuster}.options.step"
                    },
                    scale: 1,
                    strings: {
                        increaseLabel: "{fluid.prefs.panel.stepperAdjuster}.msgLookup.increaseLabel",
                        decreaseLabel: "{fluid.prefs.panel.stepperAdjuster}.msgLookup.decreaseLabel"
                    },
                    attrs: {
                        "aria-labelledby": "{fluid.prefs.panel.stepperAdjuster}.options.panelOptions.labelId"
                    }
                }
            }
        },
        protoTree: {
            label: {
                messagekey: "label",
                decorators: {
                    attrs: {id: "{that}.options.panelOptions.labelId"}
                }
            },
            descr: {messagekey: "description"}
        },
        panelOptions: {
            labelIdTemplate: "%guid",
            labelId: {
                expander: {
                    funcName: "fluid.prefs.panel.stepperAdjuster.setLabelID",
                    args: ["{that}.options.panelOptions.labelIdTemplate"]
                }
            }
        }
    });

    /**
     * @param {String} template - take string template with a token "%guid" to be replaced by the a unique ID.
     * @return {String} - the resolved templated with the injected unique ID.
     */
    fluid.prefs.panel.stepperAdjuster.setLabelID = function (template) {
        return fluid.stringTemplate(template, {
            guid: fluid.allocateGuid()
        });
    };

    /********************************
     * Preferences Editor Text Size *
     ********************************/

    /**
     * A sub-component of fluid.prefs that renders the "text size" panel of the user preferences interface.
     */
    fluid.defaults("fluid.prefs.panel.textSize", {
        gradeNames: ["fluid.prefs.panel.stepperAdjuster"],
        preferenceMap: {
            "fluid.prefs.textSize": {
                "model.value": "value",
                "range.min": "minimum",
                "range.max": "maximum",
                "step": "multipleOf"
            }
        },
        panelOptions: {
            labelIdTemplate: "textSize-label-%guid"
        }
    });

    /********************************
     * Preferences Editor Text Font *
     ********************************/

    /**
     * A sub-component of fluid.prefs that renders the "text font" panel of the user preferences interface.
     */
    fluid.defaults("fluid.prefs.panel.textFont", {
        gradeNames: ["fluid.prefs.panel"],
        preferenceMap: {
            "fluid.prefs.textFont": {
                "model.value": "value",
                "controlValues.textFont": "enum",
                "stringArrayIndex.textFont": "enumLabels"
            }
        },
        mergePolicy: {
            "controlValues.textFont": "replace",
            "stringArrayIndex.textFont": "replace"
        },
        selectors: {
            header: ".flc-prefsEditor-text-font-header",
            textFont: ".flc-prefsEditor-text-font",
            label: ".flc-prefsEditor-text-font-label",
            textFontDescr: ".flc-prefsEditor-text-font-descr"
        },
        selectorsToIgnore: ["header"],
        protoTree: {
            label: {messagekey: "textFontLabel"},
            textFontDescr: {messagekey: "textFontDescr"},
            textFont: {
                optionnames: "${{that}.msgLookup.textFont}",
                optionlist: "${{that}.options.controlValues.textFont}",
                selection: "${value}",
                decorators: {
                    type: "fluid",
                    func: "fluid.prefs.selectDecorator",
                    options: {
                        styles: "{that}.options.classnameMap.textFont"
                    }
                }
            }
        },
        classnameMap: null // must be supplied by implementors
    });

    /*********************************
     * Preferences Editor Line Space *
     *********************************/

    /**
     * A sub-component of fluid.prefs that renders the "line space" panel of the user preferences interface.
     */
    fluid.defaults("fluid.prefs.panel.lineSpace", {
        gradeNames: ["fluid.prefs.panel.stepperAdjuster"],
        preferenceMap: {
            "fluid.prefs.lineSpace": {
                "model.value": "value",
                "range.min": "minimum",
                "range.max": "maximum",
                "step": "multipleOf"
            }
        },
        panelOptions: {
            labelIdTemplate: "lineSpace-label-%guid"
        }
    });

    /*******************************
     * Preferences Editor Contrast *
     *******************************/

    /**
     * A sub-component of fluid.prefs that renders the "contrast" panel of the user preferences interface.
     */
    fluid.defaults("fluid.prefs.panel.contrast", {
        gradeNames: ["fluid.prefs.panel.themePicker"],
        preferenceMap: {
            "fluid.prefs.contrast": {
                "model.value": "value",
                "controlValues.theme": "enum",
                "stringArrayIndex.theme": "enumLabels"
            }
        },
        listeners: {
            "afterRender.style": "{that}.style"
        },
        selectors: {
            header: ".flc-prefsEditor-contrast-header",
            themeRow: ".flc-prefsEditor-themeRow",
            themeLabel: ".flc-prefsEditor-theme-label",
            themeInput: ".flc-prefsEditor-themeInput",
            label: ".flc-prefsEditor-themePicker-label",
            contrastDescr: ".flc-prefsEditor-themePicker-descr"
        },
        selectorsToIgnore: ["header"],
        styles: {
            defaultThemeLabel: "fl-prefsEditor-themePicker-defaultThemeLabel"
        }
    });

    /**************************************
     * Preferences Editor Layout Controls *
     **************************************/

    /**
     * A sub-component of fluid.prefs that renders the "layout and navigation" panel of the user preferences interface.
     */
    fluid.defaults("fluid.prefs.panel.layoutControls", {
        gradeNames: ["fluid.prefs.panel.switchAdjuster"],
        preferenceMap: {
            "fluid.prefs.tableOfContents": {
                "model.value": "value"
            }
        }
    });

    /*************************************
     * Preferences Editor Enhance Inputs *
     *************************************/

    /**
     * A sub-component of fluid.prefs that renders the "enhance inputs" panel of the user preferences interface.
     */
    fluid.defaults("fluid.prefs.panel.enhanceInputs", {
        gradeNames: ["fluid.prefs.panel.switchAdjuster"],
        preferenceMap: {
            "fluid.prefs.enhanceInputs": {
                "model.value": "value"
            }
        }
    });

    /********************************************************
     * Preferences Editor Select Dropdown Options Decorator *
     ********************************************************/

    /**
     * A sub-component that decorates the options on the select dropdown list box with the css style
     */
    fluid.defaults("fluid.prefs.selectDecorator", {
        gradeNames: ["fluid.viewComponent"],
        listeners: {
            "onCreate.decorateOptions": "fluid.prefs.selectDecorator.decorateOptions"
        },
        styles: {
            preview: "fl-preview-theme"
        }
    });

    fluid.prefs.selectDecorator.decorateOptions = function (that) {
        fluid.each($("option", that.container), function (option) {
            var styles = that.options.styles;
            $(option).addClass(styles.preview + " " + styles[fluid.value(option)]);
        });
    };

})(jQuery, fluid_3_0_0);
