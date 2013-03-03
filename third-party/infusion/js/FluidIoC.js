/*
Copyright 2011-2013 OCAD University
Copyright 2010-2011 Lucendo Development Ltd.

Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.

You may obtain a copy of the ECL 2.0 License and BSD License at
https://github.com/fluid-project/infusion/raw/master/Infusion-LICENSE.txt
*/

// Declare dependencies
/*global fluid_1_5:true, jQuery*/

// JSLint options 
/*jslint white: true, funcinvoke: true, continue: true, elsecatch: true, operator: true, jslintok:true, undef: true, newcap: true, regexp: true, bitwise: true, browser: true, forin: true, maxerr: 100, indent: 4 */

var fluid_1_5 = fluid_1_5 || {};

(function ($, fluid) {

    /** The Fluid "IoC System proper" - resolution of references and 
     * completely automated instantiation of declaratively defined
     * component trees */ 
    
    fluid.inCreationMarker = {"__CURRENTLY_IN_CREATION__": true};
    
    // unsupported, non-API function
    // Currently still uses manual traversal - once we ban manually instantiated components,
    // it will use the instantiator's records instead.
    fluid.visitComponentChildren = function (that, visitor, options, path) {
        var instantiator = fluid.getInstantiator(that);
        for (var name in that) {
            var newPath = instantiator.composePath(path, name);
            var component = that[name];
            //Every component *should* have an id, but some clients may not yet be compliant
            //if (component && component.typeName && !component.id) {
            //    fluid.fail("No id");
            //}
            if (!component || !component.typeName || (component.id && options.visited && options.visited[component.id])) {continue; }
            if (options.visited) {
                options.visited[component.id] = true;
            }
            if (visitor(component, name, newPath, path)) {
                return true;
            }
            if (!options.flat) {
                fluid.visitComponentChildren(component, visitor, options, newPath);
            }
        }
    };
    
    // unsupported, non-API function
    fluid.getMemberNames = function (instantiator, thatStack) {
        var path = instantiator.idToPath(thatStack[thatStack.length - 1].id);
        var segs = fluid.model.parseEL(path);
        segs.unshift.apply(segs, fluid.generate(thatStack.length - segs.length, ""));
        return segs;
    };
    
    // thatStack contains an increasing list of MORE SPECIFIC thats.
    // this visits all components starting from the current location (end of stack)
    // in visibility order up the tree.
    var visitComponents = function (instantiator, thatStack, visitor, options) {
        options = options || {
            visited: {},
            flat: true,
            instantiator: instantiator
        };
        var memberNames = fluid.getMemberNames(instantiator, thatStack);
        for (var i = thatStack.length - 1; i >= 0; --i) {
            var that = thatStack[i];
            if (that.typeName) {
                options.visited[that.id] = true;
                var path = instantiator.idToPath[that.id];
                if (visitor(that, memberNames[i], path)) {
                    return;
                }
            }
            if (fluid.visitComponentChildren(that, visitor, options, path)) {
                return;
            }
        }
    };
    
    fluid.mountStrategy = function (prefix, root, toMount, targetPrefix) {
        var offset = prefix.length;
        return function (target, name, i, segs) {
            if (i <= prefix.length) { // Avoid OOB to not trigger deoptimisation!
                return;
            }
            for (var j = 0; j < prefix.length; ++ j) {
                if (segs[j] !== prefix[j]) {
                    return;
                }
            }
            return toMount(target, name, i - prefix.length, segs.slice(offset));
        }
    };
    
    // unsupported, NON-API function    
    fluid.invokerFromRecord = function (invokerec, name, that) {
        var funcName = typeof(invokerec) === "string" ? invokerec : null;
        fluid.pushActivity("makeInvoker", "beginning instantiation of invoker with name %name and record %record as child of %that", 
            {name: name, record: invokerec, that: that});
        var invoker = fluid.makeInvoker(that, funcName? null : invokerec, funcName);
        fluid.popActivity();
        return invoker;
    };

    // unsupported, NON-API function    
    fluid.memberFromRecord = function (memberrec, name, that) {
        var value = fluid.expandOptions(memberrec, that);
        return value;
    };

    // unsupported, NON-API function    
    fluid.recordStrategy = function (that, options, optionsStrategy, recordPath, recordMaker, prefix) {
        prefix = prefix || [];
        return {
            strategy: function (target, name, i, segs) {
                if (i != 1) {
                    return;
                }
                var record = fluid.driveStrategy(options, [recordPath, name], optionsStrategy);
                if (record === undefined) {
                   return;
                }
                var member = recordMaker(record, name, that);
                fluid.set(target, ([name]), member);
                return member;
            },
            initter: function () {
                var records = fluid.driveStrategy(options, recordPath, optionsStrategy) || {};
                for (var name in records) {
                    fluid.getForComponent(that, prefix.concat([name]));
                }
            }
        };
    };
    
    // patch Fluid.js version for timing
    // unsupported, NON-API function
    fluid.instantiateFirers = function (that, options) {
        var shadow = fluid.shadowForComponent(that);
        var initter = fluid.get(shadow, ["eventStrategyBlock", "initter"]) || fluid.identity;
        initter();
    };

    // unsupported, NON-API function
    fluid.makeDistributionRecord = function (sourceRecord, sourcePath, targetPath, exclusions, offset) {
        offset = offset || 0;

        var source = fluid.copy(fluid.get(sourceRecord, sourcePath));
        fluid.each(exclusions, function (exclusion) {
            fluid.model.applyChangeRequest(source, {path: exclusion, type: "DELETE"});
        });

        var options = {};        
        fluid.model.applyChangeRequest(options, {path: targetPath, type: "ADD", value: source});
        return {options: options, recordType: "distribution", priority: fluid.mergeRecordTypes.distribution + offset};
    };

    // unsupported, NON-API function    
    fluid.filterBlocks = function (sourceBlocks, sourcePath, targetPath, exclusions) {
        var togo = [], offset = 0;
        fluid.each(sourceBlocks, function (block) {
            var source = fluid.get(block.source, sourcePath);
            if (source) {
                togo.push(fluid.makeDistributionRecord(block.source, sourcePath, targetPath, exclusions, offset++));
                var rescued = $.extend({}, source);
                fluid.model.applyChangeRequest(block.source, {path: sourcePath, type: "DELETE"});
                fluid.each(exclusions, function (exclusion) {
                    var orig = fluid.get(rescued, exclusion);
                    fluid.set(block.source, sourcePath.concat(exclusion), orig);
                });
            }
        });
        return togo; 
    };
    
    // unsupported, NON-API function    
    fluid.matchIoCSelector = function (selector, thatStack, shadows, memberNames, i) {
        var thatpos = thatStack.length - 1;
        var selpos = selector.length - 1;
        while (true) {
            var mustMatchHere = thatpos === thatStack.length - 1 || selector[selpos].child;
            
            var that = thatStack[thatpos];  
            var selel = selector[selpos];
            var match = true;
            for (var j = 0; j < selel.predList.length; ++j) {
                var pred = selel.predList[j];
                if (pred.context && !(shadows[thatpos].contextHash[pred.context] || memberNames[thatpos] === pred.context)) {
                    match = false;
                    break;
                }
                if (pred.id && that.id !== pred.id) {
                    match = false;
                    break;
                }
            }
            if (match) {
                if (selpos === 0) {
                    return true;
                }
                --thatpos;
                --selpos;
            }
            if (!match) {
                if (mustMatchHere) {
                    return false;
                }
                else {
                    --thatpos;
                }
            }
            if (thatpos < i) {
                return false;
            }
        }
    };
    
    // unsupported, NON-API function
    fluid.pushDistributions = function (distributedBlocks, distribution, thatStack, shadows, memberNames, i) {
        if (fluid.matchIoCSelector(distribution.selector, thatStack, shadows, memberNames, i)) {
            distributedBlocks.push.apply(distributedBlocks, distribution.blocks);
        }
    };

    // unsupported, NON-API function 
    fluid.receiveDistributions = function (that) {
        var instantiator = fluid.getInstantiator(that);
        var thatStack = instantiator.getThatStack(that); // most specific is at end
        var memberNames = fluid.getMemberNames(instantiator, thatStack);
        var distributedBlocks = [];
        var shadows = fluid.transform(thatStack, function (thisThat) {
            return instantiator.idToShadow[thisThat.id];  
        });
        for (var i = 0; i < thatStack.length; ++ i) {
            var thisThat = thatStack[i];
            fluid.each(shadows[i].distributions, function (distribution) {
                fluid.pushDistributions(distributedBlocks, distribution, thatStack, shadows, memberNames, i);
            });
        }
        fluid.applyDistributions(that, distributedBlocks, shadow);
    };

    // unsupported, NON-API function 
    fluid.applyDistributions = function (that, preBlocks, targetShadow) {
        var distributedBlocks = fluid.transform(preBlocks, function (preBlock) {
            return fluid.generateExpandBlock(preBlock, that, targetShadow.mergePolicy);
        });
        var mergeOptions = targetShadow.mergeOptions;
        mergeOptions.mergeBlocks.push.apply(mergeOptions.mergeBlocks, distributedBlocks);
        mergeOptions.updateBlocks();  
    };

    // unsupported, NON-API function
    fluid.parseExpectedOptionsPath = function (path, role) {
        var segs = fluid.model.parseEL(path);
        if (segs.length > 1 && segs[0] !== "options") {
                fluid.fail("Error in options distribution record ", record, " - only " + role + " paths beginning with \"options\" are supported");
        }
        return segs.slice(1);  
    };

    fluid.undistributableOptions = ["gradeNames", "distributeOptions", "argumentMap", "initFunction", "mergePolicy", "progressiveCheckerOptions"]; // automatically added to "exclusions" of every distribution

    // unsupported, NON-API function    
    fluid.distributeOptions = function (that, optionsStrategy) {
        var records = fluid.makeArray(fluid.driveStrategy(that.options, "distributeOptions", optionsStrategy));
        fluid.each(records, function (record) {
            var targetRef = fluid.parseContextReference(record.target);
            var targetComp, selector;
            if (targetRef.context.indexOf(" ") !== -1) { // simple-minded check for an IoCSS reference
                selector = fluid.parseSelector(targetRef.context, fluid.IoCSSMatcher)
                var head = selector[0].predList;
                if (head.length !== 1 || head[0].context !== "that") {
                    fluid.fail("Downwards options distribution not supported from component other than \"that\"");
                }
                head.length = 0;
                targetComp = that;
            }
            else {
                targetComp = fluid.resolveContext(targetRef.context, that);
                if (!targetComp) {
                    fluid.fail("Error in options distribution record ", record, " - could not resolve context selector {"+targetRef.context+"} to a root component");
                }
            }
            var segs = fluid.parseExpectedOptionsPath(targetRef.path, "target");
            var preBlocks;
            if (record.record) {
                preBlocks = [(fluid.makeDistributionRecord(record.record, [], segs, [], 0))];
            }
            else {
                var thatShadow = fluid.shadowForComponent(that);
                var source = fluid.parseContextReference(record.source || "{that}.options");
                if (source.context !== "that") {
                    fluid.fail("Error in options distribution record ", record, " only a context of {that} is supported");
                }
                var sourcePath = fluid.parseExpectedOptionsPath(source.path, "source");
                var fullExclusions = record.exclusions.concat(sourcePath.length === 0 ? fluid.undistributableOptions : []); 
                
                var exclusions = fluid.transform(fullExclusions, function (exclusion) {
                    return fluid.model.parseEL(exclusion);  
                });
                
                preBlocks = fluid.filterBlocks(thatShadow.mergeOptions.mergeBlocks, sourcePath, segs, exclusions);
                thatShadow.mergeOptions.updateBlocks(); // perhaps unnecessary
            }
            // TODO: inline material has to be expanded in its original context!
            var targetShadow = fluid.shadowForComponent(targetComp);
            if (selector) {
                var distributions = (targetShadow.distributions = targetShadow.distributions || []);
                distributions.push({
                    selector: selector,
                    blocks: preBlocks
                });
            }
            else {
                fluid.applyDistributions(that, preBlocks, targetShadow);
            }
        });
    };
    // First sequence point where the mergeOptions strategy is delivered from Fluid.js - here we take care
    // of both receiving and transmitting options distributions
    // unsupported, NON-API function
    fluid.deliverOptionsStrategy = function (that, target, mergeOptions) {
        var shadow = fluid.shadowForComponent(that);
        var contextHash = {};
        fluid.each(that.options.gradeNames, function (gradeName) {
            contextHash[gradeName] = true;
            contextHash[fluid.computeNickName(gradeName)] = true;  
        });
        contextHash[that.nickName] = true;
        shadow.contextHash = contextHash;
        shadow.mergeOptions = mergeOptions;

        fluid.distributeOptions(that, mergeOptions.strategy);
        fluid.receiveDistributions(that);
    };
    
    // Second sequence point for mergeOptions from Fluid.js - here we construct all further
    // strategies required on the IoC side and mount them into the shadow's getConfig for universal use
    // unsupported, NON-API function
    fluid.computeComponentAccessor = function (that) {
        var shadow = fluid.shadowForComponent(that);
        var options = that.options;
        var strategy = shadow.mergeOptions.strategy;
        var optionsStrategy = fluid.mountStrategy(["options"], options, strategy);
        shadow.invokerStrategy = fluid.recordStrategy(that, options, strategy, "invokers", fluid.invokerFromRecord);
        shadow.eventStrategyBlock = fluid.recordStrategy(that, options, strategy, "events", fluid.eventFromRecord, ["events"]);
        var eventStrategy = fluid.mountStrategy(["events"], that, shadow.eventStrategyBlock.strategy, ["events"]);
        shadow.memberStrategy = fluid.recordStrategy(that, options, strategy, "members", fluid.memberFromRecord);
        
        // NB - ginger strategy handles concrete, rationalise
        shadow.getConfig = {strategies: [fluid.model.funcResolverStrategy, fluid.makeGingerStrategy(that), 
            optionsStrategy, shadow.invokerStrategy.strategy, shadow.memberStrategy.strategy, eventStrategy]};
        return shadow.getConfig;
    };
    
    fluid.shadowForComponent = function (component) {
        var instantiator = fluid.getInstantiator(component);
        return shadow = instantiator && component ? instantiator.idToShadow[component.id] : null;      
    };
    
    fluid.getForComponent = function (component, path) {
        var shadow = fluid.shadowForComponent(component);
        var getConfig = shadow ? shadow.getConfig : undefined;
        return fluid.get(component, path, getConfig);
    };
    
    // An EL segment resolver strategy that will attempt to trigger creation of
    // components that it discovers along the EL path, if they have been defined but not yet
    // constructed.
    // unsupported, NON-API function
    fluid.makeGingerStrategy = function (that) {
        var instantiator = fluid.getInstantiator(that);
        return function (component, thisSeg, index) {
            var atval = component[thisSeg];
            if (index > 1) {
                return atval;
            }
            if (atval === undefined) { // pick up components in instantiation here - we can cut this branch by attaching early
                var parentPath = instantiator.idToShadow[component.id].path;
                var childPath = fluid.composePath(parentPath, thisSeg);
                atval = instantiator.pathToComponent[childPath];
            }
            if (atval === undefined) {
                // TODO: This check is very expensive - once gingerness is stable, we ought to be able to 
                // eagerly compute and cache the value of options.components - check is also incorrect and will miss injections
                if (fluid.getForComponent(component, ["options", "components", thisSeg])) {
                    fluid.initDependent(component, thisSeg);
                    atval = component[thisSeg];
                }
            }
            return atval;
        };
    };
    
    // unsupported, non-API function
    fluid.dumpThat = function (that) {
        return "{ typeName: \"" + that.typeName + "\" id: " + that.id + "}";
    };
    
    // unsupported, non-API function
    fluid.dumpThatStack = function (thatStack, instantiator) {
        var togo = fluid.transform(thatStack, function(that) {
            var path = instantiator.idToPath(that.id);
            return fluid.dumpThat(that) + (path? (" - path: " + path) : "");
        });
        return togo.join("\n");
    };

    var localRecordExpected = /arguments|options|container/;

    // unsupported, NON-API function    
    fluid.resolveContext = function (context, that) {
        var instantiator = fluid.getInstantiator(that);
        if (context === "instantiator") {
            return instantiator;
        }
        else if (context === "that") {
            return that; 
        }
        var foundComponent;
        var thatStack = instantiator.getFullStack(that);
        visitComponents(instantiator, thatStack, function (component, name) {
            var shadow = fluid.shadowForComponent(component);
            // TODO: Some components, e.g. the static environment and typeTags do not have a shadow, which slows us down here 
            if (context === name || shadow && shadow.contextHash && shadow.contextHash[context] || context === component.typeName || context === component.nickName) {
                foundComponent = component;
                return true; // YOUR VISIT IS AT AN END!!
            }
            if (fluid.getForComponent(component, ["options", "components", context, "type"]) && !component[context]) {
  // This is an expensive guess since we make it for every component up the stack - must apply the WAVE OF EXPLOSION to discover all components first
  // This line attempts a hopeful construction of components that could be guessed by nickname through finding them unconstructed
  // in options. In the near future we should eagerly BEGIN the process of constructing components, discovering their
  // types and then attaching them to the tree VERY EARLY so that we get consistent results from different strategies.
                foundComponent = fluid.getForComponent(component, context);
                return true;
            }
        });
        return foundComponent;
    };
    
    // unsupported, NON-API function
    fluid.makeStackFetcher = function (parentThat, localRecord) {
        var fetcher = function (parsed) {
            var context = parsed.context;
            if (localRecord && localRecordExpected.test(context)) {
                var fetched = fluid.get(localRecord[context], parsed.path);
                return context === "arguments" ? fetched : {
                    marker: context === "options" ? fluid.EXPAND : fluid.EXPAND_NOW,
                    value: fetched
                };
            }
            var foundComponent = fluid.resolveContext(context, parentThat);
            if (!foundComponent && parsed.path !== "") {
                var ref = fluid.renderContextReference(parsed);
                fluid.fail("Failed to resolve reference " + ref + " - could not match context with name " 
                    + context + " from component leaf ", parentThat);
            }
            return fluid.getForComponent(foundComponent, parsed.path);
        };
        return fetcher;
    };

    // unsupported, NON-API function     
    fluid.makeStackResolverOptions = function (parentThat, localRecord) {
        return $.extend(fluid.copy(fluid.defaults("fluid.makeExpandOptions")), {
            fetcher: fluid.makeStackFetcher(parentThat, localRecord),
            contextThat: parentThat
        }); 
    };
    
    // unsupported, non-API function
    fluid.clearListeners = function (shadow) {
        fluid.each(shadow.listeners, function (rec) {
            rec.event.removeListener(rec.listener);  
        });
        delete shadow.listeners;
    };
    
    var idToInstantiator = {};
    
    // unsupported, non-API function - however, this structure is of considerable interest to those debugging
    // into IoC issues. The structures idToShadow and pathToComponent contain a complete map of the component tree
    // forming the surrounding scope
    fluid.instantiator = function (freeInstantiator) {
        var that = {
            nickName: "instantiator",
            pathToComponent: {},
            idToShadow: {},
            composePath: fluid.composePath // For speed, we declare that no component's name may contain a period
        };
        // We frequently get requests for components not in this instantiator - e.g. from the dynamicEnvironment or manually created ones
        that.idToPath = function (id) {
            var shadow = that.idToShadow[id];
            return shadow ? shadow.path : "";
        }
        that.recordListener = function (event, listener, source) {
            var shadow = that.idToShadow[source.id];
            var listeners = shadow.listeners;
            if (!listeners) {
                listeners = shadow.listeners = [];
            }
            listeners.push({event: event, listener: listener});
        };
        that.getThatStack = function (component) {
            var shadow = that.idToShadow[component.id];
            if (shadow) {
                var path = shadow.path;
                var parsed = fluid.model.parseEL(path);
                var togo = fluid.transform(parsed, function (value, i) {
                    var parentPath = fluid.model.composeSegments.apply(null, parsed.slice(0, i + 1));
                    return that.pathToComponent[parentPath];
                });
                var root = that.pathToComponent[""];
                if (root) {
                    togo.unshift(root);
                }
                return togo;
            }
            else return [component];
        };
        that.getEnvironmentalStack = function () {
            var togo = [fluid.staticEnvironment];
            if (!freeInstantiator) {
                togo.push(fluid.globalThreadLocal());
            }
            return togo;
        };
        that.getFullStack = function (component) {
            var thatStack = component? that.getThatStack(component) : [];
            return that.getEnvironmentalStack().concat(thatStack);
        };
        function recordComponent(component, path, created) {
            if (created) {
                idToInstantiator[component.id] = that;
                var shadow = that.idToShadow[component.id] = {};
                shadow.path = path;
            }
            if (that.pathToComponent[path]) {
                fluid.fail("Error during instantiation - path " + path + " which has just created component " + fluid.dumpThat(component) 
                    + " has already been used for component " + fluid.dumpThat(that.pathToComponent[path]) + " - this is a circular instantiation or other oversight."
                    + " Please clear the component using instantiator.clearComponent() before reusing the path.");
            }
            that.pathToComponent[path] = component;
        }
        that.recordRoot = function (component) {
            if (component && component.id && !that.pathToComponent[""]) {
                recordComponent(component, "", true);
            }  
        };
        that.recordKnownComponent = function (parent, component, name, created) {
            var parentPath = that.idToShadow[parent.id].path;
            var path = that.composePath(parentPath, name);
            recordComponent(component, path, created);
        };
        that.clearComponent = function (component, name, child, options, noModTree, path) {
            var record = that.idToShadow[component.id].path;
            // use flat recursion since we want to use our own recursion rather than rely on "visited" records
            options = options || {flat: true, instantiator: that};
            child = child || component[name];
            path = path || record;
            if (path === undefined) {
                fluid.fail("Cannot clear component " + name + " from component ", component, 
                    " which was not created by this instantiator"); 
            }
            fluid.fireEvent(child, "events.onClear", [child, name, component]);

            var childPath = that.composePath(path, name);
            var childRecord = that.idToShadow[child.id];

            // only recurse on components which were created in place - if the id record disagrees with the
            // recurse path, it must have been injected
            if (childRecord && childRecord.path === childPath) {
                fluid.fireEvent(child, "events.onDestroy", [child, name, component]);
                fluid.clearListeners(childRecord);
                fluid.visitComponentChildren(child, function(gchild, gchildname, newPath, parentPath) {
                    that.clearComponent(child, gchildname, null, options, true, parentPath);
                }, options, childPath);
                delete that.idToShadow[child.id];
                delete idToInstantiator[child.id];
            }
            delete that.pathToComponent[childPath]; // there may be no entry - if created informally
            if (!noModTree) {
                delete component[name]; // there may be no entry - if creation is not concluded
            }
        };
        return that;
    };
    
    // An instantiator to be used in the "free environment", unattached to any component tree
    fluid.freeInstantiator = fluid.instantiator(true);
    
    // Look up the globally registered instantiator for a particular component
    fluid.getInstantiator = function (component) {
        return component && idToInstantiator[component.id] || fluid.freeInstantiator;
    };
      
    /** Expand a set of component options either immediately, or with deferred effect.
     *  The current policy is to expand immediately function arguments within fluid.embodyDemands which are not the main options of a 
     *  component. The component's own options take <code>{defer: true}</code> as part of 
     *  <code>outerExpandOptions</code> which produces an "expandOptions" structure holding the "strategy" and "initter" pattern
     *  common to ginger participants.
     *  Probably not to be advertised as part of a public API, but is considerably more stable than most of the rest
     *  of the IoC API structure especially with respect to the first arguments.  
     */

    fluid.expandOptions = function (args, that, mergePolicy, localRecord, outerExpandOptions) {
        if (!args) {
            return args;
        }
        fluid.pushActivity("expandOptions", "expanding options %args for component %that ", {that: that, args: args});
        var expandOptions = fluid.makeStackResolverOptions(that, localRecord);
        expandOptions.mergePolicy = mergePolicy;
        var expanded = outerExpandOptions && outerExpandOptions.defer ? 
            fluid.makeExpandOptions(args, expandOptions) : fluid.expand(args, expandOptions);
        fluid.popActivity();
        return expanded;
    };
    
    // unsupported, non-API function    
    fluid.localRecordExpected = ["type", "options", "args", "mergeOptions", "createOnEvent", "priority"];
    // unsupported, non-API function    
    fluid.checkComponentRecord = function (defaults, localRecord) {
        var expected = fluid.arrayToHash(fluid.localRecordExpected);
        fluid.each(defaults.argumentMap, function(value, key) {
            expected[key] = true;
        });
        fluid.each(localRecord, function (value, key) {
            if (!expected[key]) {
                fluid.fail("Probable error in subcomponent record - key \"" + key + 
                    "\" found, where the only legal options are " + 
                    fluid.keys(expected).join(", "));
            }  
        });
    };

    // unsupported, non-API function    
    fluid.pushDemands = function (list, demands) {
        demands = fluid.makeArray(demands);
        var thisp = fluid.mergeRecordTypes.demands;
        function push(rec) {
            rec.recordType = "demands";
            rec.priority = thisp++;
            list.push(rec);
        }
        // Assume these are sorted at source by intersect count (can't pre-merge if we want "mergeOptions")
        for (var i = 0; i < demands.length; ++ i) {
            var thisd = demands[i];
            if (thisd.options) {
                push(thisd);
            }
            else if (thisd.mergeOptions) {
                var mergeOptions = fluid.makeArray(thisd.mergeOptions);
                fluid.each(mergeOptions, function (record) { push ({options: record}); });
            }
            else {
                fluid.fail("Uninterpretable demands record without options or mergeOptions ", thisd);
            }
        }
    };
    
    // unsupported, non-API function
    fluid.mergeRecordsToList = function (mergeRecords) {
        var list = [];
        fluid.each(mergeRecords, function (value, key) {
            value.recordType = key;
            if (key !== "demands") {
                if (!value.options) return;
                value.priority = fluid.mergeRecordTypes[key];
                if (value.priority === undefined) {
                    fluid.fail("Merge record with unrecognised type " + key + ": ", value); 
                }
                list.push(value);
            }
            else {
                fluid.pushDemands(list, value);
            }
        });
        return list; 
    };

    var addPolicyBuiltins = function (policy) {
        fluid.each(["mergePolicy", "argumentMap", "components", "invokers", "events", "listeners", "distributeOptions", "transformOptions"], function (key) {
            fluid.set(policy, [key, "*", "noexpand"], true);
        });
        return policy;
    };

    // unsupported, NON-API function - used from Fluid.js
    fluid.generateExpandBlock = function (record, that, mergePolicy) {
        var expanded = fluid.expandOptions(record.options, that, mergePolicy, null, {defer: true});
        expanded.priority = record.priority;
        expanded.recordType = record.recordType;
        return expanded;
    };

    var expandComponentOptionsImpl = function (mergePolicy, defaults, userOptions, that) {
        var defaultCopy = fluid.copy(defaults);
        addPolicyBuiltins(mergePolicy);
        var shadow = fluid.shadowForComponent(that);
        shadow.mergePolicy = mergePolicy;
        var mergeRecords = {
            defaults: {options: defaultCopy}
        };
        
        if (userOptions) {
            if (userOptions.marker === fluid.EXPAND) {
                $.extend(mergeRecords, userOptions.mergeRecords);
                // Do this here for gradeless components that were corrected by "localOptions"
                if (mergeRecords.subcomponentRecord) {
                    fluid.checkComponentRecord(defaults, mergeRecords.subcomponentRecord);
                }
            }
            else {
                mergeRecords.user = {options: userOptions};
            }
        }
        var expandList = fluid.mergeRecordsToList(mergeRecords);

        var togo = fluid.transform(expandList, function (value) {
            return fluid.generateExpandBlock(value, that, mergePolicy);
        });
        return togo;
    };

    // unsupported, non-API function
    fluid.expandComponentOptions = function (mergePolicy, defaults, userOptions, that) {
        var instantiator = userOptions && userOptions.marker === fluid.EXPAND && userOptions.memberName !== undefined ? 
            userOptions.instantiator : null;
        var fresh;
        if (!instantiator) {
            instantiator = fluid.instantiator();
            fresh = true;
            fluid.log("Created new instantiator with id " + instantiator.id + " in order to operate on component " + (that? that.typeName : "[none]"));
        }
        fluid.pushActivity("expandComponentOptions", "expanding component options %options with record %record for component %that", 
            {options: userOptions && userOptions.value, record: userOptions, that: that});
        if (fresh) { 
            instantiator.recordRoot(that);
        }
        else {
            instantiator.recordKnownComponent(userOptions.parentThat, that, userOptions.memberName, true);
        }
        var togo = expandComponentOptionsImpl(mergePolicy, defaults, userOptions, that);
        fluid.popActivity();
        return togo;
    };
    
    // unsupported, non-API function
    fluid.argMapToDemands = function (argMap) {
        var togo = [];
        fluid.each(argMap, function (value, key) {
            togo[value] = "{" + key + "}";  
        });
        return togo;
    };
    
    // unsupported, non-API function
    fluid.makePassArgsSpec = function (initArgs) {
        return fluid.transform(initArgs, function(arg, index) {
            return "{arguments}." + index;
        });
    };

    // unsupported, NON-API function    
    fluid.pushDemandSpec = function (record, options, mergeOptions) {
        if (options && options !== "{options}") {
            record.push({options: options});
        }
        else if (mergeOptions) {
            record.push({mergeOptions: mergeOptions});
        }
    };
    
    /** Given a concrete argument list and/or options, determine the final concrete
     * "invocation specification" which is coded by the supplied demandspec in the 
     * environment "thatStack" - the return is a package of concrete global function name
     * and argument list which is suitable to be executed directly by fluid.invokeGlobalFunction.
     */
    // unsupported, non-API function
    // options is just a disposition record containing memberName, componentRecord + passArgs
    // various built-in effects of this method 
    // i) note that it makes no effort to actually propagate direct
    // options from "initArgs", assuming that they will be seen again in expandComponentOptions
    fluid.embodyDemands = function (parentThat, demandspec, initArgs, options) {
        options = options || {};
        
        if (demandspec.mergeOptions && demandspec.options) {
            fluid.fail("demandspec ", demandspec, 
                    " is invalid - cannot specify literal options together with mergeOptions"); 
        }
        if (demandspec.transformOptions) {
            demandspec.options = $.extend(true, {}, demandspec.options, {
                transformOptions: demandspec.transformOptions
            });
        }

        options.componentRecord = $.extend(true, {}, options.componentRecord, 
            fluid.censorKeys(demandspec, ["funcName", "registeredFrom", "transformOptions", "backSpecs"]));
            
        // temporary hack to keep Uploader broadly working until we rewrite its very nonstandard options workflow using Skywalker
        if (options.componentRecord.preOptions) { 
            options.componentRecord.options = fluid.expandOptions(options.componentRecord.preOptions, parentThat);
            delete options.componentRecord.preOptions;
        }
        
        var demands = fluid.makeArray(demandspec.args);
        if (demands.length === 0) {
            demands = fluid.makeArray(options.componentRecord.args);
        }
        var upDefaults = fluid.defaults(demandspec.funcName); // I can SEE into TIME!!
        var argMap = upDefaults? upDefaults.argumentMap : null;
        var inferMap = false;
        if (!argMap && (upDefaults || (options && options.componentRecord)) && !options.passArgs) {
            inferMap = true;
            // infer that it must be a little component if we have any reason to believe it is a component
            if (demands.length < 2) {
                argMap = fluid.rawDefaults("fluid.littleComponent").argumentMap;
            }
            else {
                var optionpos = $.inArray("{options}", demands);
                if (optionpos === -1) {
                    optionpos = demands.length - 1; // wild guess in the old style
                }
                argMap = {options: optionpos};
            }
        }
        options = options || {};
        if (demands.length === 0) {
            if (options.componentRecord && argMap) {
                demands = fluid.argMapToDemands(argMap);
            }
            else if (options.passArgs) {
                demands = fluid.makePassArgsSpec(initArgs);
            }
        }
        // confusion remains with "localRecord" - it is a random mishmash of user arguments and the component record
        // this should itself be absorbed into "mergeRecords" and let stackFetcher sort it out
        var localRecord = $.extend({"arguments": initArgs}, fluid.censorKeys(options.componentRecord, ["type"]));
        fluid.each(argMap, function (index, name) {
            // this is incorrect anyway! What if the supplied arguments were not in the same order as the target argmap,
            // which was obtained from the target defaults
            if (initArgs.length > 0) {
                localRecord[name] = localRecord["arguments"][index];
            }
            if (demandspec[name] !== undefined && localRecord[name] === undefined) {
                localRecord[name] = demandspec[name];
            }
        });
        
        var mergeRecords = {};
        
        if (options.componentRecord !== undefined) {
            // Deliberately put too many things here so they can be checked in expandComponentOptions (FLUID-4285)
            mergeRecords.subcomponentRecord = options.componentRecord;
        }
        var expandOptions = fluid.makeStackResolverOptions(parentThat, localRecord);
        var args = [];
        if (demands) {
            for (var i = 0; i < demands.length; ++i) {
                var arg = demands[i];
                // Weak detection since we cannot guarantee this material has not been copied
                if (fluid.isMarker(arg) && arg.value === fluid.COMPONENT_OPTIONS.value) {
                    arg = "{options}";
                    // Backwards compatibility for non-users of GRADES - last-ditch chance to correct the inference
                    if (inferMap) {
                        argMap = {options: i};
                    } 
                }
                if (typeof(arg) === "string") {
                    if (arg.charAt(0) === "@") {
                        var argpos = arg.substring(1);
                        arg = "{arguments}." + argpos;
                    }
                }
                if (!argMap || argMap.options !== i) {
                    // expand immediately if there can be no options or this is not the options
                    args[i] = fluid.expand(arg, expandOptions);
                }
                else { // It is the component options
                    if (typeof(arg) === "object" && !arg.targetTypeName) {
                        arg.targetTypeName = demandspec.funcName;
                    }
                    mergeRecords.demands = [];
                    fluid.each(demandspec.backSpecs.reverse(), function (backSpec) {
                        fluid.pushDemandSpec(mergeRecords.demands, backSpec.options, backSpec.mergeOptions);  
                    });
                    fluid.pushDemandSpec(mergeRecords.demands, demandspec.options || arg, demandspec.mergeOptions);
                    if (initArgs.length > 0) {
                        mergeRecords.user = {options: localRecord.options};
                    }
                    args[i] = {marker: fluid.EXPAND, 
                               mergeRecords: mergeRecords,
                               instantiator: fluid.getInstantiator(parentThat),
                               parentThat: parentThat,
                               memberName: options.memberName};
                }
                if (args[i] && fluid.isMarker(args[i].marker, fluid.EXPAND_NOW)) {
                    args[i] = fluid.expand(args[i].value, expandOptions);
                }
            }
        }
        else {
            args = initArgs? initArgs : [];
        }

        var togo = {
            args: args,
            funcName: demandspec.funcName
        };
        return togo;
    };
    
    // NON-API function
    fluid.fabricateDestroyMethod = function (that, name, instantiator, child) {
        return function () {
            instantiator.clearComponent(that, name, child);
        };
    };
    
    fluid.initDependent = function (that, name, directArgs) {
        if (that[name]) { return; } // TODO: move this into strategy
        directArgs = directArgs || [];
        var component = that.options.components[name];
        fluid.pushActivity("initDependent", "instantiation of dependent component with name \"%name\" with record %record as child of %parent", 
            {name: name, record: component, parent: that});
        var instance;
        var instantiator = idToInstantiator[that.id];
        
        if (typeof(component) === "string") {
            var instance = fluid.expandOptions(component, that);
            instantiator.recordKnownComponent(that, instance, name, false); 
        }
        else if (component.type) {
            var type = fluid.expandOptions(component.type, that);
            if (!type) {
                fluid.fail("Error in subcomponent record: ", component.type, " could not be resolved to a type for component ", name,
                    " of parent ", that);
            }
            var invokeSpec = fluid.resolveDemands(that, [type, name], directArgs, 
                {componentRecord: component, memberName: name});
            instance = fluid.initSubcomponentImpl(that, {type: invokeSpec.funcName}, invokeSpec.args);
            // The existing instantiator record will be provisional, adjust it to take account of the true return
            // TODO: Instantiator contents are generally extremely incomplete
            var path = instantiator.composePath(instantiator.idToPath(that.id), name);
            var existing = instantiator.pathToComponent[path];
            // This branch deals with the case where the component creator registered a component into "pathToComponent"
            // that does not agree with the component which was the return value. We need to clear out "pathToComponent" but
            // not shred the component since most of it is probably still valid
            if (existing && existing !== instance) {
                instantiator.clearComponent(that, name, existing);
            }
            if (instance && instance.typeName && instance.id && instance !== existing) {
                instantiator.recordKnownComponent(that, instance, name, true);
            }
            instance.destroy = fluid.fabricateDestroyMethod(that, name, instantiator, instance);
        }
        else {
            fluid.fail("Unrecognised material in place of subcomponent " + name + " - no \"type\" field found");
        }
        that[name] = instance;
        fluid.fireEvent(instance, "events.onAttach", [instance, name, that]);
        fluid.popActivity();
    };
    
    // unsupported, non-API function
    fluid.bindDeferredComponent = function (that, componentName, component) {
        var events = fluid.makeArray(component.createOnEvent);
        fluid.each(events, function(eventName) {
            that.events[eventName].addListener(function() {
                fluid.pushActivity("initDeferred", "Beginning instantiation of deferred component %componentName of parent %that due to event %eventName",
                 {componentName: componentName, that: that, eventName: eventName});
                if (that[componentName]) {
                    var instantiator = idToInstantiator[that.id];
                    instantiator.clearComponent(that, componentName);
                }
                fluid.initDependent(that, componentName);
                fluid.popActivity();
            }, null, null, component.priority);
        });
    };
    
    // unsupported, non-API function
    fluid.priorityForComponent = function (component) {
        return component.priority? component.priority : 
            (component.type === "fluid.typeFount" || fluid.hasGrade(fluid.defaults(component.type), "fluid.typeFount"))?
            "first" : undefined;  
    };
    
    fluid.initDependents = function (that) {
        fluid.pushActivity("initDependents", "instantiating dependent components for component %that", {that: that});
        var shadow = fluid.shadowForComponent(that);
        shadow.memberStrategy.initter();
        
        var options = that.options;
        var components = options.components || {};
        var componentSort = {};

        fluid.each(components, function (component, name) {
            if (!component.createOnEvent) {
                var priority = fluid.priorityForComponent(component);
                componentSort[name] = {key: name, priority: fluid.event.mapPriority(priority, 0)};
            }
            else {
                fluid.bindDeferredComponent(that, name, component);
            }
        });
        var componentList = fluid.event.sortListeners(componentSort);
        fluid.each(componentList, function (entry) {
            fluid.initDependent(that, entry.key);  
        });

        shadow.invokerStrategy.initter();
        fluid.popActivity();
    };   
    
    var aliasTable = {};
    
    fluid.alias = function (demandingName, aliasName) {
        if (aliasName) {
            aliasTable[demandingName] = aliasName;
        }
        else {
            return aliasTable[demandingName];
        }
    };
   
    var dependentStore = {};
    
    function searchDemands (demandingName, contextNames) {
        var exist = dependentStore[demandingName] || [];
outer:  for (var i = 0; i < exist.length; ++i) {
            var rec = exist[i];
            for (var j = 0; j < contextNames.length; ++j) {
                if (rec.contexts[j] !== contextNames[j]) {
                    continue outer;
                }
            }
            return rec.spec; // jslint:ok
        }
    }
    
    var isDemandLogging = false;
    fluid.setDemandLogging = function (set) {
        isDemandLogging = set;  
    };
    
    // unsupported, non-API function
    fluid.isDemandLogging = function (demandingNames) {
        return isDemandLogging && fluid.isLogging();
    };
    
    fluid.demands = function (demandingName, contextName, spec) {
        var contextNames = fluid.makeArray(contextName).sort(); 
        if (!spec) {
            return searchDemands(demandingName, contextNames);
        }
        else if (spec.length) {
            spec = {args: spec};
        }
        if (fluid.getCallerInfo && fluid.isDemandLogging()) {
            var callerInfo = fluid.getCallerInfo(5);
            if (callerInfo) {
                spec.registeredFrom = callerInfo;
            }
        }
        var exist = dependentStore[demandingName];
        if (!exist) {
            exist = [];
            dependentStore[demandingName] = exist;
        }
        exist.push({contexts: contextNames, spec: spec});
    };

    // unsupported, non-API function
    fluid.compareDemands = function (speca, specb) {
        return specb.intersect - speca.intersect;
    };
    
    // unsupported, non-API function
    fluid.locateAllDemands = function (parentThat, demandingNames) {
        var demandLogging = fluid.isDemandLogging(demandingNames);
        if (demandLogging) {
            fluid.log("Resolving demands for function names ", demandingNames, " in context of " +
                (parentThat? "component " + parentThat.typeName : "no component"));
        }
        
        var contextNames = {};
        var visited = [];
        var instantiator = fluid.getInstantiator(parentThat);
        var thatStack = instantiator.getFullStack(parentThat);
        visitComponents(instantiator, thatStack, function (component, xname, path) {
            contextNames[component.typeName] = true;
            var gradeNames = fluid.makeArray(fluid.get(component, ["options", "gradeNames"]));
            fluid.each(gradeNames, function (gradeName) {
                contextNames[gradeName] = true;  
            });
            visited.push(component);
        });
        if (demandLogging) {
            fluid.log("Components in scope for resolution:\n" + fluid.dumpThatStack(visited, instantiator));  
        }
        var matches = [];
        for (var i = 0; i < demandingNames.length; ++i) {
            var rec = dependentStore[demandingNames[i]] || [];
            for (var j = 0; j < rec.length; ++j) {
                var spec = rec[j];
                var record = {spec: spec, intersect: 0, uncess: 0};
                for (var k = 0; k < spec.contexts.length; ++k) {
                    record[contextNames[spec.contexts[k]]? "intersect" : "uncess"] += 2;
                }
                if (spec.contexts.length === 0) { // allow weak priority for contextless matches
                    record.intersect++;
                }
                if (record.uncess === 0) {
                    matches.push(record);
                } 
            }
        }
        matches.sort(fluid.compareDemands);
        return matches;   
    };

    fluid.getMembers = function (holder, name) {
        return fluid.transform(holder, function(member) {
            return fluid.get(member, name);
        });
    };

    // unsupported, non-API function
    fluid.locateDemands = function (parentThat, demandingNames) {
        var matches = fluid.locateAllDemands(parentThat, demandingNames);
        var demandspec = fluid.getMembers(matches, ["spec", "spec"]);
        if (fluid.isDemandLogging(demandingNames)) {
            if (demandspec.length) {
                fluid.log("Located " + matches.length + " potential match" + (matches.length === 1? "" : "es") + ", selected best match with " + matches[0].intersect 
                    + " matched context names: ", demandspec);
            }
            else {
                fluid.log("No matches found for demands, using direct implementation");
            }
        }  
        return demandspec;
    };
    
    /** Determine the appropriate demand specification held in the fluid.demands environment 
     * relative the supplied component position for the function name(s) funcNames.
     */
    // unsupported, non-API function
    fluid.determineDemands = function (parentThat, funcNames) {
        funcNames = fluid.makeArray(funcNames);
        var newFuncName = funcNames[0];
        var demandspec = fluid.locateDemands(parentThat, funcNames);
        if (demandspec.length && demandspec[0].funcName) {
            newFuncName = demandspec[0].funcName;
        }
        
        var aliasTo = fluid.alias(newFuncName);
        
        if (aliasTo) {
            newFuncName = aliasTo;
            fluid.log("Following redirect from function name " + newFuncName + " to " + aliasTo);
            var demandspec2 = fluid.locateDemands(parentThat, [aliasTo])[0];
            if (demandspec2) {
                fluid.each(demandspec2, function(value, key) { // TODO: appears totally disused
                    if (localRecordExpected.test(key)) {
                        fluid.fail("Error in demands block ", demandspec2, " - content with key \"" + key 
                            + "\" is not supported since this demands block was resolved via an alias from \"" + newFuncName + "\"");
                    }  
                });
                if (demandspec2.funcName) {
                    newFuncName = demandspec2.funcName;
                    fluid.log("Followed final inner demands to function name \"" + newFuncName + "\"");
                }
            }
        }
        
        return $.extend(true, {funcName: newFuncName, 
                                args: demandspec[0] ? fluid.makeArray(demandspec[0].args) : [],
                                backSpecs: demandspec.slice(1)
                                },
            fluid.censorKeys(demandspec[0], ["funcName", "args"]));
    };
    // "options" includes - passArgs, componentRecord, memberName (latter two from initDependent route)
    fluid.resolveDemands = function (parentThat, funcNames, initArgs, options) {
        var demandspec = fluid.determineDemands(parentThat, funcNames);
        return fluid.embodyDemands(parentThat, demandspec, initArgs, options);
    };
    
    // TODO: make a *slightly* more performant version of fluid.invoke that perhaps caches the demands
    // after the first successful invocation
    fluid.invoke = function (functionName, args, that, environment) {
        fluid.pushActivity("invoke", "while invoking function with name \"%functionName\" from component %that", {functionName: functionName, that: that})  
        var invokeSpec = fluid.resolveDemands(that, functionName, fluid.makeArray(args), {passArgs: true});
        var togo = fluid.invokeGlobalFunction(invokeSpec.funcName, invokeSpec.args, environment);
        fluid.popActivity();
        return togo;
    };
    
    /** Make a function which performs only "static redispatch" of the supplied function name - 
     * that is, taking only account of the contents of the "static environment". Since the static
     * environment is assumed to be constant, the dispatch of the call will be evaluated at the
     * time this call is made, as an optimisation.
     */
    
    fluid.makeFreeInvoker = function (functionName, environment) {
        var demandSpec = fluid.determineDemands(null, functionName);
        return function () {
            var invokeSpec = fluid.embodyDemands(null, demandSpec, fluid.makeArray(arguments), {passArgs: true});
            return fluid.invokeGlobalFunction(invokeSpec.funcName, invokeSpec.args, environment);
        };
    };
    
    fluid.makeInvoker = function (that, demandspec, functionName, environment) {
        demandspec = demandspec || fluid.determineDemands(that, functionName);
        return function () {
            var args = fluid.makeArray(arguments);
            var invokeSpec = fluid.embodyDemands(that, demandspec, args, {passArgs: true});
            return fluid.invokeGlobalFunction(invokeSpec.funcName, invokeSpec.args, environment);
        };
    };
    
    // unsupported, non-API function
    // weird higher-order function so that we can staightforwardly dispatch original args back onto listener   
    fluid.event.makeTrackedListenerAdder = function (source) {
        var instantiator = idToInstantiator[source.id];
        return function (event) {
            return {addListener: function(listener) {
                    instantiator.recordListener(event, listener, source);
                    event.addListener.apply(null, arguments);
                }
            }
        }
    };

    // unsupported, non-API function    
    fluid.event.listenerEngine = function (eventSpec, callback, adder) {
        var argstruc = {};
        function checkFire() {
            var notall = fluid.find(eventSpec, function(value, key) {
                if (argstruc[key] === undefined) {
                    return true;
                }  
            });
            if (!notall) {
                callback(argstruc);
                fluid.clear(argstruc);
            }
        }
        fluid.each(eventSpec, function(event, eventName) {
            adder(event).addListener(function() {
                argstruc[eventName] = fluid.makeArray(arguments);
                checkFire();
            });
        });
    };
    
    // unsupported, non-API function
    fluid.event.dispatchListener = function (that, listener, eventName, eventSpec, indirectArgs) {
        return function () {
            fluid.pushActivity("dispatchListener", "firing to listener to event named %eventName of component %that", 
                {eventName: eventName, that: that});
            if (typeof(listener) === "string") {
                listener = fluid.event.resolveListener({globalName: listener}); // just resolves globals
            }
            var args = indirectArgs? arguments[0] : fluid.makeArray(arguments);
            var demandspec = fluid.determineDemands(that, eventName);
            if (demandspec.args.length === 0 && eventSpec.args) {
                demandspec.args = eventSpec.args;
            }
            var resolved = fluid.embodyDemands(that, demandspec, args, {passArgs: true, componentOptions: eventSpec});
            var togo = listener.apply(null, resolved.args);
            fluid.popActivity();  
            return togo;
        }
    };
    
    // unsupported, non-API function
    fluid.event.resolveListenerRecord = function (lisrec, that, eventName) {
        var badRec = function (record, extra) {
            fluid.fail("Error in listener record - could not resolve reference " + record + " to a listener or firer. "
                    + "Did you miss out \"events.\" when referring to an event firer?" + extra);
        };
        fluid.pushActivity("resolveListenerRecord", "resolving listener record for event named %eventName for component %that",
            {eventName: eventName, that: that});
        var records = fluid.makeArray(lisrec);
        var transRecs = fluid.transform(records, function (record) {
            var expanded = record.listener ? record : {listener: record};
            if (!expanded.listener) {
                badRec(record, "Listener record must contain a member named \"listener\"");
            }
            var listener = expanded.listener = fluid.expandOptions(expanded.listener, that);
            if (!listener) {
                badRec(record, "");
            }
            var firer;
            if (listener.typeName === "fluid.event.firer") {
                listener = listener.fire;
                firer = true;
            }
            expanded.listener = expanded.args || firer ? fluid.event.dispatchListener(that, listener, eventName, expanded) : listener;
            return expanded;
        });
        var togo = {
            records: transRecs,
            adderWrapper: fluid.event.makeTrackedListenerAdder(that)
        };
        fluid.popActivity();
        return togo;
    };
    
    // unsupported, non-API function
    fluid.event.expandOneEvent = function (event, that) {
        var origin;
        if (typeof(event) === "string" && event.charAt(0) !== "{") {
            // Shorthand for resolving onto our own events, but with GINGER WORLD!
            origin = fluid.getForComponent(that, ["events", event]);
        }
        else {
            origin = fluid.expandOptions(event, that);
        }
        if (!origin || origin.typeName !== "fluid.event.firer") {
            fluid.fail("Error in event specification - could not resolve base event reference ", event, " to an event firer: got ", origin);
        }
        return origin;
    };

    // unsupported, non-API function    
    fluid.event.expandEvents = function (event, that) {
        return typeof(event) === "string"?
            fluid.event.expandOneEvent(event, that) :
            fluid.transform(event, function(oneEvent) {
                return fluid.event.expandOneEvent(oneEvent, that);
            });
    };
    
    // unsupported, non-API function
    fluid.event.resolveEvent = function (that, eventName, eventSpec) {
        fluid.pushActivity("resolveEvent", "while resolving event with name %eventName attached to component %that", 
            {eventName: eventName, that: that});
        var adder = fluid.event.makeTrackedListenerAdder(that);
        if (typeof(eventSpec) === "string") {
            eventSpec = {event: eventSpec};
        }
        var event = eventSpec.event || eventSpec.events;
        if (!event) {
            fluid.fail("Event specification for event with name " + eventName + " does not include a base event specification: ", eventSpec);
        }
        
        var origin = fluid.event.expandEvents(event, that);

        var isMultiple = origin.typeName !== "fluid.event.firer";
        var isComposite = eventSpec.args || isMultiple;
        // If "event" is not composite, we want to share the listener list and FIRE method with the original
        // If "event" is composite, we need to create a new firer. "composite" includes case where any boiling
        // occurred - this was implemented wrongly in 1.4.
        var firer;
        if (isComposite) {
            firer = fluid.event.getEventFirer(null, null, " [composite] " + fluid.event.nameEvent(that, eventName));
            var dispatcher = fluid.event.dispatchListener(that, firer.fire, eventName, eventSpec, isMultiple);
            if (isMultiple) {
                fluid.event.listenerEngine(origin, dispatcher, adder);
            }
            else {
                adder(origin).addListener(dispatcher);
            }
        }
        else {
            firer = {typeName: "fluid.event.firer"}; // jslint:ok - already defined
            firer.fire = function () {
                var outerArgs = fluid.makeArray(arguments);
                fluid.pushActivity("fireSynthetic", "firing synthetic event %eventName ", {eventName: eventName});  
                return origin.fire.apply(null, outerArgs);
                fluid.popActivity();
            };
            firer.addListener = function (listener, namespace, predicate, priority) {
                var dispatcher = fluid.event.dispatchListener(that, listener, eventName, eventSpec);
                adder(origin).addListener(dispatcher, namespace, predicate, priority);
            };
            firer.removeListener = function (listener) {
                origin.removeListener(listener);
            };
        }
        fluid.popActivity();
        return firer;
    };

    // Although the following two functions are unsupported and not part of the IoC
    // implementation proper, they are still used in the renderer
    // expander as well as in some old-style tests and various places in CSpace.
    
    // unsupported, non-API function
    fluid.withEnvironment = function (envAdd, func, root) {
        root = root || fluid.globalThreadLocal();
        return fluid.tryCatch(function() {
            for (var key in envAdd) {
                root[key] = envAdd[key];
            }
            $.extend(root, envAdd);
            return func();
        }, null, function() {
            for (var key in envAdd) { // jslint:ok duplicate "value"
                delete root[key]; // TODO: users may want a recursive "scoping" model
            }
        });
    };
    
    // unsupported, non-API function  
    fluid.makeEnvironmentFetcher = function (directModel, elResolver, envGetter) {
        envGetter = envGetter || fluid.globalThreadLocal;
        return function(parsed) {
            var env = envGetter();
            return fluid.fetchContextReference(parsed, directModel, env, elResolver);
        };
    };

    // unsupported, non-API function  
    fluid.extractEL = function (string, options) {
        if (options.ELstyle === "ALL") {
            return string;
        }
        else if (options.ELstyle.length === 1) {
            if (string.charAt(0) === options.ELstyle) {
                return string.substring(1);
            }
        }
        else if (options.ELstyle === "${}") {
            var i1 = string.indexOf("${");
            var i2 = string.lastIndexOf("}");
            if (i1 === 0 && i2 !== -1) {
                return string.substring(2, i2);
            }
        }
    };
    
    // unsupported, non-API function
    fluid.extractELWithContext = function (string, options) {
        var EL = fluid.extractEL(string, options);
        if (EL && EL.charAt(0) === "{") {
            return fluid.parseContextReference(EL);
        }
        return EL? {path: EL} : EL;
    };

    fluid.parseContextReference = function (reference, index, delimiter) {
        index = index || 0;
        var endcpos = reference.indexOf("}", index + 1);
        if (endcpos === -1) {
            fluid.fail("Cannot parse context reference \"" + reference + "\": Malformed context reference without }");
        }
        var context = reference.substring(index + 1, endcpos);
        var endpos = delimiter? reference.indexOf(delimiter, endcpos + 1) : reference.length;
        var path = reference.substring(endcpos + 1, endpos);
        if (path.charAt(0) === ".") {
            path = path.substring(1);
        }
        return {context: context, path: path, endpos: endpos};
    };
    
    fluid.renderContextReference = function (parsed) {
        return "{" + parsed.context + "}." + parsed.path;  
    };

    // unsupported, NON-API function    
    fluid.fetchContextReference = function (parsed, directModel, env, elResolver) {
        if (elResolver) {
            parsed = elResolver(parsed, env);
        }
        var base = parsed.context? env[parsed.context] : directModel;
        if (!base) {
            return base;
        }
        return parsed.noDereference? parsed.path : fluid.get(base, parsed.path);
    };
    
    // unsupported, non-API function
    fluid.resolveContextValue = function (string, options) {
        fluid.pushActivity("resolveContextValue", "resolving context value %string", {string: string});
        var togo, parsed;
        if (options.bareContextRefs && string.charAt(0) === "{") {
            parsed = fluid.parseContextReference(string);
            togo = options.fetcher(parsed);        
        }
        else if (options.ELstyle && options.ELstyle !== "${}") {
            parsed = fluid.extractELWithContext(string, options); // jslint:ok
            if (parsed) {
                togo = options.fetcher(parsed);
            }
        }
        if (parsed === undefined) {
            while (typeof(string) === "string") {
              var i1 = string.indexOf("${");
              var i2 = string.indexOf("}", i1 + 2);
              if (i1 !== -1 && i2 !== -1) {
                  var parsed; // jslint:ok
                  if (string.charAt(i1 + 2) === "{") {
                      parsed = fluid.parseContextReference(string, i1 + 2, "}");
                      i2 = parsed.endpos;
                  }
                  else {
                      parsed = {path: string.substring(i1 + 2, i2)};
                  }
                  var subs = options.fetcher(parsed);
                  var all = (i1 === 0 && i2 === string.length - 1); 
                  // TODO: test case for all undefined substitution
                  if (subs === undefined || subs === null) {
                      return subs;
                  }
                  string = all? subs : string.substring(0, i1) + subs + string.substring(i2 + 1);
              }
              else {
                  break;
              }
          }
          togo = string;
        }
        fluid.popActivity();
        return togo;
    };

    // unsupported, NON-API function
    fluid.expandExpander = function (target, source, options) {
        var expander = fluid.getGlobalValue(source.expander.type || "fluid.deferredInvokeCall");  
        if (expander) {
            return expander.call(null, target, source, options);
        }
    };
    
    // This function appears somewhat reusable, but not entirely - it probably needs to be packaged
    // along with the particular "strategy". Very similar to the old "filter"... the "outer driver" needs
    // to execute it to get the first recursion going at top level. This was one of the most odd results
    // of the reorganisation, since the "old work" seemed much more naturally expressed in terms of values
    // and what happened to them. The "new work" is expressed in terms of paths and how to move amongst them.
    fluid.fetchExpandChildren = function (target, source, mergePolicy, miniWorld, options) {
        if (source.expander /* && source.expander.type */) { // possible expander at top level
            var expanded = fluid.expandExpander(target, source, options);
            if (fluid.isPrimitive(expanded) || (fluid.isArrayable(expanded) ^ fluid.isArrayable(target))) {
                return expanded;
            }
            else { // make an attempt to preserve the root reference if possible
                $.extend(true, target, expanded);
            }
        }
        // NOTE! This expects that RHS is concrete! For material input to "expansion" this happens to be the case, but is not
        // true for other algorithms. Inconsistently, this algorithm uses "sourceStrategy" below. In fact, this "fetchChildren"
        // operation looks like it is a fundamental primitive of the system. We do call "deliverer" early which enables correct
        // reference to parent nodes up the tree - however, anyone processing a tree IN THE CHAIN requires that it is produced
        // concretely at the point STRATEGY returns. Which in fact it is...............
        fluid.each(source, function (newSource, key) {
            if (newSource === undefined) {
                target[key] = undefined; // avoid ever dispatching to ourselves with undefined source
            }
            else { // Don't bother to generate segs or i in direct dispatch to self!!!!!!
                options.strategy(target, key, null, null, source, mergePolicy, miniWorld);
            }
        });
        return target;
    };
    
    // TODO: This method is unnecessary and will quadratic inefficiency if RHS block is not concrete. 
    // The driver should detect "homogeneous uni-strategy trundling" and agree to preserve the extra 
    // "cursor arguments" which should be advertised somehow (at least their number)
    function regenerateCursor (source, segs, limit, sourceStrategy) {
        for (var i = 0; i < limit; ++ i) {
            source = sourceStrategy(source, segs[i], i, segs);
        }
        return source;
    }

    // unsupported, NON-API function    
    fluid.isUnexpandable = function (source) {
        return fluid.isPrimitive(source) || source.nodeType !== undefined || source.jquery;
    };
    
    // unsupported, NON-API function
    fluid.guardCircularity = function (seenIds, source, message1, message2) {
        if (source && source.id) {
            if (!seenIds[source.id]) {
                seenIds[source.id] = source;
            } else if (seenIds[source.id] === source) {
                fluid.fail("Circularity in options " + message1 + " - " + fluid.nameComponent(source)
                    + " has already been seen" + message2);
            }
        }
    };

    // unsupported, NON-API function    
    fluid.expandSource = function (options, target, deliverer, source, policy, miniWorld, recurse) {
        var expanded, isTrunk, isLate;
        var thisPolicy = fluid.derefMergePolicy(policy);
        fluid.guardCircularity(options.seenIds, source, "expansion", 
             " - please ensure options are not circularly connected, or protect from expansion using the \"noexpand\" policy or expander");
        if (typeof (source) === "string" && !thisPolicy.noexpand) {
            expanded = fluid.resolveContextValue(source, options);
        }
        else if (thisPolicy.noexpand || fluid.isUnexpandable(source)) {
            expanded = source;
        }
        else if (source.expander) {
            expanded = fluid.expandExpander(deliverer, source, options);
        }
        else {
            if (thisPolicy.preserve) {
                expanded = source;
                isLate = true;
            }
            else {
                expanded = fluid.freshContainer(source);
            }
            isTrunk = true;
        }
        if (!isLate && expanded !== fluid.NO_VALUE) {
            deliverer(expanded);
        }
        if (isTrunk) {
            recurse(expanded, source, policy, miniWorld || isLate);
        }
        if (isLate && expanded !== fluid.NO_VALUE) {
            deliverer(expanded);
        }
        return expanded;
    };

    // unsupported, NON-API function    
    fluid.makeExpandStrategy = function (options) {
        var recurse = function (target, source, policy, miniWorld) {
            return fluid.fetchExpandChildren(target, source, policy, miniWorld, options);
        };
        var strategy = function (target, name, i, segs, source, policy, miniWorld) {
            if (!target) {
                return;
            }
            if (!miniWorld && target.hasOwnProperty(name)) { // bail out if our work has already been done
                return target[name];
            }
            if (name === "expander" && source && source.expander.type) { // must be direct dispatch from fetchChildren
                return;
            }
            if (source === undefined) { // recover our state in case this is an external entry point
                source = regenerateCursor(options.source, segs, i - 1, options.sourceStrategy);
                policy = regenerateCursor(options.mergePolicy, segs, i - 1, fluid.concreteTrundler);
            }
            var thisSource = options.sourceStrategy(source, name, i, segs);
            var thisPolicy = fluid.concreteTrundler(policy, name);
            function deliverer(value) {
                target[name] = value;
            }
            
            return fluid.expandSource(options, target, deliverer, thisSource, thisPolicy, miniWorld, recurse);
        };
        options.recurse = recurse;
        options.strategy = strategy;
        return strategy;
    };
    
    fluid.defaults("fluid.makeExpandOptions", {
        ELstyle:          "${}",
        bareContextRefs:  true,
        target:           fluid.inCreationMarker
    });

    // unsupported, NON-API function    
    fluid.makeExpandOptions = function (source, options) {
        options = $.extend({}, fluid.rawDefaults("fluid.makeExpandOptions"), options);
        options.expandSource = function (source) {
            return fluid.expandSource(options, null, fluid.identity, source, options.mergePolicy, false);
        };
        if (!fluid.isUnexpandable(source)) {
            options.source = source;
            options.seenIds = {};
            options.target = fluid.freshContainer(source);
            options.sourceStrategy = options.sourceStrategy || fluid.concreteTrundler;
            fluid.makeExpandStrategy(options);
            options.initter = function () {
                options.target = fluid.fetchExpandChildren(options.target, options.source, options.mergePolicy, false, options);
            };
        }
        else { // these init immediately since we must deliver a valid root target
            options.strategy = fluid.concreteTrundler;
            options.initter = fluid.identity;
            if (typeof(source) === "string") {
                options.target = options.expandSource(source);
            }
            else {
                options.target = source;
            }
        }
        return options;
    }
    
    fluid.expand = function (source, options) {
        var options = fluid.makeExpandOptions(source, options);
        options.initter();
        return options.target;
    };
      
    fluid.registerNamespace("fluid.expander");
            
    /** "light" expanders, starting with support functions for the so-called "deferredCall" expanders,
         which make an arbitrary function call (after expanding arguments) and are then replaced in
         the configuration with the call results. These will probably be abolished and replaced with
         equivalent model transformation machinery **/

    fluid.expander.deferredCall = function (deliverer, source, options) {
        var expander = source.expander;
        var args = (!expander.args || fluid.isArrayable(expander.args))? expander.args : fluid.makeArray(expander.args);
        args = options.recurse([], args); 
        return fluid.invokeGlobalFunction(expander.func, args);
    };
    
    fluid.deferredCall = fluid.expander.deferredCall; // put in top namespace for convenience
    
    // This one is now positioned as the "universal expander" - default if no type supplied
    fluid.deferredInvokeCall = function (deliverer, source, options) {
        var expander = source.expander;
        var args = fluid.makeArray(expander.args);
        args = options.recurse([], args); // TODO: risk of double expansion here. embodyDemands will sometimes expand, sometimes not...
        var funcEntry = expander.func || expander.funcName; 
        var func = options.expandSource(funcEntry);
        if (!func) {
            fluid.fail("Error in expander record - " + funcEntry + " could not be resolved to a function for component ", options.contextThat);
        }
        return typeof(func) === "function" ? func.apply(null, args) : fluid.invoke(func, args, options.contextThat);
    };
    
    // The "noexpand" expander which simply unwraps one level of expansion and ceases.
    fluid.expander.noexpand = function (deliverer, source) {
        return source.expander.value ? source.expander.value : source.expander.tree;
    };
  
    fluid.noexpand = fluid.expander.noexpand; // TODO: check naming and namespacing

          
})(jQuery, fluid_1_5);
