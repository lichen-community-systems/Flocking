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

    if (!fluid.renderer) {
        fluid.fail("fluidRenderer.js is a necessary dependency of RendererUtilities");
    }

    // TODO: API status of these 3 functions is uncertain. So far, they have never
    // appeared in documentation.
    fluid.renderer.visitDecorators = function (that, visitor) {
        fluid.visitComponentChildren(that, function (component, name) {
            if (name.indexOf(fluid.renderer.decoratorComponentPrefix) === 0) {
                visitor(component, name);
            }
        }, {flat: true}, []);
    };

    fluid.renderer.clearDecorators = function (that) {
        var instantiator = fluid.getInstantiator(that);
        fluid.renderer.visitDecorators(that, function (component, name) {
            instantiator.clearComponent(that, name);
        });
    };

    fluid.renderer.getDecoratorComponents = function (that) {
        var togo = {};
        fluid.renderer.visitDecorators(that, function (component, name) {
            togo[name] = component;
        });
        return togo;
    };

    // Utilities for coordinating options in renderer components - this code is all pretty
    // dreadful and needs to be organised as a suitable set of defaults and policies
    fluid.renderer.modeliseOptions = function (options, defaults, baseOptions) {
        return $.extend({}, defaults, fluid.filterKeys(baseOptions, ["model", "applier"]), options);
    };
    fluid.renderer.reverseMerge = function (target, source, names) {
        names = fluid.makeArray(names);
        fluid.each(names, function (name) {
            if (target[name] === undefined && source[name] !== undefined) {
                target[name] = source[name];
            }
        });
    };

    /** "Renderer component" infrastructure **/

    // TODO: fix this up with IoC and improved handling of templateSource as well as better
    // options layout (model appears in both rOpts and eOpts)
    // "options" here is the original "rendererFnOptions"
    fluid.renderer.createRendererSubcomponent = function (container, selectors, options, parentThat, fossils) {
        options = options || {};
        var source = options.templateSource ? options.templateSource : {node: $(container)};
        var nativeModel = options.rendererOptions.model === undefined;
        var rendererOptions = fluid.renderer.modeliseOptions(options.rendererOptions, null, parentThat);
        rendererOptions.fossils = fossils || {};
        rendererOptions.parentComponent = parentThat;
        if (container.jquery) {
            var cascadeOptions = {
                document: container[0].ownerDocument,
                jQuery: container.constructor
            };
            fluid.renderer.reverseMerge(rendererOptions, cascadeOptions, fluid.keys(cascadeOptions));
        }

        var that = {};

        var templates = null;
        that.render = function (tree) {
            var cutpointFn = options.cutpointGenerator || "fluid.renderer.selectorsToCutpoints";
            rendererOptions.cutpoints = rendererOptions.cutpoints || fluid.invokeGlobalFunction(cutpointFn, [selectors, options]);
            if (nativeModel) {
                // check necessary since the component insanely supports the possibility the model is not the component's model!
                // and the pagedTable uses this.
                rendererOptions.model = parentThat.model; // fix FLUID-5664
            }
            var renderTarget = $(options.renderTarget ? options.renderTarget : container);

            if (templates) {
                fluid.clear(rendererOptions.fossils);
                fluid.reRender(templates, renderTarget, tree, rendererOptions);
            }
            else {
                if (typeof(source) === "function") { // TODO: make a better attempt than this at asynchrony
                    source = source();
                }
                templates = fluid.render(source, renderTarget, tree, rendererOptions);
            }
        };
        return that;
    };

    fluid.defaults("fluid.rendererComponent", {
        gradeNames: ["fluid.viewComponent"],
        initFunction: "fluid.initRendererComponent",
        mergePolicy: {
            "rendererOptions.idMap": "nomerge",
            protoTree: "noexpand, replace",
            parentBundle: "nomerge",
            "changeApplierOptions.resolverSetConfig": "resolverSetConfig"
        },
        invokers: {
            refreshView: {
                funcName: "fluid.rendererComponent.refreshView",
                args: "{that}"
            },
            produceTree: {
                funcName: "fluid.rendererComponent.produceTree",
                args: "{that}"
            }
        },
        rendererOptions: {
            autoBind: true
        },
        events: {
            onResourcesFetched: null,
            prepareModelForRender: null,
            onRenderTree: null,
            afterRender: null
        },
        listeners: {
            onCreate: {
                funcName: "fluid.rendererComponent.renderOnInit",
                args: ["{that}.options.renderOnInit", "{that}"],
                priority: "last"
            }
        }
    });

    fluid.rendererComponent.renderOnInit = function (renderOnInit, that) {
        if (renderOnInit || that.renderOnInit) {
            that.refreshView();
        }
    };

    fluid.protoExpanderForComponent = function (parentThat, options) {
        var expanderOptions = fluid.renderer.modeliseOptions(options.expanderOptions, {ELstyle: "${}"}, parentThat);
        fluid.renderer.reverseMerge(expanderOptions, options, ["resolverGetConfig", "resolverSetConfig"]);
        var expander = fluid.renderer.makeProtoExpander(expanderOptions, parentThat);
        return expander;
    };

    fluid.rendererComponent.refreshView = function (that) {
        if (!that.renderer) {
            // Terrible stopgap fix for FLUID-5279 - all of this implementation will be swept away
            // model relay may cause this to be called during init, and we have no proper definition for "that.renderer" since it is
            // constructed in a terrible way
            that.renderOnInit = true;
            return;
        } else {
            fluid.renderer.clearDecorators(that);
            that.events.prepareModelForRender.fire(that.model, that.applier, that);
            var tree = that.produceTree(that);
            var rendererFnOptions = that.renderer.rendererFnOptions;
            // Terrible stopgap fix for FLUID-5821 - given that model reference may be rebound, generate the expander from scratch on every render
            if (!rendererFnOptions.noexpand) {
                var expander = fluid.protoExpanderForComponent(that, rendererFnOptions);
                tree = expander(tree);
            }
            that.events.onRenderTree.fire(that, tree);
            that.renderer.render(tree);
            that.events.afterRender.fire(that);
        }
    };

    fluid.rendererComponent.produceTree = function (that) {
        var produceTreeOption = that.options.produceTree;
        return produceTreeOption ?
            (typeof(produceTreeOption) === "string" ? fluid.getGlobalValue(produceTreeOption) : produceTreeOption) (that) :
            that.options.protoTree;
    };

    fluid.initRendererComponent = function (componentName, container, options) {
        var that = fluid.initView(componentName, container, options, {gradeNames: ["fluid.rendererComponent"]});
        fluid.getForComponent(that, "model"); // Force resolution of these due to our terrible workflow
        fluid.getForComponent(that, "applier");
        fluid.diagnoseFailedView(componentName, that, fluid.defaults(componentName), arguments);

        fluid.fetchResources(that.options.resources, that.events.onResourcesFetched.fire); // TODO: deal with asynchrony

        var rendererOptions = fluid.renderer.modeliseOptions(that.options.rendererOptions, null, that);

        var messageResolver;
        if (!rendererOptions.messageSource && that.options.strings) {
            messageResolver = fluid.messageResolver({
                messageBase: that.options.strings,
                resolveFunc: that.options.messageResolverFunction,
                parents: fluid.makeArray(that.options.parentBundle)
            });
            rendererOptions.messageSource = {type: "resolver", resolver: messageResolver};
        }
        fluid.renderer.reverseMerge(rendererOptions, that.options, ["resolverGetConfig", "resolverSetConfig"]);
        that.rendererOptions = rendererOptions;

        var rendererFnOptions = $.extend({}, that.options.rendererFnOptions, {
            rendererOptions: rendererOptions,
            repeatingSelectors: that.options.repeatingSelectors,
            selectorsToIgnore: that.options.selectorsToIgnore,
            expanderOptions: {
                envAdd: {styles: that.options.styles}
            }
        });

        if (that.options.resources && that.options.resources.template) {
            rendererFnOptions.templateSource = function () { // TODO: don't obliterate, multitemplates, etc.
                return that.options.resources.template.resourceText;
            };
        }

        fluid.renderer.reverseMerge(rendererFnOptions, that.options, ["resolverGetConfig", "resolverSetConfig"]);
        if (rendererFnOptions.rendererTargetSelector) {
            container = function () {return that.dom.locate(rendererFnOptions.rendererTargetSelector); };
        }
        var renderer = {
            fossils: {},
            rendererFnOptions: rendererFnOptions,
            boundPathForNode: function (node) {
                return fluid.boundPathForNode(node, renderer.fossils);
            }
        };

        var rendererSub = fluid.renderer.createRendererSubcomponent(container, that.options.selectors, rendererFnOptions, that, renderer.fossils);
        that.renderer = $.extend(renderer, rendererSub);

        if (messageResolver) {
            that.messageResolver = messageResolver;
        }
        renderer.refreshView = fluid.getForComponent(that, "refreshView"); // Stopgap implementation for FLUID-4334

        return that;
    };

    var removeSelectors = function (selectors, selectorsToIgnore) {
        fluid.each(fluid.makeArray(selectorsToIgnore), function (selectorToIgnore) {
            delete selectors[selectorToIgnore];
        });
        return selectors;
    };

    var markRepeated = function (selectorKey, repeatingSelectors) {
        if (repeatingSelectors) {
            fluid.each(repeatingSelectors, function (repeatingSelector) {
                if (selectorKey === repeatingSelector) {
                    selectorKey = selectorKey + ":";
                }
            });
        }
        return selectorKey;
    };

    fluid.renderer.selectorsToCutpoints = function (selectors, options) {
        var togo = [];
        options = options || {};
        selectors = fluid.copy(selectors); // Make a copy before potentially destructively changing someone's selectors.

        if (options.selectorsToIgnore) {
            selectors = removeSelectors(selectors, options.selectorsToIgnore);
        }

        for (var selectorKey in selectors) {
            togo.push({
                id: markRepeated(selectorKey, options.repeatingSelectors),
                selector: selectors[selectorKey]
            });
        }

        return togo;
    };

    /** END of "Renderer Components" infrastructure **/

    fluid.renderer.NO_COMPONENT = {};

    /* A special "shallow copy" operation suitable for nondestructively
     * merging trees of components. jQuery.extend in shallow mode will
     * neglect null valued properties.
     * This function is unsupported: It is not really intended for use by implementors.
     */
    fluid.renderer.mergeComponents = function (target, source) {
        for (var key in source) {
            target[key] = source[key];
        }
        return target;
    };

    fluid.registerNamespace("fluid.renderer.selection");

    /** Definition of expanders - firstly, "heavy" expanders **/

    fluid.renderer.selection.inputs = function (options, container, key, config) {
        fluid.expect("Selection to inputs expander", options, ["selectID", "inputID", "labelID", "rowID"]);
        var selection = config.expander(options.tree);
        // Remove the tree from option expansion as this is handled above, and
        // the tree may have strings with similar syntax to IoC references.
        var optsToExpand = fluid.censorKeys(options, ["tree"]);
        var expandedOpts = config.expandLight(optsToExpand);
        var rows = fluid.transform(selection.optionlist.value, function (option, index) {
            var togo = {};
            var element =  {parentRelativeID: "..::" + expandedOpts.selectID, choiceindex: index};
            togo[expandedOpts.inputID] = element;
            togo[expandedOpts.labelID] = fluid.copy(element);
            return togo;
        });
        var togo = {}; // TODO: JICO needs to support "quoted literal key initialisers" :P
        togo[expandedOpts.selectID] = selection;
        togo[expandedOpts.rowID] = {children: rows};
        togo = config.expander(togo);
        return togo;
    };

    fluid.renderer.repeat = function (options, container, key, config) {
        fluid.expect("Repetition expander", options, ["controlledBy", "tree"]);
        var env = config.threadLocal();
        var path = fluid.extractContextualPath(options.controlledBy, {ELstyle: "ALL"}, env);
        var list = fluid.get(config.model, path, config.resolverGetConfig);

        var togo = {};
        if (!list || list.length === 0) {
            return options.ifEmpty ? config.expander(options.ifEmpty) : togo;
        }
        var expanded = [];
        fluid.each(list, function (element, i) {
            var EL = fluid.model.composePath(path, i);
            var envAdd = {};
            if (options.pathAs) {
                envAdd[options.pathAs] = "${" + EL + "}";
            }
            if (options.valueAs) {
                envAdd[options.valueAs] = fluid.get(config.model, EL, config.resolverGetConfig);
            }
            var expandrow = fluid.withEnvironment(envAdd, function () {
                return config.expander(options.tree);
            }, env);
            if (fluid.isArrayable(expandrow)) {
                if (expandrow.length > 0) {
                    expanded.push({children: expandrow});
                }
            }
            else if (expandrow !== fluid.renderer.NO_COMPONENT) {
                expanded.push(expandrow);
            }
        });
        var repeatID = options.repeatID;
        if (repeatID.indexOf(":") === -1) {
            repeatID = repeatID + ":";
        }
        fluid.each(expanded, function (entry) {entry.ID = repeatID; });
        return expanded;
    };

    fluid.renderer.condition = function (options, container, key, config) {
        fluid.expect("Selection to condition expander", options, ["condition"]);
        var condition;
        if (options.condition.funcName) {
            var args = config.expandLight(options.condition.args);
            condition = fluid.invokeGlobalFunction(options.condition.funcName, args);
        } else if (options.condition.expander) {
            condition = config.expander(options.condition);
        } else {
            condition = config.expandLight(options.condition);
        }
        var tree = (condition ? options.trueTree : options.falseTree);
        if (!tree) {
            tree = fluid.renderer.NO_COMPONENT;
        }
        return config.expander(tree);
    };


    /* An EL extraction utility suitable for context expressions which occur in
     * expanding component trees. It dispatches context expressions to fluid.transformContextPath
     * in order to resolve them against EL references stored in the direct environment, and hence
     * to the "true (direct) model" - however, if there is no entry in the direct environment, it will resort to the "externalFetcher".
     * It satisfies a similar contract as fluid.extractEL, in that it will either return
     * an EL path, or undefined if the string value supplied cannot be interpreted
     * as an EL path with respect to the supplied options - it may also return {value: value}
     * in the case the context can be resolved by the supplied "externalFetcher" (required for FLUID-4986)
     */
    // unsupported, non-API function
    fluid.extractContextualPath = function (string, options, env, externalFetcher) {
        var parsed = fluid.extractELWithContext(string, options);
        if (parsed) {
            if (parsed.context) {
                return env[parsed.context] ? fluid.transformContextPath(parsed, env).path : {value: externalFetcher(parsed)};
            }
            else {
                return parsed.path;
            }
        }
    };

    // unsupported, non-API function
    fluid.transformContextPath = function (parsed, env) {
        if (parsed.context) {
            var fetched = env[parsed.context];
            var EL;
            if (typeof(fetched) === "string") {
                EL = fluid.extractEL(fetched, {ELstyle: "${}"});
            }
            if (EL) {
                return {
                    noDereference: parsed.path === "",
                    path: fluid.model.composePath(EL, parsed.path)
                };
            }
        }
        return parsed;
    };

    // A forgiving variation of "makeStackFetcher" that returns nothing on failing to resolve an IoC reference,
    // in keeping with current protoComponent semantics. Note to self: abolish protoComponents
    fluid.renderer.makeExternalFetcher = function (contextThat) {
        return function (parsed) {
            var foundComponent = fluid.resolveContext(parsed.context, contextThat);
            return foundComponent ? fluid.getForComponent(foundComponent, parsed.path) : undefined;
        };
    };

    /*
     * Create a "protoComponent expander" with the supplied set of options.
     * The returned value will be a function which accepts a "protoComponent tree"
     * as argument, and returns a "fully expanded" tree suitable for supplying
     * directly to the renderer.
     * A "protoComponent tree" is similar to the "dehydrated form" accepted by
     * the historical renderer - only
     * i) The input format is unambiguous - this expander will NOT accept hydrated
     * components in the {ID: "myId, myfield: "myvalue"} form - but ONLY in
     * the dehydrated {myID: {myfield: myvalue}} form.
     * ii) This expander has considerably greater power to expand condensed trees.
     * In particular, an "EL style" option can be supplied which will expand bare
     * strings found as values in the tree into UIBound components by a configurable
     * strategy. Supported values for "ELstyle" are a) "ALL" - every string will be
     * interpreted as an EL reference and assigned to the "valuebinding" member of
     * the UIBound, or b) any single character, which if it appears as the first
     * character of the string, will mark it out as an EL reference - otherwise it
     * will be considered a literal value, or c) the value "${}" which will be
     * recognised bracketing any other EL expression.
     */

    fluid.renderer.makeProtoExpander = function (expandOptions, parentThat) {
        // shallow copy of options - cheaply avoid destroying model, and all others are primitive
        var options = $.extend({
            ELstyle: "${}"
        }, expandOptions); // shallow copy of options
        if (parentThat) {
            options.externalFetcher = fluid.renderer.makeExternalFetcher(parentThat);
        }
        var threadLocal; // rebound on every expansion at entry point

        function fetchEL(string) {
            var env = threadLocal();
            return fluid.extractContextualPath(string, options, env, options.externalFetcher);
        }

        var IDescape = options.IDescape || "\\";

        var expandLight = function (source) {
            return fluid.expand(source, options);
        };

        var expandBound = function (value, concrete) {
            if (value.messagekey !== undefined) {
                return {
                    componentType: "UIMessage",
                    messagekey: expandBound(value.messagekey),
                    args: expandLight(value.args)
                };
            }
            var proto;
            if (!fluid.isPrimitive(value) && !fluid.isArrayable(value)) {
                proto = $.extend({}, value);
                if (proto.decorators) {
                    proto.decorators = expandLight(proto.decorators);
                }
                value = proto.value;
                delete proto.value;
            } else {
                proto = {};
            }
            var EL;
            if (typeof(value) === "string") {
                var fetched = fetchEL(value);
                EL = typeof(fetched) === "string" ? fetched : null;
                value = fluid.get(fetched, "value") || value;
            }
            if (EL) {
                proto.valuebinding = EL;
            } else if (value !== undefined) {
                proto.value = value;
            }
            if (options.model && proto.valuebinding && proto.value === undefined) {
                proto.value = fluid.get(options.model, proto.valuebinding, options.resolverGetConfig);
            }
            if (concrete) {
                proto.componentType = "UIBound";
            }
            return proto;
        };

        options.filter = fluid.expander.lightFilter;

        var expandCond;
        var expandLeafOrCond;

        var expandEntry = function (entry) {
            var comp = [];
            expandCond(entry, comp);
            return {children: comp};
        };

        var expandExternal = function (entry) {
            if (entry === fluid.renderer.NO_COMPONENT) {
                return entry;
            }
            var singleTarget;
            var target = [];
            var pusher = function (comp) {
                singleTarget = comp;
            };
            expandLeafOrCond(entry, target, pusher);
            return singleTarget || target;
        };

        var expandConfig = {
            model: options.model,
            resolverGetConfig: options.resolverGetConfig,
            resolverSetConfig: options.resolverSetConfig,
            expander: expandExternal,
            expandLight: expandLight
            //threadLocal: threadLocal
        };

        var expandLeaf = function (leaf, componentType) {
            var togo = {componentType: componentType};
            var map = fluid.renderer.boundMap[componentType] || {};
            for (var key in leaf) {
                if (/decorators|args/.test(key)) {
                    togo[key] = expandLight(leaf[key]);
                    continue;
                } else if (map[key]) {
                    togo[key] = expandBound(leaf[key]);
                } else {
                    togo[key] = leaf[key];
                }
            }
            return togo;
        };

        // A child entry may be a cond, a leaf, or another "thing with children".
        // Unlike the case with a cond's contents, these must be homogeneous - at least
        // they may either be ALL leaves, or else ALL cond/childed etc.
        // In all of these cases, the key will be THE PARENT'S KEY
        var expandChildren = function (entry, pusher) {
            var children = entry.children;
            for (var i = 0; i < children.length; ++i) {
                // each child in this list will lead to a WHOLE FORKED set of children.
                var target = [];
                var comp = { children: target};

                var child = children[i];
                // This use of function creation within a loop is acceptable since
                // the function does not attempt to close directly over the loop counter
                var childPusher = function (comp) { // eslint-disable-line no-loop-func
                    target[target.length] = comp;
                };

                expandLeafOrCond(child, target, childPusher);
                // Rescue the case of an expanded leaf into single component - TODO: check what sense this makes of the grammar
                if (comp.children.length === 1 && !comp.children[0].ID) {
                    comp = comp.children[0];
                }
                pusher(comp);
            }
        };

        function detectBareBound(entry) {
            return fluid.find(entry, function (value, key) {
                return key === "decorators";
            }) !== false;
        }

        // We have reached something which is either a leaf or Cond - either inside
        // a Cond or as an entry in children.
        expandLeafOrCond = function (entry, target, pusher) {
            var componentType = fluid.renderer.inferComponentType(entry);
            if (!componentType && (fluid.isPrimitive(entry) || detectBareBound(entry))) {
                componentType = "UIBound";
            }
            if (componentType) {
                pusher(componentType === "UIBound" ? expandBound(entry, true) : expandLeaf(entry, componentType));
            } else {
                // we couldn't recognise it as a leaf, so it must be a cond
                // this may be illegal if we are already in a cond.
                if (!target) {
                    fluid.fail("Illegal cond->cond transition");
                }
                expandCond(entry, target);
            }
        };

        // cond entry may be a leaf, "thing with children" or a "direct bound".
        // a Cond can ONLY occur as a direct member of "children". Each "cond" entry may
        // give rise to one or many elements with the SAME key - if "expandSingle" discovers
        // "thing with children" they will all share the same key found in proto.
        expandCond = function (proto, target) {
            var key;
            var expandToTarget = function (expander) {
                var expanded = fluid.invokeGlobalFunction(expander.type, [expander, proto, key, expandConfig]);
                if (expanded !== fluid.renderer.NO_COMPONENT) {
                    fluid.each(expanded, function (el) {target[target.length] = el; });
                }
            };
            var condPusher = function (comp) {
                comp.ID = key;
                target[target.length] = comp;
            };
            for (key in proto) {
                var entry = proto[key];
                if (key.charAt(0) === IDescape) {
                    key = key.substring(1);
                }
                if (key === "expander") {
                    var expanders = fluid.makeArray(entry);
                    fluid.each(expanders, expandToTarget);
                } else if (entry) {
                    if (entry.children) {
                        if (key.indexOf(":") === -1) {
                            key = key + ":";
                        }
                        expandChildren(entry, condPusher);
                    } else if (fluid.renderer.isBoundPrimitive(entry)) {
                        condPusher(expandBound(entry, true));
                    } else {
                        expandLeafOrCond(entry, null, condPusher);
                    }
                }
            }

        };

        return function (entry) {
            threadLocal = fluid.threadLocal(function () {
                return $.extend({}, options.envAdd);
            });
            options.fetcher = fluid.makeEnvironmentFetcher(options.model, fluid.transformContextPath, threadLocal, options.externalFetcher);
            expandConfig.threadLocal = threadLocal;
            return expandEntry(entry);
        };
    };

})(jQuery, fluid_3_0_0);
