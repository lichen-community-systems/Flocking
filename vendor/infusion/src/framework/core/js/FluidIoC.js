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

    /** NOTE: The contents of this file are by default NOT PART OF THE PUBLIC FLUID API unless explicitly annotated before the function **/

    /* The Fluid "IoC System proper" - resolution of references and
     * completely automated instantiation of declaratively defined
     * component trees */

    // Currently still uses manual traversal - once we ban manually instantiated components,
    // it will use the instantiator's records instead.
    fluid.visitComponentChildren = function (that, visitor, options, segs) {
        segs = segs || [];
        for (var name in that) {
            var component = that[name];
            // This entire algorithm is primitive and expensive and will be removed once we can abolish manual init components
            if (!fluid.isComponent(component) || (options.visited && options.visited[component.id])) {
                continue;
            }
            segs.push(name);
            if (options.visited) { // recall that this is here because we may run into a component that has been cross-injected which might otherwise cause cyclicity
                options.visited[component.id] = true;
            }
            if (visitor(component, name, segs, segs.length - 1)) {
                return true;
            }
            if (!options.flat) {
                fluid.visitComponentChildren(component, visitor, options, segs);
            }
            segs.pop();
        }
    };

    fluid.getContextHash = function (instantiator, that) {
        var shadow = instantiator.idToShadow[that.id];
        return shadow && shadow.contextHash;
    };

    fluid.componentHasGrade = function (that, gradeName) {
        var contextHash = fluid.getContextHash(fluid.globalInstantiator, that);
        return !!(contextHash && contextHash[gradeName]);
    };

    // A variant of fluid.visitComponentChildren that supplies the signature expected for fluid.matchIoCSelector
    // this is: thatStack, contextHashes, memberNames, i - note, the supplied arrays are NOT writeable and shared through the iteration
    fluid.visitComponentsForMatching = function (that, options, visitor) {
        var instantiator = fluid.getInstantiator(that);
        options = $.extend({
            visited: {},
            instantiator: instantiator
        }, options);
        var thatStack = [that];
        var contextHashes = [fluid.getContextHash(instantiator, that)];
        var visitorWrapper = function (component, name, segs) {
            thatStack.length = 1;
            contextHashes.length = 1;
            for (var i = 0; i < segs.length; ++i) {
                var child = thatStack[i][segs[i]];
                thatStack[i + 1] = child;
                contextHashes[i + 1] = fluid.getContextHash(instantiator, child) || {};
            }
            return visitor(component, thatStack, contextHashes, segs, segs.length);
        };
        fluid.visitComponentChildren(that, visitorWrapper, options, []);
    };

    fluid.getMemberNames = function (instantiator, thatStack) {
        if (thatStack.length === 0) { // Odd edge case for FLUID-6126 from fluid.computeDistributionPriority
            return [];
        } else {
            var path = instantiator.idToPath(thatStack[thatStack.length - 1].id);
            var segs = instantiator.parseEL(path);
            // TODO: we should now have no longer shortness in the stack
            segs.unshift.apply(segs, fluid.generate(thatStack.length - segs.length, ""));
            return segs;
        }
    };

    // thatStack contains an increasing list of MORE SPECIFIC thats.
    // this visits all components starting from the current location (end of stack)
    // in visibility order UP the tree.
    fluid.visitComponentsForVisibility = function (instantiator, thatStack, visitor, options) {
        options = options || {
            visited: {},
            flat: true,
            instantiator: instantiator
        };
        var memberNames = fluid.getMemberNames(instantiator, thatStack);
        for (var i = thatStack.length - 1; i >= 0; --i) {
            var that = thatStack[i];

            // explicitly visit the direct parent first
            options.visited[that.id] = true;
            if (visitor(that, memberNames[i], memberNames, i)) {
                return;
            }

            if (fluid.visitComponentChildren(that, visitor, options, memberNames)) {
                return;
            }
            memberNames.pop();
        }
    };

    fluid.mountStrategy = function (prefix, root, toMount) {
        var offset = prefix.length;
        return function (target, name, i, segs) {
            if (i <= prefix.length) { // Avoid OOB to not trigger deoptimisation!
                return;
            }
            for (var j = 0; j < prefix.length; ++j) {
                if (segs[j] !== prefix[j]) {
                    return;
                }
            }
            return toMount(target, name, i - prefix.length, segs.slice(offset));
        };
    };

    fluid.invokerFromRecord = function (invokerec, name, that) {
        fluid.pushActivity("makeInvoker", "beginning instantiation of invoker with name %name and record %record as child of %that",
            {name: name, record: invokerec, that: that});
        var invoker = invokerec ? fluid.makeInvoker(that, invokerec, name) : undefined;
        fluid.popActivity();
        return invoker;
    };

    fluid.memberFromRecord = function (memberrecs, name, that) {
        var togo;
        for (var i = 0; i < memberrecs.length; ++i) { // memberrecs is the special "fluid.mergingArray" type which is not Arrayable
            var expanded = fluid.expandImmediate(memberrecs[i], that);
            if (!fluid.isPlainObject(togo)) { // poor man's "merge" algorithm to hack FLUID-5668 for now
                togo = expanded;
            } else {
                togo = $.extend(true, togo, expanded);
            }
        }
        return togo;
    };

    fluid.recordStrategy = function (that, options, optionsStrategy, recordPath, recordMaker, prefix, exceptions) {
        prefix = prefix || [];
        return {
            strategy: function (target, name, i) {
                if (i !== 1) {
                    return;
                }
                var record = fluid.driveStrategy(options, [recordPath, name], optionsStrategy);
                if (record === undefined) {
                    return;
                }
                fluid.set(target, [name], fluid.inEvaluationMarker);
                var member = recordMaker(record, name, that);
                fluid.set(target, [name], member);
                return member;
            },
            initter: function () {
                var records = fluid.driveStrategy(options, recordPath, optionsStrategy) || {};
                for (var name in records) {
                    if (!exceptions || !exceptions[name]) {
                        fluid.getForComponent(that, prefix.concat([name]));
                    }
                }
            }
        };
    };

    // patch Fluid.js version for timing
    fluid.instantiateFirers = function (that) {
        var shadow = fluid.shadowForComponent(that);
        var initter = fluid.get(shadow, ["eventStrategyBlock", "initter"]) || fluid.identity;
        initter();
    };

    fluid.makeDistributionRecord = function (contextThat, sourceRecord, sourcePath, targetSegs, exclusions, sourceType) {
        sourceType = sourceType || "distribution";
        fluid.pushActivity("makeDistributionRecord", "Making distribution record from source record %sourceRecord path %sourcePath to target path %targetSegs", {sourceRecord: sourceRecord, sourcePath: sourcePath, targetSegs: targetSegs});

        var source = fluid.copy(fluid.get(sourceRecord, sourcePath));
        fluid.each(exclusions, function (exclusion) {
            fluid.model.applyChangeRequest(source, {segs: exclusion, type: "DELETE"});
        });

        var record = {options: {}};
        fluid.model.applyChangeRequest(record, {segs: targetSegs, type: "ADD", value: source});
        fluid.checkComponentRecord(record);
        fluid.popActivity();
        return $.extend(record, {contextThat: contextThat, recordType: sourceType});
    };

    // Part of the early "distributeOptions" workflow. Given the description of the blocks to be distributed, assembles "canned" records
    // suitable to be either registered into the shadow record for later or directly pushed to an existing component, as well as honouring
    // any "removeSource" annotations by removing these options from the source block.
    fluid.filterBlocks = function (contextThat, sourceBlocks, sourceSegs, targetSegs, exclusions, removeSource) {
        var togo = [];
        fluid.each(sourceBlocks, function (block) {
            var source = fluid.get(block.source, sourceSegs);
            if (source !== undefined) {
                togo.push(fluid.makeDistributionRecord(contextThat, block.source, sourceSegs, targetSegs, exclusions, block.recordType));
                var rescued = $.extend({}, source);
                if (removeSource) {
                    fluid.model.applyChangeRequest(block.source, {segs: sourceSegs, type: "DELETE"});
                }
                fluid.each(exclusions, function (exclusion) {
                    var orig = fluid.get(rescued, exclusion);
                    fluid.set(block.source, sourceSegs.concat(exclusion), orig);
                });
            }
        });
        return togo;
    };

    // Use this peculiar signature since the actual component and shadow itself may not exist yet. Perhaps clean up with FLUID-4925
    fluid.noteCollectedDistribution = function (parentShadow, memberName, distribution) {
        fluid.model.setSimple(parentShadow, ["collectedDistributions", memberName, distribution.id], true);
    };

    fluid.isCollectedDistribution = function (parentShadow, memberName, distribution) {
        return fluid.model.getSimple(parentShadow, ["collectedDistributions", memberName, distribution.id]);
    };

    fluid.clearCollectedDistributions = function (parentShadow, memberName) {
        fluid.model.applyChangeRequest(parentShadow, {segs: ["collectedDistributions", memberName], type: "DELETE"});
    };

    fluid.collectDistributions = function (distributedBlocks, parentShadow, distribution, thatStack, contextHashes, memberNames, i) {
        var lastMember = memberNames[memberNames.length - 1];
        if (!fluid.isCollectedDistribution(parentShadow, lastMember, distribution) &&
                fluid.matchIoCSelector(distribution.selector, thatStack, contextHashes, memberNames, i)) {
            distributedBlocks.push.apply(distributedBlocks, distribution.blocks);
            fluid.noteCollectedDistribution(parentShadow, lastMember, distribution);
        }
    };

    // Slightly silly function to clean up the "appliedDistributions" records. In general we need to be much more aggressive both
    // about clearing instantiation garbage (e.g. onCreate and most of the shadow)
    // as well as caching frequently-used records such as the "thatStack" which
    // would mean this function could be written in a sensible way
    fluid.registerCollectedClearer = function (shadow, parentShadow, memberName) {
        if (!shadow.collectedClearer && parentShadow) {
            shadow.collectedClearer = function () {
                fluid.clearCollectedDistributions(parentShadow, memberName);
            };
        }
    };

    fluid.receiveDistributions = function (parentThat, gradeNames, memberName, that) {
        var instantiator = fluid.getInstantiator(parentThat || that);
        var thatStack = instantiator.getThatStack(parentThat || that); // most specific is at end
        thatStack.unshift(fluid.rootComponent);
        var memberNames = fluid.getMemberNames(instantiator, thatStack);
        var shadows = fluid.transform(thatStack, function (thisThat) {
            return instantiator.idToShadow[thisThat.id];
        });
        var parentShadow = shadows[shadows.length - (parentThat ? 1 : 2)];
        var contextHashes = fluid.getMembers(shadows, "contextHash");
        if (parentThat) { // if called before construction of component from assembleCreatorArguments - NB this path will be abolished/amalgamated
            memberNames.push(memberName);
            contextHashes.push(fluid.gradeNamesToHash(gradeNames));
            thatStack.push(that);
        } else {
            fluid.registerCollectedClearer(shadows[shadows.length - 1], parentShadow, memberNames[memberNames.length - 1]);
        }
        var distributedBlocks = [];
        for (var i = 0; i < thatStack.length - 1; ++i) {
            fluid.each(shadows[i].distributions, function (distribution) { // eslint-disable-line no-loop-func
                fluid.collectDistributions(distributedBlocks, parentShadow, distribution, thatStack, contextHashes, memberNames, i);
            });
        }
        return distributedBlocks;
    };

    fluid.computeTreeDistance = function (path1, path2) {
        var i = 0;
        while (i < path1.length && i < path2.length && path1[i] === path2[i]) {
            ++i;
        }
        return path1.length + path2.length - 2*i; // eslint-disable-line space-infix-ops
    };

    // Called from applyDistributions (immediate application route) as well as mergeRecordsToList (pre-instantiation route) AS WELL AS assembleCreatorArguments (pre-pre-instantiation route)
    fluid.computeDistributionPriority = function (targetThat, distributedBlock) {
        if (!distributedBlock.priority) {
            var instantiator = fluid.getInstantiator(targetThat);
            var targetStack = instantiator.getThatStack(targetThat);
            var targetPath = fluid.getMemberNames(instantiator, targetStack);
            var sourceStack = instantiator.getThatStack(distributedBlock.contextThat);
            var sourcePath = fluid.getMemberNames(instantiator, sourceStack);
            var distance = fluid.computeTreeDistance(targetPath, sourcePath);
            distributedBlock.priority = fluid.mergeRecordTypes.distribution - distance;
        }
        return distributedBlock;
    };

    // convert "preBlocks" as produced from fluid.filterBlocks into "real blocks" suitable to be used by the expansion machinery.
    fluid.applyDistributions = function (that, preBlocks, targetShadow) {
        var distributedBlocks = fluid.transform(preBlocks, function (preBlock) {
            return fluid.generateExpandBlock(preBlock, that, targetShadow.mergePolicy);
        }, function (distributedBlock) {
            return fluid.computeDistributionPriority(that, distributedBlock);
        });
        var mergeOptions = targetShadow.mergeOptions;
        mergeOptions.mergeBlocks.push.apply(mergeOptions.mergeBlocks, distributedBlocks);
        mergeOptions.updateBlocks();
        return distributedBlocks;
    };

    // TODO: This implementation is obviously poor and has numerous flaws - in particular it does no backtracking as well as matching backwards through the selector
    /** Match a parsed IoC selector against a selection of data structures representing a component's tree context.
     * @param {ParsedSelector} selector - A parsed selector structure as returned from `fluid.parseSelector`.
     * @param {Component[]} thatStack - An array of components ascending up the tree from the component being matched,
     * which will be held in the last position.
     * @param {Object[]} contextHashes - An array of context hashes as cached in the component's shadows - a hash to
     * `true`/"memberName" depending on the reason the context matches
     * @param {String[]} [memberNames] - An array of member names of components in their parents. This is only used in the distributeOptions route.
     * @param {Number} i - One plus the index of the IoCSS head component within `thatStack` - all components before this
     * index will be ignored for matching. Will have value `1` in the queryIoCSelector route.
     * @return {Boolean} `true` if the selector matches the leaf component at the end of `thatStack`
     */
    fluid.matchIoCSelector = function (selector, thatStack, contextHashes, memberNames, i) {
        var thatpos = thatStack.length - 1;
        var selpos = selector.length - 1;
        while (true) {
            var isChild = selector[selpos].child;
            var mustMatchHere = thatpos === thatStack.length - 1 || isChild;

            var that = thatStack[thatpos];
            var selel = selector[selpos];
            var match = true;
            for (var j = 0; j < selel.predList.length; ++j) {
                var pred = selel.predList[j];
                var context = pred.context;
                if (context && context !== "*" && !(contextHashes[thatpos][context] || memberNames[thatpos] === context)) {
                    match = false;
                    break;
                }
                if (pred.id && that.id !== pred.id) {
                    match = false;
                    break;
                }
            }
            if (selpos === 0 && thatpos > i && mustMatchHere && isChild) {
                match = false; // child selector must exhaust stack completely - FLUID-5029
            }
            if (match) {
                if (selpos === 0) {
                    return true;
                }
                --thatpos;
                --selpos;
            }
            else {
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

    /** Query for all components matching a selector in a particular tree
     * @param {Component} root - The root component at which to start the search
     * @param {String} selector - An IoCSS selector, in form of a string. Note that since selectors supplied to this function implicitly
     * match downwards, they need not contain the "head context" followed by whitespace required in the distributeOptions form. E.g.
     * simply <code>"fluid.viewComponent"</code> will match all viewComponents below the root.
     * @param {Boolean} flat - [Optional] <code>true</code> if the search should just be performed at top level of the component tree
     * Note that with <code>flat=true</code> this search will scan every component in the tree and may well be very slow.
     * @return {Component[]} The list of all components matching the selector
     */
    // supported, PUBLIC API function
    fluid.queryIoCSelector = function (root, selector, flat) {
        var parsed = fluid.parseSelector(selector, fluid.IoCSSMatcher);
        var togo = [];

        fluid.visitComponentsForMatching(root, {flat: flat}, function (that, thatStack, contextHashes) {
            if (fluid.matchIoCSelector(parsed, thatStack, contextHashes, [], 1)) {
                togo.push(that);
            }
        });
        return togo;
    };

    fluid.isIoCSSSelector = function (context) {
        return context.indexOf(" ") !== -1; // simple-minded check for an IoCSS reference
    };

    fluid.pushDistributions = function (targetHead, selector, target, blocks) {
        var targetShadow = fluid.shadowForComponent(targetHead);
        var id = fluid.allocateGuid();
        var distribution = {
            id: id, // This id is used in clearDistributions
            target: target, // Here for improved debuggability - info is duplicated in "selector"
            selector: selector,
            blocks: blocks
        };
        Object.freeze(distribution);
        Object.freeze(distribution.blocks);
        fluid.pushArray(targetShadow, "distributions", distribution);
        return id;
    };

    fluid.clearDistribution = function (targetHeadId, id) {
        var targetHeadShadow = fluid.globalInstantiator.idToShadow[targetHeadId];
        // By FLUID-6193, the head component may already have been destroyed, in which case the distributions are gone,
        // and we have leaked only its id. In theory we may want to re-establish the distribution if the head is
        // re-created, but that is a far wider issue.
        if (targetHeadShadow) {
            fluid.remove_if(targetHeadShadow.distributions, function (distribution) {
                return distribution.id === id;
            });
        }
    };

    fluid.clearDistributions = function (shadow) {
        fluid.each(shadow.outDistributions, function (outDist) {
            fluid.clearDistribution(outDist.targetHeadId, outDist.distributionId);
        });
    };

    // Modifies a parsed selector to extract and remove its head context which will be matched upwards
    fluid.extractSelectorHead = function (parsedSelector) {
        var predList = parsedSelector[0].predList;
        var context = predList[0].context;
        predList.length = 0;
        return context;
    };

    fluid.parseExpectedOptionsPath = function (path, role) {
        var segs = fluid.model.parseEL(path);
        if (segs[0] !== "options") {
            fluid.fail("Error in options distribution path ", path, " - only " + role + " paths beginning with \"options\" are supported");
        }
        return segs.slice(1);
    };

    fluid.replicateProperty = function (source, property, targets) {
        if (source[property] !== undefined) {
            fluid.each(targets, function (target) {
                target[property] = source[property];
            });
        }
    };

    fluid.undistributableOptions = ["gradeNames", "distributeOptions", "argumentMap", "initFunction", "mergePolicy", "progressiveCheckerOptions"]; // automatically added to "exclusions" of every distribution

    fluid.distributeOptions = function (that, optionsStrategy) {
        var thatShadow = fluid.shadowForComponent(that);
        var records = fluid.driveStrategy(that.options, "distributeOptions", optionsStrategy);
        fluid.each(records, function distributeOptionsOne(record) {
            fluid.pushActivity("distributeOptions", "parsing distributeOptions block %record %that ", {that: that, record: record});
            if (typeof(record.target) !== "string") {
                fluid.fail("Error in options distribution record ", record, " a member named \"target\" must be supplied holding an IoC reference");
            }
            if (typeof(record.source) === "string" ^ record.record === undefined) {
                fluid.fail("Error in options distribution record ", record, ": must supply either a member \"source\" holding an IoC reference or a member \"record\" holding a literal record");
            }
            var targetRef = fluid.parseContextReference(record.target);
            var targetHead, selector, context;
            if (fluid.isIoCSSSelector(targetRef.context)) {
                selector = fluid.parseSelector(targetRef.context, fluid.IoCSSMatcher);
                var headContext = fluid.extractSelectorHead(selector);
                if (headContext === "/") {
                    targetHead = fluid.rootComponent;
                } else {
                    context = headContext;
                }
            }
            else {
                context = targetRef.context;
            }
            targetHead = targetHead || fluid.resolveContext(context, that);
            if (!targetHead) {
                fluid.fail("Error in options distribution record ", record, " - could not resolve context {" + context + "} to a head component");
            }
            var targetSegs = fluid.model.parseEL(targetRef.path);
            var preBlocks;
            if (record.record !== undefined) {
                preBlocks = [(fluid.makeDistributionRecord(that, record.record, [], targetSegs, []))];
            }
            else {
                var source = fluid.parseContextReference(record.source);
                if (source.context !== "that") {
                    fluid.fail("Error in options distribution record ", record, " only a context of {that} is supported");
                }
                var sourceSegs = fluid.parseExpectedOptionsPath(source.path, "source");
                var fullExclusions = fluid.makeArray(record.exclusions).concat(sourceSegs.length === 0 ? fluid.undistributableOptions : []);

                var exclusions = fluid.transform(fullExclusions, function (exclusion) {
                    return fluid.model.parseEL(exclusion);
                });

                preBlocks = fluid.filterBlocks(that, thatShadow.mergeOptions.mergeBlocks, sourceSegs, targetSegs, exclusions, record.removeSource);
                thatShadow.mergeOptions.updateBlocks(); // perhaps unnecessary
            }
            fluid.replicateProperty(record, "priority", preBlocks);
            fluid.replicateProperty(record, "namespace", preBlocks);
            // TODO: inline material has to be expanded in its original context!

            if (selector) {
                var distributionId = fluid.pushDistributions(targetHead, selector, record.target, preBlocks);
                thatShadow.outDistributions = thatShadow.outDistributions || [];
                thatShadow.outDistributions.push({
                    targetHeadId: targetHead.id,
                    distributionId: distributionId
                });
            }
            else { // The component exists now, we must rebalance it
                var targetShadow = fluid.shadowForComponent(targetHead);
                fluid.applyDistributions(that, preBlocks, targetShadow);
            }
            fluid.popActivity();
        });
    };

    fluid.gradeNamesToHash = function (gradeNames) {
        var contextHash = {};
        fluid.each(gradeNames, function (gradeName) {
            contextHash[gradeName] = true;
            contextHash[fluid.computeNickName(gradeName)] = true;
        });
        return contextHash;
    };

    fluid.cacheShadowGrades = function (that, shadow) {
        var contextHash = fluid.gradeNamesToHash(that.options.gradeNames);
        if (!contextHash[shadow.memberName]) {
            contextHash[shadow.memberName] = "memberName"; // This is filtered out again in recordComponent - TODO: Ensure that ALL resolution uses the scope chain eventually
        }
        shadow.contextHash = contextHash;
        fluid.each(contextHash, function (troo, context) {
            shadow.ownScope[context] = that;
            if (shadow.parentShadow && shadow.parentShadow.that.type !== "fluid.rootComponent") {
                shadow.parentShadow.childrenScope[context] = that;
            }
        });
    };

    // First sequence point where the mergeOptions strategy is delivered from Fluid.js - here we take care
    // of both receiving and transmitting options distributions
    fluid.deliverOptionsStrategy = function (that, target, mergeOptions) {
        var shadow = fluid.shadowForComponent(that, shadow);
        fluid.cacheShadowGrades(that, shadow);
        shadow.mergeOptions = mergeOptions;
    };

    /** Dynamic grade closure algorithm - the following 4 functions share access to a small record structure "rec" which is
     * constructed at the start of fluid.computeDynamicGrades
     */

    fluid.collectDistributedGrades = function (rec) {
        // Receive distributions first since these may cause arrival of more contextAwareness blocks.
        var distributedBlocks = fluid.receiveDistributions(null, null, null, rec.that);
        if (distributedBlocks.length > 0) {
            var readyBlocks = fluid.applyDistributions(rec.that, distributedBlocks, rec.shadow);
            var gradeNamesList = fluid.transform(fluid.getMembers(readyBlocks, ["source", "gradeNames"]), fluid.makeArray);
            fluid.accumulateDynamicGrades(rec, fluid.flatten(gradeNamesList));
        }
    };
    // Apply a batch of freshly acquired plain dynamic grades to the target component and recompute its options
    fluid.applyDynamicGrades = function (rec) {
        rec.oldGradeNames = fluid.makeArray(rec.gradeNames);
        // Note that this crude algorithm doesn't allow us to determine which grades are "new" and which not // TODO: can no longer interpret comment
        var newDefaults = fluid.copy(fluid.getMergedDefaults(rec.that.typeName, rec.gradeNames));
        rec.gradeNames.length = 0; // acquire derivatives of dynamic grades (FLUID-5054)
        rec.gradeNames.push.apply(rec.gradeNames, newDefaults.gradeNames);

        fluid.each(rec.gradeNames, function (gradeName) {
            if (!fluid.isReferenceOrExpander(gradeName)) {
                rec.seenGrades[gradeName] = true;
            }
        });

        var shadow = rec.shadow;
        fluid.cacheShadowGrades(rec.that, shadow);
        // This cheap strategy patches FLUID-5091 for now - some more sophisticated activity will take place
        // at this site when we have a full fix for FLUID-5028
        shadow.mergeOptions.destroyValue(["mergePolicy"]);
        // TODO: Why do we do this given as we decided we are not responsive to it?
        shadow.mergeOptions.destroyValue(["components"]);
        shadow.mergeOptions.destroyValue(["invokers"]);

        rec.defaultsBlock.source = newDefaults;
        shadow.mergeOptions.updateBlocks();
        shadow.mergeOptions.computeMergePolicy(); // TODO: we should really only do this if its content changed - this implies moving all options evaluation over to some (cheap) variety of the ChangeApplier

        fluid.accumulateDynamicGrades(rec, newDefaults.gradeNames);
    };

    // Filter some newly discovered grades into their plain and dynamic queues
    fluid.accumulateDynamicGrades = function (rec, newGradeNames) {
        fluid.each(newGradeNames, function (gradeName) {
            var flatGradeName = fluid.flattenGradeName(gradeName);
            if (!rec.seenGrades[flatGradeName]) {
                if (fluid.isReferenceOrExpander(gradeName)) {
                    rec.rawDynamic.push(gradeName);
                    rec.seenGrades[flatGradeName] = true;
                } else if (!fluid.contains(rec.oldGradeNames, gradeName)) {
                    rec.plainDynamic.push(gradeName);
                }
            }
        });
    };

    fluid.accumulateContextAwareGrades = function (that, rec) {
        var newContextAware = [];
        if (fluid.contains(rec.gradeNames, "fluid.contextAware")) {
            var contextAwarenessOptions = fluid.getForComponent(that, ["options", "contextAwareness"]);
            newContextAware = fluid.contextAware.check(that, contextAwarenessOptions);
            var lostGrade = fluid.find_if(rec.contextAware, function (gradeName) {
                return !fluid.contains(newContextAware, gradeName);
            });
            if (lostGrade) { // The user really deserves a prize if they achieve this diagnostic
                fluid.fail("Failure operating contextAwareness definition ", contextAwarenessOptions, " for component " + fluid.dumpComponentAndPath(that)
                    + ": grade name " + lostGrade + " returned by an earlier round of checks was lost through a context change caused by a raw dynamic grade");
            }
            rec.contextAware = newContextAware;
        }
        return newContextAware;
    };

    fluid.computeDynamicGrades = function (that, shadow, strategy) {
        delete that.options.gradeNames; // Recompute gradeNames for FLUID-5012 and others
        var gradeNames = fluid.driveStrategy(that.options, "gradeNames", strategy); // Just acquire the reference and force eval of mergeBlocks "target", contents are wrong
        gradeNames.length = 0;
        // TODO: In complex distribution cases, a component might end up with multiple default blocks
        var defaultsBlock = fluid.findMergeBlocks(shadow.mergeOptions.mergeBlocks, "defaults")[0];

        var rec = {
            that: that,
            shadow: shadow,
            defaultsBlock: defaultsBlock,
            gradeNames: gradeNames, // remember that this array is globally shared
            seenGrades: {},
            plainDynamic: [], // unshared, accumulates any directly seen grades and their derivatives seen on one cycle
            contextAware: [],
            rawDynamic: []
        };
        fluid.each(shadow.mergeOptions.mergeBlocks, function (block) { // acquire parents of earlier blocks before applying later ones
            gradeNames.push.apply(gradeNames, fluid.makeArray(block.target && block.target.gradeNames));
            fluid.applyDynamicGrades(rec);
        });
        fluid.collectDistributedGrades(rec);
        var checkContextAware = true; // Make a fresh check for contextAware grades after every contribution from raw dynamics
        while (true) {
            while (rec.plainDynamic.length > 0) {
                gradeNames.push.apply(gradeNames, rec.plainDynamic);
                rec.plainDynamic.length = 0;
                fluid.applyDynamicGrades(rec);
                fluid.collectDistributedGrades(rec);
            }
            if (checkContextAware) {
                var newContextAware = fluid.accumulateContextAwareGrades(that, rec);
                rec.plainDynamic = rec.plainDynamic.concat(newContextAware);
                checkContextAware = false;
            } else if (rec.rawDynamic.length > 0) {
                var expanded = fluid.expandImmediate(rec.rawDynamic.shift(), that, shadow.localRecord);
                if (typeof(expanded) === "function") {
                    expanded = expanded();
                }
                if (expanded) {
                    rec.plainDynamic = rec.plainDynamic.concat(expanded);
                }
                checkContextAware = true;
            } else {
                break;
            }
        }
        fluid.remove_if(gradeNames, fluid.isReferenceOrExpander);

        if (shadow.collectedClearer) {
            shadow.collectedClearer();
            delete shadow.collectedClearer;
        }
    };
    fluid.computeDynamicComponentKey = function (recordKey, sourceKey) {
        return recordKey + (sourceKey === 0 ? "" : "-" + sourceKey); // TODO: configurable name strategies
    };
    // Hacked resolution of FLUID-6371 - we can't add a listener because this version of the framework doesn't
    // support multiple records as subcomponents, and there may have been a total options injection
    fluid.hasDynamicComponentCount = function (shadow, key) {
        var hypos = key.indexOf("-");
        if (hypos !== -1) {
            var recordKey = key.substring(0, hypos);
            return shadow.dynamicComponentCount !== undefined && shadow.dynamicComponentCount[recordKey] !== undefined;
        }
    };

    fluid.clearDynamicParentRecord = function (shadow, key) {
        if (fluid.hasDynamicComponentCount(shadow, key)) {
            var holder = fluid.get(shadow.that, ["options", "components"]);
            if (holder) {
                delete holder[key];
            }
        }
    };

    fluid.registerDynamicRecord = function (that, recordKey, sourceKey, record, toCensor) {
        var key = fluid.computeDynamicComponentKey(recordKey, sourceKey);
        var recordCopy = fluid.copy(record);
        delete recordCopy[toCensor];
        fluid.set(that.options, ["components", key], recordCopy);
        return key;
    };

    fluid.computeDynamicComponents = function (that, mergeOptions) {
        var shadow = fluid.shadowForComponent(that);
        var localSub = shadow.subcomponentLocal = {};
        var records = fluid.driveStrategy(that.options, "dynamicComponents", mergeOptions.strategy);
        fluid.each(records, function (record, recordKey) {
            if (!record.sources && !record.createOnEvent) {
                fluid.fail("Cannot process dynamicComponents record ", record, " without a \"sources\" or \"createOnEvent\" entry");
            }
            if (record.sources) {
                var sources = fluid.expandOptions(record.sources, that);
                fluid.each(sources, function (source, sourceKey) {
                    var key = fluid.registerDynamicRecord(that, recordKey, sourceKey, record, "sources");
                    localSub[key] = {"source": source, "sourcePath": sourceKey};
                });
            }
            else if (record.createOnEvent) {
                var event = fluid.event.expandOneEvent(that, record.createOnEvent);
                fluid.set(shadow, ["dynamicComponentCount", recordKey], 0);
                var listener = function () {
                    var key = fluid.registerDynamicRecord(that, recordKey, shadow.dynamicComponentCount[recordKey]++, record, "createOnEvent");
                    var localRecord = {"arguments": fluid.makeArray(arguments)};
                    fluid.initDependent(that, key, localRecord);
                };
                event.addListener(listener);
                fluid.recordListener(event, listener, shadow);
            }
        });
    };

    // Second sequence point for mergeOptions from Fluid.js - here we construct all further
    // strategies required on the IoC side and mount them into the shadow's getConfig for universal use
    fluid.computeComponentAccessor = function (that, localRecord) {
        var instantiator = fluid.globalInstantiator;
        var shadow = fluid.shadowForComponent(that);
        shadow.localRecord = localRecord; // for signalling to dynamic grades from dynamic components
        var options = that.options;
        var strategy = shadow.mergeOptions.strategy;
        var optionsStrategy = fluid.mountStrategy(["options"], options, strategy);
        shadow.invokerStrategy = fluid.recordStrategy(that, options, strategy, "invokers", fluid.invokerFromRecord);
        shadow.eventStrategyBlock = fluid.recordStrategy(that, options, strategy, "events", fluid.eventFromRecord, ["events"]);
        var eventStrategy = fluid.mountStrategy(["events"], that, shadow.eventStrategyBlock.strategy, ["events"]);
        shadow.memberStrategy = fluid.recordStrategy(that, options, strategy, "members", fluid.memberFromRecord, null, {model: true, modelRelay: true});
        // NB - ginger strategy handles concrete, rationalise
        shadow.getConfig = {strategies: [fluid.model.funcResolverStrategy, fluid.makeGingerStrategy(that),
            optionsStrategy, shadow.invokerStrategy.strategy, shadow.memberStrategy.strategy, eventStrategy]};

        fluid.computeDynamicGrades(that, shadow, strategy, shadow.mergeOptions.mergeBlocks);
        fluid.distributeOptions(that, strategy);
        if (shadow.contextHash["fluid.resolveRoot"]) {
            var memberName;
            if (shadow.contextHash["fluid.resolveRootSingle"]) {
                var singleRootType = fluid.getForComponent(that, ["options", "singleRootType"]);
                if (!singleRootType) {
                    fluid.fail("Cannot register object with grades " + Object.keys(shadow.contextHash).join(", ") + " as fluid.resolveRootSingle since it has not defined option singleRootType");
                }
                memberName = fluid.typeNameToMemberName(singleRootType);
            } else {
                memberName = fluid.computeGlobalMemberName(that);
            }
            var parent = fluid.resolveRootComponent;
            if (parent[memberName]) {
                instantiator.clearComponent(parent, memberName);
            }
            instantiator.recordKnownComponent(parent, that, memberName, false);
        }

        return shadow.getConfig;
    };

    // About the SHADOW:
    // Allocated at: instantiator's "recordComponent"
    // Contents:
    //     path {String} Principal allocated path (point of construction) in tree
    //     that {Component} The component itself
    //     contextHash {String to Boolean} Map of context names which this component matches
    //     mergePolicy, mergeOptions: Machinery for last phase of options merging
    //     invokerStrategy, eventStrategyBlock, memberStrategy, getConfig: Junk required to operate the accessor
    //     listeners: Listeners registered during this component's construction, to be cleared during clearListeners
    //     distributions, collectedClearer: Managing options distributions
    //     outDistributions: A list of distributions registered from this component, signalling from distributeOptions to clearDistributions
    //     subcomponentLocal: Signalling local record from computeDynamicComponents to assembleCreatorArguments
    //     dynamicLocal: Local signalling for dynamic grades
    //     ownScope: A hash of names to components which are in scope from this component - populated in cacheShadowGrades
    //     childrenScope: A hash of names to components which are in scope because they are children of this component (BELOW own ownScope in resolution order)

    fluid.shadowForComponent = function (component) {
        var instantiator = fluid.getInstantiator(component);
        return instantiator && component ? instantiator.idToShadow[component.id] : null;
    };

    // Access the member at a particular path in a component, forcing it to be constructed gingerly if necessary
    // supported, PUBLIC API function
    fluid.getForComponent = function (component, path) {
        var shadow = fluid.shadowForComponent(component);
        var getConfig = shadow ? shadow.getConfig : undefined;
        return fluid.get(component, path, getConfig);
    };

    // An EL segment resolver strategy that will attempt to trigger creation of
    // components that it discovers along the EL path, if they have been defined but not yet
    // constructed.
    fluid.makeGingerStrategy = function (that) {
        var instantiator = fluid.getInstantiator(that);
        return function (component, thisSeg, index, segs) {
            var atval = component[thisSeg];
            if (atval === fluid.inEvaluationMarker && index === segs.length) {
                fluid.fail("Error in component configuration - a circular reference was found during evaluation of path segment \"" + thisSeg +
                    "\": for more details, see the activity records following this message in the console, or issue fluid.setLogging(fluid.logLevel.TRACE) when running your application");
            }
            if (index > 1) {
                return atval;
            }
            if (atval === undefined && component.hasOwnProperty(thisSeg)) { // avoid recomputing properties that have been explicitly evaluated to undefined
                return fluid.NO_VALUE;
            }
            if (atval === undefined) { // pick up components in instantiation here - we can cut this branch by attaching early
                var parentPath = instantiator.idToShadow[component.id].path;
                var childPath = instantiator.composePath(parentPath, thisSeg);
                atval = instantiator.pathToComponent[childPath];
            }
            if (atval === undefined) {
                // TODO: This check is very expensive - once gingerness is stable, we ought to be able to
                // eagerly compute and cache the value of options.components - check is also incorrect and will miss injections
                var subRecord = fluid.getForComponent(component, ["options", "components", thisSeg]);
                if (subRecord) {
                    if (subRecord.createOnEvent) {
                        fluid.fail("Error resolving path segment \"" + thisSeg + "\" of path " + segs.join(".") + " since component with record ", subRecord,
                            " has annotation \"createOnEvent\" - this very likely represents an implementation error. Either alter the reference so it does not " +
                            " match this component, or alter your workflow to ensure that the component is instantiated by the time this reference resolves");
                    }
                    fluid.initDependent(component, thisSeg);
                    atval = component[thisSeg];
                }
            }
            return atval;
        };
    };

    // Listed in dependence order
    fluid.frameworkGrades = ["fluid.component", "fluid.modelComponent", "fluid.viewComponent", "fluid.rendererComponent"];

    fluid.filterBuiltinGrades = function (gradeNames) {
        return fluid.remove_if(fluid.makeArray(gradeNames), function (gradeName) {
            return fluid.frameworkGrades.indexOf(gradeName) !== -1;
        });
    };

    fluid.dumpGradeNames = function (that) {
        return that.options && that.options.gradeNames ?
            " gradeNames: " + JSON.stringify(fluid.filterBuiltinGrades(that.options.gradeNames)) : "";
    };

    fluid.dumpThat = function (that) {
        return "{ typeName: \"" + that.typeName + "\"" + fluid.dumpGradeNames(that) + " id: " + that.id + "}";
    };

    fluid.dumpThatStack = function (thatStack, instantiator) {
        var togo = fluid.transform(thatStack, function (that) {
            var path = instantiator.idToPath(that.id);
            return fluid.dumpThat(that) + (path ? (" - path: " + path) : "");
        });
        return togo.join("\n");
    };

    fluid.dumpComponentPath = function (that) {
        var path = fluid.pathForComponent(that);
        return path ? fluid.pathUtil.composeSegments(path) : "** no path registered for component **";
    };

    fluid.resolveContext = function (context, that, fast) {
        if (context === "that") {
            return that;
        }
        // TODO: Check performance impact of this type check introduced for FLUID-5903 in a very sensitive corner
        if (typeof(context) === "object") {
            var innerContext = fluid.resolveContext(context.context, that, fast);
            if (!fluid.isComponent(innerContext)) {
                fluid.triggerMismatchedPathError(context.context, that);
            }
            var rawValue = fluid.getForComponent(innerContext, context.path);
            // TODO: Terrible, slow dispatch for this route
            var expanded = fluid.expandOptions(rawValue, that);
            if (!fluid.isComponent(expanded)) {
                fluid.fail("Unable to resolve recursive context expression " + fluid.renderContextReference(context) + ": the directly resolved value of " + rawValue +
                     " did not resolve to a component in the scope of component ", that, ": got ", expanded);
            }
            return expanded;
        } else {
            var foundComponent;
            var instantiator = fluid.globalInstantiator; // fluid.getInstantiator(that); // this hash lookup takes over 1us!
            if (fast) {
                var shadow = instantiator.idToShadow[that.id];
                return shadow.ownScope[context];
            } else {
                var thatStack = instantiator.getFullStack(that);
                fluid.visitComponentsForVisibility(instantiator, thatStack, function (component, name) {
                    var shadow = fluid.shadowForComponent(component);
                    // TODO: Some components, e.g. the static environment and typeTags do not have a shadow, which slows us down here
                    if (context === name || shadow && shadow.contextHash && shadow.contextHash[context] || context === component.typeName) {
                        foundComponent = component;
                        return true; // YOUR VISIT IS AT AN END!!
                    }
                    if (fluid.getForComponent(component, ["options", "components", context]) && !component[context]) {
                        // This is an expensive guess since we make it for every component up the stack - must apply the WAVE OF EXPLOSIONS (FLUID-4925) to discover all components first
                        // This line attempts a hopeful construction of components that could be guessed by nickname through finding them unconstructed
                        // in options. In the near future we should eagerly BEGIN the process of constructing components, discovering their
                        // types and then attaching them to the tree VERY EARLY so that we get consistent results from different strategies.
                        foundComponent = fluid.getForComponent(component, context);
                        return true;
                    }
                });
                return foundComponent;
            }
        }
    };

    fluid.triggerMismatchedPathError = function (parsed, parentThat) {
        var ref = fluid.renderContextReference(parsed);
        fluid.fail("Failed to resolve reference " + ref + " - could not match context with name " +
            parsed.context + " from component " + fluid.dumpThat(parentThat) + " at path " + fluid.dumpComponentPath(parentThat) + " component: " , parentThat);
    };

    fluid.makeStackFetcher = function (parentThat, localRecord, fast) {
        var fetcher = function (parsed) {
            if (parentThat && parentThat.lifecycleStatus === "destroyed") {
                fluid.fail("Cannot resolve reference " + fluid.renderContextReference(parsed) + " from component " + fluid.dumpThat(parentThat) + " which has been destroyed");
            }
            var context = parsed.context;
            if (localRecord && context in localRecord) {
                return fluid.get(localRecord[context], parsed.path);
            }
            var foundComponent = fluid.resolveContext(context, parentThat, fast);
            if (!foundComponent && parsed.path !== "") {
                fluid.triggerMismatchedPathError(parsed, parentThat);
            }
            return fluid.getForComponent(foundComponent, parsed.path);
        };
        return fetcher;
    };

    fluid.makeStackResolverOptions = function (parentThat, localRecord, fast) {
        return $.extend(fluid.copy(fluid.rawDefaults("fluid.makeExpandOptions")), {
            ELstyle: "{}",
            localRecord: localRecord || {},
            fetcher: fluid.makeStackFetcher(parentThat, localRecord, fast),
            contextThat: parentThat,
            exceptions: {members: {model: true, modelRelay: true}}
        });
    };

    fluid.clearListeners = function (shadow) {
        // TODO: bug here - "afterDestroy" listeners will be unregistered already unless they come from this component
        fluid.each(shadow.listeners, function (rec) {
            rec.event.removeListener(rec.listenerId || rec.listener);
        });
        delete shadow.listeners;
    };

    fluid.recordListener = function (event, listener, shadow, listenerId) {
        if (event.ownerId !== shadow.that.id) { // don't bother recording listeners registered from this component itself
            fluid.pushArray(shadow, "listeners", {event: event, listener: listener, listenerId: listenerId});
        }
    };

    fluid.constructScopeObjects = function (instantiator, parent, child, childShadow) {
        var parentShadow = parent ? instantiator.idToShadow[parent.id] : null;
        childShadow.childrenScope = parentShadow ? Object.create(parentShadow.ownScope) : {};
        childShadow.ownScope = Object.create(childShadow.childrenScope);
        childShadow.parentShadow = parentShadow;
    };

    fluid.clearChildrenScope = function (instantiator, parentShadow, child, childShadow) {
        fluid.each(childShadow.contextHash, function (troo, context) {
            if (parentShadow.childrenScope[context] === child) {
                delete parentShadow.childrenScope[context]; // TODO: ambiguous resolution
            }
        });
    };

    // unsupported, non-API function - however, this structure is of considerable interest to those debugging
    // into IoC issues. The structures idToShadow and pathToComponent contain a complete map of the component tree
    // forming the surrounding scope
    fluid.instantiator = function () {
        var that = fluid.typeTag("instantiator");
        $.extend(that, {
            lifecycleStatus: "constructed",
            pathToComponent: {},
            idToShadow: {},
            modelTransactions: {init: {}}, // a map of transaction id to map of component id to records of components enlisted in a current model initialisation transaction
            composePath: fluid.model.composePath, // For speed, we declare that no component's name may contain a period
            composeSegments: fluid.model.composeSegments,
            parseEL: fluid.model.parseEL,
            events: {
                onComponentAttach: fluid.makeEventFirer({name: "instantiator's onComponentAttach event"}),
                onComponentClear: fluid.makeEventFirer({name: "instantiator's onComponentClear event"})
            }
        });
        // TODO: this API can shortly be removed
        that.idToPath = function (id) {
            var shadow = that.idToShadow[id];
            return shadow ? shadow.path : "";
        };
        // Note - the returned stack is assumed writeable and does not include the root
        that.getThatStack = function (component) {
            var shadow = that.idToShadow[component.id];
            if (shadow) {
                var path = shadow.path;
                var parsed = that.parseEL(path);
                var root = that.pathToComponent[""], togo = [];
                for (var i = 0; i < parsed.length; ++i) {
                    root = root[parsed[i]];
                    togo.push(root);
                }
                return togo;
            }
            else { return [];}
        };
        that.getFullStack = function (component) {
            var thatStack = component ? that.getThatStack(component) : [];
            thatStack.unshift(fluid.resolveRootComponent);
            return thatStack;
        };
        function recordComponent(parent, component, path, name, created) {
            var shadow;
            if (created) {
                shadow = that.idToShadow[component.id] = {};
                shadow.that = component;
                shadow.path = path;
                shadow.memberName = name;
                fluid.constructScopeObjects(that, parent, component, shadow);
            } else {
                shadow = that.idToShadow[component.id];
                shadow.injectedPaths = shadow.injectedPaths || {}; // a hash since we will modify whilst iterating
                shadow.injectedPaths[path] = true;
                var parentShadow = that.idToShadow[parent.id]; // structural parent shadow - e.g. resolveRootComponent
                var keys = fluid.keys(shadow.contextHash);
                fluid.remove_if(keys, function (key) {
                    return shadow.contextHash && shadow.contextHash[key] === "memberName";
                });
                keys.push(name); // add local name - FLUID-5696 and FLUID-5820
                fluid.each(keys, function (context) {
                    if (!parentShadow.childrenScope[context]) {
                        parentShadow.childrenScope[context] = component;
                    }
                });
            }
            if (that.pathToComponent[path]) {
                fluid.fail("Error during instantiation - path " + path + " which has just created component " + fluid.dumpThat(component) +
                    " has already been used for component " + fluid.dumpThat(that.pathToComponent[path]) + " - this is a circular instantiation or other oversight." +
                    " Please clear the component using instantiator.clearComponent() before reusing the path.");
            }
            that.pathToComponent[path] = component;
        }
        that.recordRoot = function (component) {
            recordComponent(null, component, "", "", true);
        };
        that.recordKnownComponent = function (parent, component, name, created) {
            parent[name] = component;
            if (fluid.isComponent(component) || component.type === "instantiator") {
                var parentPath = that.idToShadow[parent.id].path;
                var path = that.composePath(parentPath, name);
                recordComponent(parent, component, path, name, created);
                that.events.onComponentAttach.fire(component, path, that, created);
            } else {
                fluid.fail("Cannot record non-component with value ", component, " at path \"" + name + "\" of parent ", parent);
            }
        };
        that.clearConcreteComponent = function (destroyRec) {
            // Clear injected instance of this component from all other paths - historically we didn't bother
            // to do this since injecting into a shorter scope is an error - but now we have resolveRoot area
            fluid.each(destroyRec.childShadow.injectedPaths, function (troo, injectedPath) {
                var parentPath = fluid.model.getToTailPath(injectedPath);
                var otherParent = that.pathToComponent[parentPath];
                that.clearComponent(otherParent, fluid.model.getTailPath(injectedPath), destroyRec.child);
            });
            fluid.clearDistributions(destroyRec.childShadow);
            fluid.clearListeners(destroyRec.childShadow);
            fluid.clearDynamicParentRecord(destroyRec.shadow, destroyRec.name);
            fluid.fireEvent(destroyRec.child, "afterDestroy", [destroyRec.child, destroyRec.name, destroyRec.component]);
            delete that.idToShadow[destroyRec.child.id];
        };
        that.clearComponent = function (component, name, child, options, nested, path) {
            // options are visitor options for recursive driving
            var shadow = that.idToShadow[component.id];
            // use flat recursion since we want to use our own recursion rather than rely on "visited" records
            options = options || {flat: true, instantiator: that, destroyRecs: []};
            child = child || component[name];
            path = path || shadow.path;
            if (path === undefined) {
                fluid.fail("Cannot clear component " + name + " from component ", component,
                    " which was not created by this instantiator");
            }

            var childPath = that.composePath(path, name);
            var childShadow = that.idToShadow[child.id];
            if (!childShadow) { // Explicit FLUID-5812 check - this can be eliminated once we move visitComponentChildren to instantiator's records
                return;
            }
            var created = childShadow.path === childPath;
            that.events.onComponentClear.fire(child, childPath, component, created);

            // only recurse on components which were created in place - if the id record disagrees with the
            // recurse path, it must have been injected
            if (created) {
                fluid.visitComponentChildren(child, function (gchild, gchildname, segs, i) {
                    var parentPath = that.composeSegments.apply(null, segs.slice(0, i));
                    that.clearComponent(child, gchildname, null, options, true, parentPath);
                }, options, that.parseEL(childPath));
                fluid.doDestroy(child, name, component); // call "onDestroy", null out events and invokers, setting lifecycleStatus to "destroyed"
                options.destroyRecs.push({child: child, childShadow: childShadow, name: name, component: component, shadow: shadow});
            } else {
                fluid.remove_if(childShadow.injectedPaths, function (troo, path) {
                    return path === childPath;
                });
            }
            fluid.clearChildrenScope(that, shadow, child, childShadow);
            // Note that "pathToComponent" will not be available during afterDestroy. This is so that we can synchronously recreate the component
            // in an afterDestroy listener (FLUID-5931). We don't clear up the shadow itself until after afterDestroy.
            delete that.pathToComponent[childPath];
            if (!nested) {
                delete component[name]; // there may be no entry - if creation is not concluded
                // Do actual destruction for the whole tree here, including "afterDestroy" and deleting shadows
                fluid.each(options.destroyRecs, that.clearConcreteComponent);
            }
        };
        return that;
    };

    // The global instantiator, holding all components instantiated in this context (instance of Infusion)
    fluid.globalInstantiator = fluid.instantiator();

    // Look up the globally registered instantiator for a particular component - we now only really support a
    // single, global instantiator, but this method is left as a notation point in case this ever reverts
    // Returns null if argument is a noncomponent or has no shadow
    fluid.getInstantiator = function (component) {
        var instantiator = fluid.globalInstantiator;
        return component && instantiator.idToShadow[component.id] ? instantiator : null;
    };

    // The grade supplied to components which will be resolvable from all parts of the component tree
    fluid.defaults("fluid.resolveRoot");
    // In addition to being resolvable at the root, "resolveRootSingle" component will have just a single instance available. Fresh
    // instances will displace older ones.
    fluid.defaults("fluid.resolveRootSingle", {
        gradeNames: "fluid.resolveRoot"
    });

    fluid.constructRootComponents = function (instantiator) {
        // Instantiate the primordial components at the root of each context tree
        fluid.rootComponent = instantiator.rootComponent = fluid.typeTag("fluid.rootComponent");
        instantiator.recordRoot(fluid.rootComponent);

        // The component which for convenience holds injected instances of all components with fluid.resolveRoot grade
        fluid.resolveRootComponent = instantiator.resolveRootComponent = fluid.typeTag("fluid.resolveRootComponent");
        instantiator.recordKnownComponent(fluid.rootComponent, fluid.resolveRootComponent, "resolveRootComponent", true);

        // obliterate resolveRoot's scope objects and replace by the real root scope - which is unused by its own children
        var rootShadow = instantiator.idToShadow[fluid.rootComponent.id];
        rootShadow.contextHash = {}; // Fix for FLUID-6128
        var resolveRootShadow = instantiator.idToShadow[fluid.resolveRootComponent.id];
        resolveRootShadow.ownScope = rootShadow.ownScope;
        resolveRootShadow.childrenScope = rootShadow.childrenScope;

        instantiator.recordKnownComponent(fluid.resolveRootComponent, instantiator, "instantiator", true); // needs to have a shadow so it can be injected
        resolveRootShadow.childrenScope.instantiator = instantiator; // needs to be mounted since it never passes through cacheShadowGrades
    };

    fluid.constructRootComponents(fluid.globalInstantiator); // currently a singleton - in future, alternative instantiators might come back

    /*
     * Expand a set of component options either immediately, or with deferred effect.
     *  The current policy is to expand immediately function arguments within fluid.assembleCreatorArguments which are not the main options of a
     *  component. The component's own options take <code>{defer: true}</code> as part of
     *  <code>outerExpandOptions</code> which produces an "expandOptions" structure holding the "strategy" and "initter" pattern
     *  common to ginger participants.
     *  Probably not to be advertised as part of a public API, but is considerably more stable than most of the rest
     *  of the IoC API structure especially with respect to the first arguments.
     */

    // TODO: Can we move outerExpandOptions to 2nd place? only user of 3 and 4 is fluid.makeExpandBlock
    // TODO: Actually we want localRecord in 2nd place since outerExpandOptions is now almost disused
    fluid.expandOptions = function (args, that, mergePolicy, localRecord, outerExpandOptions) {
        if (!args) {
            return args;
        }
        fluid.pushActivity("expandOptions", "expanding options %args for component %that ", {that: that, args: args});
        var expandOptions = fluid.makeStackResolverOptions(that, localRecord);
        expandOptions.mergePolicy = mergePolicy;
        expandOptions.defer = outerExpandOptions && outerExpandOptions.defer;
        var expanded = expandOptions.defer ?
            fluid.makeExpandOptions(args, expandOptions) : fluid.expand(args, expandOptions);
        fluid.popActivity();
        return expanded;
    };

    fluid.localRecordExpected = fluid.arrayToHash(["type", "options", "container", "createOnEvent", "priority", "recordType"]); // last element unavoidably polluting

    fluid.checkComponentRecord = function (localRecord) {
        fluid.each(localRecord, function (value, key) {
            if (!fluid.localRecordExpected[key]) {
                fluid.fail("Probable error in subcomponent record ", localRecord, " - key \"" + key +
                    "\" found, where the only legal options are " +
                    fluid.keys(fluid.localRecordExpected).join(", "));
            }
        });
    };

    fluid.mergeRecordsToList = function (that, mergeRecords) {
        var list = [];
        fluid.each(mergeRecords, function (value, key) {
            value.recordType = key;
            if (key === "distributions") {
                list.push.apply(list, fluid.transform(value, function (distributedBlock) {
                    return fluid.computeDistributionPriority(that, distributedBlock);
                }));
            }
            else {
                if (!value.options) { return; }
                value.priority = fluid.mergeRecordTypes[key];
                if (value.priority === undefined) {
                    fluid.fail("Merge record with unrecognised type " + key + ": ", value);
                }
                list.push(value);
            }
        });
        return list;
    };

    // TODO: overall efficiency could huge be improved by resorting to the hated PROTOTYPALISM as an optimisation
    // for this mergePolicy which occurs in every component. Although it is a deep structure, the root keys are all we need
    var addPolicyBuiltins = function (policy) {
        fluid.each(["gradeNames", "mergePolicy", "argumentMap", "components", "dynamicComponents", "events", "listeners", "modelListeners", "modelRelay", "distributeOptions", "transformOptions"], function (key) {
            fluid.set(policy, [key, "*", "noexpand"], true);
        });
        return policy;
    };

    // used from Fluid.js
    fluid.generateExpandBlock = function (record, that, mergePolicy, localRecord) {
        var expanded = fluid.expandOptions(record.options, record.contextThat || that, mergePolicy, localRecord, {defer: true});
        expanded.priority = record.priority;
        expanded.namespace = record.namespace;
        expanded.recordType = record.recordType;
        return expanded;
    };

    var expandComponentOptionsImpl = function (mergePolicy, defaults, initRecord, that) {
        var defaultCopy = fluid.copy(defaults);
        addPolicyBuiltins(mergePolicy);
        var shadow = fluid.shadowForComponent(that);
        shadow.mergePolicy = mergePolicy;
        var mergeRecords = {
            defaults: {options: defaultCopy}
        };

        $.extend(mergeRecords, initRecord.mergeRecords);
        // Do this here for gradeless components that were corrected by "localOptions"
        if (mergeRecords.subcomponentRecord) {
            fluid.checkComponentRecord(mergeRecords.subcomponentRecord);
        }

        var expandList = fluid.mergeRecordsToList(that, mergeRecords);

        var togo = fluid.transform(expandList, function (value) {
            return fluid.generateExpandBlock(value, that, mergePolicy, initRecord.localRecord);
        });
        return togo;
    };

    fluid.fabricateDestroyMethod = function (that, name, instantiator, child) {
        return function () {
            instantiator.clearComponent(that, name, child);
        };
    };

    // Computes a name for a component appearing at the global root which is globally unique, from its nickName and id
    fluid.computeGlobalMemberName = function (that) {
        var nickName = fluid.computeNickName(that.typeName);
        return nickName + "-" + that.id;
    };

    // Maps a type name to the member name to be used for it at a particular path level where it is intended to be unique
    // Note that "." is still not supported within a member name
    // supported, PUBLIC API function
    fluid.typeNameToMemberName = function (typeName) {
        return typeName.replace(/\./g, "_");
    };

    // This is the initial entry point from the non-IoC side reporting the first presence of a new component - called from fluid.mergeComponentOptions
    fluid.expandComponentOptions = function (mergePolicy, defaults, userOptions, that) {
        var initRecord = userOptions; // might have been tunnelled through "userOptions" from "assembleCreatorArguments"
        var instantiator = userOptions && userOptions.marker === fluid.EXPAND ? userOptions.instantiator : null;
        fluid.pushActivity("expandComponentOptions", "expanding component options %options with record %record for component %that",
            {options: instantiator ? userOptions.mergeRecords.user : userOptions, record: initRecord, that: that});
        if (!instantiator) { // it is a top-level component which needs to be attached to the global root
            instantiator = fluid.globalInstantiator;
            initRecord = { // upgrade "userOptions" to the same format produced by fluid.assembleCreatorArguments via the subcomponent route
                mergeRecords: {user: {options: fluid.expandCompact(userOptions, true)}},
                memberName: fluid.computeGlobalMemberName(that),
                instantiator: instantiator,
                parentThat: fluid.rootComponent
            };
        }
        that.destroy = fluid.fabricateDestroyMethod(initRecord.parentThat, initRecord.memberName, instantiator, that);

        instantiator.recordKnownComponent(initRecord.parentThat, that, initRecord.memberName, true);
        var togo = expandComponentOptionsImpl(mergePolicy, defaults, initRecord, that);

        fluid.popActivity();
        return togo;
    };

    /*
     * Given a typeName, determine the final concrete
     * "invocation specification" consisting of a concrete global function name
     * and argument list which is suitable to be executed directly by fluid.invokeGlobalFunction.
     */
    // options is just a disposition record containing memberName, componentRecord
    fluid.assembleCreatorArguments = function (parentThat, typeName, options) {
        var upDefaults = fluid.defaults(typeName); // we're not responsive to dynamic changes in argMap, but we don't believe in these anyway
        if (!upDefaults || !upDefaults.argumentMap) {
            fluid.fail("Error in assembleCreatorArguments: cannot look up component type name " + typeName + " to a component creator grade with an argumentMap");
        }

        var fakeThat = {}; // fake "that" for receiveDistributions since we try to match selectors before creation for FLUID-5013
        var distributions = parentThat ? fluid.receiveDistributions(parentThat, upDefaults.gradeNames, options.memberName, fakeThat) : [];
        fluid.each(distributions, function (distribution) { // TODO: The duplicated route for this is in fluid.mergeComponentOptions
            fluid.computeDistributionPriority(parentThat, distribution);
            if (fluid.isPrimitive(distribution.priority)) { // TODO: These should be immutable and parsed just once on registration - but we can't because of crazy target-dependent distance system
                distribution.priority = fluid.parsePriority(distribution.priority, 0, false, "options distribution");
            }
        });
        fluid.sortByPriority(distributions);

        var localRecord = $.extend({}, fluid.censorKeys(options.componentRecord, ["type"]), options.localRecord);

        var argMap = upDefaults.argumentMap;
        var findKeys = Object.keys(argMap).concat(["type"]);

        fluid.each(findKeys, function (name) {
            for (var i = 0; i < distributions.length; ++i) { // Apply non-options material from distributions (FLUID-5013)
                if (distributions[i][name] !== undefined) {
                    localRecord[name] = distributions[i][name];
                }
            }
        });
        typeName = localRecord.type || typeName;

        delete localRecord.type;
        delete localRecord.options;

        var mergeRecords = {distributions: distributions};

        if (options.componentRecord !== undefined) {
            // Deliberately put too many things here so they can be checked in expandComponentOptions (FLUID-4285)
            mergeRecords.subcomponentRecord = $.extend({}, options.componentRecord);
        }
        var args = [];
        fluid.each(argMap, function (index, name) {
            var arg;
            if (name === "options") {
                arg = {
                    marker: fluid.EXPAND,
                    localRecord: localRecord,
                    mergeRecords: mergeRecords,
                    instantiator: fluid.getInstantiator(parentThat),
                    parentThat: parentThat,
                    memberName: options.memberName
                };
            } else {
                var value = localRecord[name];
                arg = fluid.expandImmediate(value, parentThat, localRecord);
            }
            args[index] = arg;
        });

        var togo = {
            args: args,
            funcName: typeName
        };
        return togo;
    };

    /**
     * Instantiate the subcomponent with the supplied name of the supplied top-level component. Although this method
     * is published as part of the Fluid API, it should not be called by general users and may not remain stable. It is
     * currently the only mechanism provided for instantiating components whose definitions are dynamic, and will be
     * replaced in time by dedicated declarative framework described by FLUID-5022.
     *
     * @param {Component} that - The parent component for which the subcomponent is to be instantiated
     * @param {String} name - The name of the component - the index of the options block which configures it as part of the
     * <code>components</code> section of its parent's options
     * @param {Object} [localRecord] - A local scope record keyed by context names which should specially be in scope for this
     * construction, e.g. `arguments`. Primarily for internal framework use.
     * @return {Component} The constructed subcomponent
     */
    fluid.initDependent = function (that, name, localRecord) {
        if (that[name]) { return; } // TODO: move this into strategy
        var component = that.options.components[name];
        var instance;
        var instantiator = fluid.globalInstantiator;
        var shadow = instantiator.idToShadow[that.id];
        localRecord = localRecord || shadow.subcomponentLocal && shadow.subcomponentLocal[name];
        fluid.pushActivity("initDependent", "instantiating dependent component at path \"%path\" with record %record as child of %parent",
            {path: shadow.path + "." + name, record: component, parent: that});

        if (typeof(component) === "string" || component.expander) {
            that[name] = fluid.inEvaluationMarker;
            instance = fluid.expandImmediate(component, that);
            if (instance) {
                instantiator.recordKnownComponent(that, instance, name, false);
            } else {
                delete that[name];
            }
        }
        else if (component.type) {
            var type = fluid.expandImmediate(component.type, that, localRecord);
            if (!type) {
                fluid.fail("Error in subcomponent record: ", component.type, " could not be resolved to a type for component ", name,
                    " of parent ", that);
            }
            var invokeSpec = fluid.assembleCreatorArguments(that, type, {componentRecord: component, memberName: name, localRecord: localRecord});
            instance = fluid.initSubcomponentImpl(that, {type: invokeSpec.funcName}, invokeSpec.args);
        }
        else {
            fluid.fail("Unrecognised material in place of subcomponent " + name + " - no \"type\" field found");
        }
        fluid.popActivity();
        return instance;
    };

    fluid.bindDeferredComponent = function (that, componentName, component) {
        var events = fluid.makeArray(component.createOnEvent);
        fluid.each(events, function (eventName) {
            var event = fluid.isIoCReference(eventName) ? fluid.expandOptions(eventName, that) : that.events[eventName];
            if (!event || !event.addListener) {
                fluid.fail("Error instantiating createOnEvent component with name " + componentName + " of parent ", that, " since event specification " +
                    eventName + " could not be expanded to an event - got ", event);
            }
            event.addListener(function () {
                fluid.pushActivity("initDeferred", "instantiating deferred component %componentName of parent %that due to event %eventName",
                    {componentName: componentName, that: that, eventName: eventName});
                if (that[componentName]) {
                    fluid.globalInstantiator.clearComponent(that, componentName);
                }
                var localRecord = {"arguments": fluid.makeArray(arguments)};
                fluid.initDependent(that, componentName, localRecord);
                fluid.popActivity();
            }, null, component.priority);
        });
    };

    fluid.priorityForComponent = function (component) {
        return component.priority ? component.priority :
            (component.type === "fluid.typeFount" || fluid.hasGrade(fluid.defaults(component.type), "fluid.typeFount")) ?
                "first" : undefined;
    };

    fluid.initDependents = function (that) {
        fluid.pushActivity("initDependents", "instantiating dependent components for component %that", {that: that});
        var shadow = fluid.shadowForComponent(that);
        shadow.memberStrategy.initter();
        shadow.invokerStrategy.initter();

        fluid.getForComponent(that, "modelRelay");
        fluid.getForComponent(that, "model"); // trigger this as late as possible - but must be before components so that child component has model on its onCreate
        if (fluid.isDestroyed(that)) {
            return; // Further fix for FLUID-5869 - if we managed to destroy ourselves through some bizarre model self-reaction, bail out here
        }

        var options = that.options;
        var components = options.components || {};
        var componentSort = [];

        fluid.each(components, function (component, name) {
            if (!component.createOnEvent) {
                var priority = fluid.priorityForComponent(component);
                componentSort.push({namespace: name, priority: fluid.parsePriority(priority)});
            }
            else {
                fluid.bindDeferredComponent(that, name, component);
            }
        });
        fluid.sortByPriority(componentSort);
        fluid.each(componentSort, function (entry) {
            fluid.initDependent(that, entry.namespace);
        });
        if (shadow.subcomponentLocal) {
            fluid.clear(shadow.subcomponentLocal); // still need repo for event-driven dynamic components - abolish these in time
        }
        that.lifecycleStatus = "constructed";
        fluid.assessTreeConstruction(that, shadow);

        fluid.popActivity();
    };

    fluid.assessTreeConstruction = function (that, shadow) {
        var instantiator = fluid.globalInstantiator;
        var thatStack = instantiator.getThatStack(that);
        var unstableUp = fluid.find_if(thatStack, function (that) {
            return that.lifecycleStatus === "constructing";
        });
        if (unstableUp) {
            that.lifecycleStatus = "constructed";
        } else {
            fluid.markSubtree(instantiator, that, shadow.path, "treeConstructed");
        }
    };

    fluid.markSubtree = function (instantiator, that, path, state) {
        that.lifecycleStatus = state;
        fluid.visitComponentChildren(that, function (child, name) {
            var childPath = instantiator.composePath(path, name);
            var childShadow = instantiator.idToShadow[child.id];
            var created = childShadow && childShadow.path === childPath;
            if (created) {
                fluid.markSubtree(instantiator, child, childPath, state);
            }
        }, {flat: true});
    };


    /* == BEGIN NEXUS METHODS == */

    /**
     * Given a component reference, returns the path of that component within its component tree.
     *
     * @param {Component} component - A reference to a component.
     * @param {Instantiator} [instantiator] - (optional) An instantiator to use for the lookup.
     * @return {String[]} An array of {String} path segments of the component within its tree, or `null` if the reference does not hold a live component.
     */
    fluid.pathForComponent = function (component, instantiator) {
        instantiator = instantiator || fluid.getInstantiator(component) || fluid.globalInstantiator;
        var shadow = instantiator.idToShadow[component.id];
        if (!shadow) {
            return null;
        }
        return instantiator.parseEL(shadow.path);
    };

    /**
     * Construct a component with the supplied options at the specified path in the component tree. The parent path of the location must already be a component.
     *
     * @param {String|String[]} path - Path where the new component is to be constructed, represented as a string or array of string segments
     * @param {Object} options - Top-level options supplied to the component - must at the very least include a field <code>type</code> holding the component's type
     * @param {Instantiator} [instantiator] - [optional] The instantiator holding the component to be created - if blank, the global instantiator will be used
     * @return {Object} The constructed component.
     */
    fluid.construct = function (path, options, instantiator) {
        var record = fluid.destroy(path, instantiator);
        // TODO: We must construct a more principled scheme for designating child components than this - especially once options become immutable
        fluid.set(record.parent, ["options", "components", record.memberName], {
            type: options.type,
            options: options
        });
        return fluid.initDependent(record.parent, record.memberName);
    };

    /**
     * Destroys a component held at the specified path. The parent path must represent a component, although the component itself may be nonexistent
     *
     * @param {String|String[]} path - Path where the new component is to be destroyed, represented as a string or array of string segments
     * @param {Instantiator} [instantiator] - [optional] The instantiator holding the component to be destroyed - if blank, the global instantiator will be used.
     * @return {Object} - An object containing a reference to the parent of the destroyed element, and the member name of the destroyed component.
     */
    fluid.destroy = function (path, instantiator) {
        instantiator = instantiator || fluid.globalInstantiator;
        var segs = fluid.model.parseToSegments(path, instantiator.parseEL, true);
        if (segs.length === 0) {
            fluid.fail("Cannot destroy the root component");
        }
        var memberName = segs.pop(), parentPath = instantiator.composeSegments.apply(null, segs);
        var parent = instantiator.pathToComponent[parentPath];
        if (!parent) {
            fluid.fail("Cannot modify component with nonexistent parent at path ", path);
        }
        if (parent[memberName]) {
            parent[memberName].destroy();
        }
        return {
            parent: parent,
            memberName: memberName
        };
    };

    /**
     * Construct an instance of a component as a child of the specified parent, with a well-known, unique name derived from its typeName
     *
     * @param {String|String[]} parentPath - Parent of path where the new component is to be constructed, represented as a {String} or array of {String} segments
     * @param {String|Object} options - Options encoding the component to be constructed. If this is of type String, it is assumed to represent the component's typeName with no options
     * @param {Instantiator} [instantiator] - [optional] The instantiator holding the component to be created - if blank, the global instantiator will be used
     */
    fluid.constructSingle = function (parentPath, options, instantiator) {
        instantiator = instantiator || fluid.globalInstantiator;
        parentPath = parentPath || "";
        var segs = fluid.model.parseToSegments(parentPath, instantiator.parseEL, true);
        if (typeof(options) === "string") {
            options = {type: options};
        }
        var type = options.type;
        if (!type) {
            fluid.fail("Cannot construct singleton object without a type entry");
        }
        options = $.extend({}, options);
        var gradeNames = options.gradeNames = fluid.makeArray(options.gradeNames);
        gradeNames.unshift(type); // principal type may be noninstantiable
        options.type = "fluid.component";
        var root = segs.length === 0;
        if (root) {
            gradeNames.push("fluid.resolveRoot");
        }
        var memberName = fluid.typeNameToMemberName(options.singleRootType || type);
        segs.push(memberName);
        fluid.construct(segs, options, instantiator);
    };

    /**
     * Destroy an instance created by `fluid.constructSingle`
     *
     * @param {String|String[]} parentPath - Parent of path where the new component is to be constructed, represented as a {String} or array of {String} segments
     * @param {String} typeName - The type name used to construct the component (either `type` or `singleRootType` of the `options` argument to `fluid.constructSingle`
     * @param {Instantiator} [instantiator] - [optional] The instantiator holding the component to be created - if blank, the global instantiator will be used
     */
    fluid.destroySingle = function (parentPath, typeName, instantiator) {
        instantiator = instantiator || fluid.globalInstantiator;
        var segs = fluid.model.parseToSegments(parentPath, instantiator.parseEL, true);
        var memberName = fluid.typeNameToMemberName(typeName);
        segs.push(memberName);
        fluid.destroy(segs, instantiator);
    };

    /**
     * Registers and constructs a "linkage distribution" which will ensure that wherever a set of "input grades" co-occur, they will
     * always result in a supplied "output grades" in the component where they co-occur.
     *
     * @param {String} linkageName - The name of the grade which will broadcast the resulting linkage. If required, this linkage can be destroyed by supplying this name to `fluid.destroySingle`.
     * @param {String[]} inputNames - An array of grade names which will be tested globally for co-occurrence
     * @param {String|String[]} outputNames - A single grade name or array of grade names which will be output into the co-occuring component
     */
    fluid.makeGradeLinkage = function (linkageName, inputNames, outputNames) {
        fluid.defaults(linkageName, {
            gradeNames: "fluid.component",
            distributeOptions: {
                record: outputNames,
                target: "{/ " + inputNames.join("&") + "}.options.gradeNames"
            }
        });
        fluid.constructSingle([], linkageName);
    };

    /**
     * Retrieves a component by global path.
     *
     * @param {String|String[]} path - The global path of the component to look up, expressed as a string or as an array of segments.
     * @return {Object} - The component at the specified path, or undefined if none is found.
     */
    fluid.componentForPath = function (path) {
        return fluid.globalInstantiator.pathToComponent[fluid.isArrayable(path) ? path.join(".") : path];
    };

    /** END NEXUS METHODS **/

    /** BEGIN IOC DEBUGGING METHODS **/
    fluid["debugger"] = function () {
        debugger; // eslint-disable-line no-debugger
    };

    fluid.defaults("fluid.debuggingProbe", {
        gradeNames: ["fluid.component"]
    });

    // probe looks like:
    // target: {preview other}.listeners.eventName
    // priority: first/last
    // func: console.log/fluid.log/fluid.debugger
    fluid.probeToDistribution = function (probe) {
        var instantiator = fluid.globalInstantiator;
        var parsed = fluid.parseContextReference(probe.target);
        var segs = fluid.model.parseToSegments(parsed.path, instantiator.parseEL, true);
        if (segs[0] !== "options") {
            segs.unshift("options"); // compensate for this insanity until we have the great options flattening
        }
        var parsedPriority = fluid.parsePriority(probe.priority);
        if (parsedPriority.constraint && !parsedPriority.constraint.target) {
            parsedPriority.constraint.target = "authoring";
        }
        return {
            target: "{/ " + parsed.context + "}." + instantiator.composeSegments.apply(null, segs),
            record: {
                func: probe.func,
                funcName: probe.funcName,
                args: probe.args,
                priority: fluid.renderPriority(parsedPriority)
            }
        };
    };

    fluid.registerProbes = function (probes) {
        var probeDistribution = fluid.transform(probes, fluid.probeToDistribution);
        var memberName = "fluid_debuggingProbe_" + fluid.allocateGuid();
        fluid.construct([memberName], {
            type: "fluid.debuggingProbe",
            distributeOptions: probeDistribution
        });
        return memberName;
    };

    fluid.deregisterProbes = function (probeName) {
        fluid.destroy([probeName]);
    };

    /** END IOC DEBUGGING METHODS **/

    fluid.thisistToApplicable = function (record, recthis, that) {
        return {
            apply: function (noThis, args) {
                // Resolve this material late, to deal with cases where the target has only just been brought into existence
                // (e.g. a jQuery target for rendered material) - TODO: Possibly implement cached versions of these as we might do for invokers
                var resolvedThis = fluid.expandOptions(recthis, that);
                if (typeof(resolvedThis) === "string") {
                    resolvedThis = fluid.getGlobalValue(resolvedThis);
                }
                if (!resolvedThis) {
                    fluid.fail("Could not resolve reference " + recthis + " to a value");
                }
                var resolvedFunc = resolvedThis[record.method];
                if (typeof(resolvedFunc) !== "function") {
                    fluid.fail("Object ", resolvedThis, " at reference " + recthis + " has no member named " + record.method + " which is a function ");
                }
                if (fluid.passLogLevel(fluid.logLevel.TRACE)) {
                    fluid.log(fluid.logLevel.TRACE, "Applying arguments ", args, " to method " + record.method + " of instance ", resolvedThis);
                }
                return resolvedFunc.apply(resolvedThis, args);
            }
        };
    };

    fluid.changeToApplicable = function (record, that) {
        return {
            apply: function (noThis, args, localRecord, mergeRecord) {
                var parsed = fluid.parseValidModelReference(that, "changePath listener record", record.changePath);
                var value = fluid.expandOptions(record.value, that, {}, fluid.extend(localRecord, {"arguments": args}));
                var sources = mergeRecord && mergeRecord.source && mergeRecord.source.length ? fluid.makeArray(record.source).concat(mergeRecord.source) : record.source;
                parsed.applier.change(parsed.modelSegs, value, record.type, sources); // FLUID-5586 now resolved
            }
        };
    };

    // Convert "exotic records" into an applicable form ("this/method" for FLUID-4878 or "changePath" for FLUID-3674)
    fluid.recordToApplicable = function (record, that, standard) {
        if (record.changePath !== undefined) { // Allow falsy paths for FLUID-5586
            return fluid.changeToApplicable(record, that, standard);
        }
        var recthis = record["this"];
        if (record.method ^ recthis) {
            fluid.fail("Record ", that, " must contain both entries \"method\" and \"this\" if it contains either");
        }
        return record.method ? fluid.thisistToApplicable(record, recthis, that) : null;
    };

    fluid.getGlobalValueNonComponent = function (funcName, context) { // TODO: Guard this in listeners as well
        var defaults = fluid.defaults(funcName);
        if (defaults && fluid.hasGrade(defaults, "fluid.component")) {
            fluid.fail("Error in function specification - cannot invoke function " + funcName + " in the context of " + context + ": component creator functions can only be used as subcomponents");
        }
        return fluid.getGlobalValue(funcName);
    };

    fluid.makeInvoker = function (that, invokerec, name) {
        invokerec = fluid.upgradePrimitiveFunc(invokerec); // shorthand case for direct function invokers (FLUID-4926)
        if (invokerec.args !== undefined && invokerec.args !== fluid.NO_VALUE && !fluid.isArrayable(invokerec.args)) {
            invokerec.args = fluid.makeArray(invokerec.args);
        }
        var func = fluid.recordToApplicable(invokerec, that);
        var invokePre = fluid.preExpand(invokerec.args);
        var localRecord = {};
        var expandOptions = fluid.makeStackResolverOptions(that, localRecord, true);
        func = func || (invokerec.funcName ? fluid.getGlobalValueNonComponent(invokerec.funcName, "an invoker") : fluid.expandImmediate(invokerec.func, that));
        if (!func || !func.apply) {
            fluid.fail("Error in invoker record: could not resolve members func, funcName or method to a function implementation - got " + func + " from ", invokerec);
        } else if (func === fluid.notImplemented) {
            fluid.fail("Error constructing component ", that, " - the invoker named " + name + " which was defined in grade " + invokerec.componentSource + " needs to be overridden with a concrete implementation");
        }
        return function invokeInvoker() {
            if (fluid.defeatLogging === false) {
                fluid.pushActivity("invokeInvoker", "invoking invoker with name %name and record %record from path %path holding component %that",
                    {name: name, record: invokerec, path: fluid.dumpComponentPath(that), that: that});
            }
            var togo, finalArgs;
            if (that.lifecycleStatus === "destroyed") {
                fluid.log(fluid.logLevel.WARN, "Ignoring call to invoker " + name + " of component ", that, " which has been destroyed");
            } else {
                localRecord.arguments = arguments;
                if (invokerec.args === undefined || invokerec.args === fluid.NO_VALUE) {
                    finalArgs = arguments;
                } else {
                    fluid.expandImmediateImpl(invokePre, expandOptions);
                    finalArgs = invokePre.source;
                }
                togo = func.apply(null, finalArgs);
            }
            if (fluid.defeatLogging === false) {
                fluid.popActivity();
            }
            return togo;
        };
    };

    // weird higher-order function so that we can staightforwardly dispatch original args back onto listener
    fluid.event.makeTrackedListenerAdder = function (source) {
        var shadow = fluid.shadowForComponent(source);
        return function (event) {
            return {addListener: function (listener, namespace, priority, softNamespace, listenerId) {
                fluid.recordListener(event, listener, shadow, listenerId);
                event.addListener.apply(null, arguments);
            }};
        };
    };

    fluid.event.listenerEngine = function (eventSpec, callback, adder) {
        var argstruc = {};
        function checkFire() {
            var notall = fluid.find(eventSpec, function (value, key) {
                if (argstruc[key] === undefined) {
                    return true;
                }
            });
            if (!notall) {
                var oldstruc = argstruc;
                argstruc = {}; // guard against the case the callback perversely fires one of its prerequisites (FLUID-5112)
                callback(oldstruc);
            }
        }
        fluid.each(eventSpec, function (event, eventName) {
            adder(event).addListener(function () {
                argstruc[eventName] = fluid.makeArray(arguments);
                checkFire();
            });
        });
    };

    fluid.event.dispatchListener = function (that, listener, eventName, eventSpec, wrappedArgs) {
        if (eventSpec.args !== undefined && eventSpec.args !== fluid.NO_VALUE && !fluid.isArrayable(eventSpec.args)) {
            eventSpec.args = fluid.makeArray(eventSpec.args);
        }
        listener = fluid.event.resolveListener(listener); // In theory this optimisation is too aggressive if global name is not defined yet
        var dispatchPre = fluid.preExpand(eventSpec.args);
        var localRecord = {};
        var expandOptions = fluid.makeStackResolverOptions(that, localRecord, true);
        var togo = function () {
            if (fluid.defeatLogging === false) {
                fluid.pushActivity("dispatchListener", "firing to listener to event named %eventName of component %that",
                    {eventName: eventName, that: that});
            }

            var args = wrappedArgs ? arguments[0] : arguments, finalArgs;
            localRecord.arguments = args;
            if (eventSpec.args !== undefined && eventSpec.args !== fluid.NO_VALUE) {
                // In theory something more exotic happens here, and in makeInvoker - where "source" is an array we want to
                // keep its base reference stable since Function.apply will fork it sufficiently, but we really need to
                // clone each structured argument. Implies that expandImmediateImpl needs to be split in two, and operate
                // reference by "segs" rather than by "holder"
                fluid.expandImmediateImpl(dispatchPre, expandOptions);
                finalArgs = dispatchPre.source;
            } else {
                finalArgs = args;
            }
            var togo = listener.apply(null, finalArgs);
            if (fluid.defeatLogging === false) {
                fluid.popActivity();
            }
            return togo;
        };
        fluid.event.impersonateListener(listener, togo); // still necessary for FLUID-5254 even though framework's listeners now get explicit guids
        return togo;
    };

    fluid.event.resolveSoftNamespace = function (key) {
        if (typeof(key) !== "string") {
            return null;
        } else {
            var lastpos = Math.max(key.lastIndexOf("."), key.lastIndexOf("}"));
            return key.substring(lastpos + 1);
        }
    };

    fluid.event.resolveListenerRecord = function (lisrec, that, eventName, namespace, standard) {
        var badRec = function (record, extra) {
            fluid.fail("Error in listener record - could not resolve reference ", record, " to a listener or firer. " +
                "Did you miss out \"events.\" when referring to an event firer?" + extra);
        };
        fluid.pushActivity("resolveListenerRecord", "resolving listener record for event named %eventName for component %that",
            {eventName: eventName, that: that});
        var records = fluid.makeArray(lisrec);
        var transRecs = fluid.transform(records, function (record) {
            // TODO: FLUID-5242 fix - we copy here since distributeOptions does not copy options blocks that it distributes and we can hence corrupt them.
            // need to clarify policy on options sharing - for slightly better efficiency, copy should happen during distribution and not here
            // Note that fluid.mergeModelListeners expects to write to these too
            var expanded = fluid.isPrimitive(record) || record.expander ? {listener: record} : fluid.copy(record);
            var methodist = fluid.recordToApplicable(record, that, standard);
            if (methodist) {
                expanded.listener = methodist;
            }
            else {
                expanded.listener = expanded.listener || expanded.func || expanded.funcName;
            }
            if (!expanded.listener) {
                badRec(record, " Listener record must contain a member named \"listener\", \"func\", \"funcName\" or \"method\"");
            }
            var softNamespace = record.method ?
                fluid.event.resolveSoftNamespace(record["this"]) + "." + record.method :
                fluid.event.resolveSoftNamespace(expanded.listener);
            if (!expanded.namespace && !namespace && softNamespace) {
                expanded.softNamespace = true;
                expanded.namespace = (record.componentSource ? record.componentSource : that.typeName) + "." + softNamespace;
            }
            var listener = expanded.listener = fluid.expandOptions(expanded.listener, that);
            if (!listener) {
                badRec(record, "");
            }
            var firer = false;
            if (listener.typeName === "fluid.event.firer") {
                listener = listener.fire;
                firer = true;
            }
            expanded.listener = (standard && (expanded.args && listener !== "fluid.notImplemented" || firer)) ? fluid.event.dispatchListener(that, listener, eventName, expanded) : listener;
            expanded.listenerId = fluid.allocateGuid();
            return expanded;
        });
        var togo = {
            records: transRecs,
            adderWrapper: standard ? fluid.event.makeTrackedListenerAdder(that) : null
        };
        fluid.popActivity();
        return togo;
    };

    fluid.event.expandOneEvent = function (that, event) {
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

    fluid.event.expandEvents = function (that, event) {
        return typeof(event) === "string" ?
            fluid.event.expandOneEvent(that, event) :
            fluid.transform(event, function (oneEvent) {
                return fluid.event.expandOneEvent(that, oneEvent);
            });
    };

    fluid.event.resolveEvent = function (that, eventName, eventSpec) {
        fluid.pushActivity("resolveEvent", "resolving event with name %eventName attached to component %that",
            {eventName: eventName, that: that});
        var adder = fluid.event.makeTrackedListenerAdder(that);
        if (typeof(eventSpec) === "string") {
            eventSpec = {event: eventSpec};
        }
        var event = eventSpec.typeName === "fluid.event.firer" ? eventSpec : eventSpec.event || eventSpec.events;
        if (!event) {
            fluid.fail("Event specification for event with name " + eventName + " does not include a base event specification: ", eventSpec);
        }

        var origin = event.typeName === "fluid.event.firer" ? event : fluid.event.expandEvents(that, event);

        var isMultiple = origin.typeName !== "fluid.event.firer";
        var isComposite = eventSpec.args || isMultiple;
        // If "event" is not composite, we want to share the listener list and FIRE method with the original
        // If "event" is composite, we need to create a new firer. "composite" includes case where any boiling
        // occurred - this was implemented wrongly in 1.4.
        var firer;
        if (isComposite) {
            firer = fluid.makeEventFirer({name: " [composite] " + fluid.event.nameEvent(that, eventName)});
            var dispatcher = fluid.event.dispatchListener(that, firer.fire, eventName, eventSpec, isMultiple);
            if (isMultiple) {
                fluid.event.listenerEngine(origin, dispatcher, adder);
            }
            else {
                adder(origin).addListener(dispatcher);
            }
        }
        else {
            firer = {typeName: "fluid.event.firer"};
            firer.fire = function () {
                var outerArgs = fluid.makeArray(arguments);
                fluid.pushActivity("fireSynthetic", "firing synthetic event %eventName ", {eventName: eventName});
                var togo = origin.fire.apply(null, outerArgs);
                fluid.popActivity();
                return togo;
            };
            firer.addListener = function (listener, namespace, priority, softNamespace, listenerId) {
                var dispatcher = fluid.event.dispatchListener(that, listener, eventName, eventSpec);
                adder(origin).addListener(dispatcher, namespace, priority, softNamespace, listenerId);
            };
            firer.removeListener = function (listener) {
                origin.removeListener(listener);
            };
            // To allow introspection on listeners in cases such as fluid.test.findListenerId
            firer.originEvent = origin;
        }
        fluid.popActivity();
        return firer;
    };

    /** BEGIN unofficial IoC material **/

    // The following three functions are unsupported ane only used in the renderer expander.
    // The material they produce is no longer recognised for component resolution.

    fluid.withEnvironment = function (envAdd, func, root) {
        var key;
        root = root || fluid.globalThreadLocal();
        try {
            for (key in envAdd) {
                root[key] = envAdd[key];
            }
            $.extend(root, envAdd);
            return func();
        } finally {
            for (key in envAdd) {
                delete root[key]; // TODO: users may want a recursive "scoping" model
            }
        }
    };

    fluid.fetchContextReference = function (parsed, directModel, env, elResolver, externalFetcher) {
        // The "elResolver" is a hack to make certain common idioms in protoTrees work correctly, where a contextualised EL
        // path actually resolves onto a further EL reference rather than directly onto a value target
        if (elResolver) {
            parsed = elResolver(parsed, env);
        }
        var base = parsed.context ? env[parsed.context] : directModel;
        if (!base) {
            var resolveExternal = externalFetcher && externalFetcher(parsed);
            return resolveExternal || base;
        }
        return parsed.noDereference ? parsed.path : fluid.get(base, parsed.path);
    };

    fluid.makeEnvironmentFetcher = function (directModel, elResolver, envGetter, externalFetcher) {
        envGetter = envGetter || fluid.globalThreadLocal;
        return function (parsed) {
            var env = envGetter();
            return fluid.fetchContextReference(parsed, directModel, env, elResolver, externalFetcher);
        };
    };

    /** END of unofficial IoC material **/

    /* Compact expansion machinery - for short form invoker and expander references such as @expand:func(arg) and func(arg) */

    fluid.coerceToPrimitive = function (string) {
        return string === "false" ? false : (string === "true" ? true :
            (isFinite(string) ? Number(string) : string));
    };

    fluid.compactStringToRec = function (string, type) {
        var openPos = string.indexOf("(");
        var closePos = string.indexOf(")");
        if (openPos === -1 ^ closePos === -1 || openPos > closePos) {
            fluid.fail("Badly-formed compact " + type + " record without matching parentheses: " + string);
        }
        if (openPos !== -1 && closePos !== -1) {
            var trail = string.substring(closePos + 1);
            if (trail.trim() !== "") {
                fluid.fail("Badly-formed compact " + type + " record " + string + " - unexpected material following close parenthesis: " + trail);
            }
            var prefix = string.substring(0, openPos);
            var body = string.substring(openPos + 1, closePos).trim();
            var args = body === "" ? [] : fluid.transform(body.split(","), function (str) {return str.trim();}, fluid.coerceToPrimitive);
            var togo = fluid.upgradePrimitiveFunc(prefix, null);
            togo.args = args;
            return togo;
        }
        else if (type === "expander") {
            fluid.fail("Badly-formed compact expander record without parentheses: " + string);
        }
        return string;
    };

    fluid.expandPrefix = "@expand:";

    fluid.expandCompactString = function (string, active) {
        var rec = string;
        if (string.indexOf(fluid.expandPrefix) === 0) {
            var rem = string.substring(fluid.expandPrefix.length);
            rec = {
                expander: fluid.compactStringToRec(rem, "expander")
            };
        }
        else if (active) {
            rec = fluid.compactStringToRec(string, active);
        }
        return rec;
    };

    var singularPenRecord = {
        listeners: "listener",
        modelListeners: "modelListener"
    };

    var singularRecord = $.extend({
        invokers: "invoker"
    }, singularPenRecord);

    fluid.expandCompactRec = function (segs, target, source) {
        fluid.guardCircularExpansion(segs, segs.length);
        var pen = segs.length > 0 ? segs[segs.length - 1] : "";
        var active = singularRecord[pen];
        if (!active && segs.length > 1) {
            active = singularPenRecord[segs[segs.length - 2]]; // support array of listeners and modelListeners
        }
        fluid.each(source, function (value, key) {
            if (fluid.isPlainObject(value)) {
                target[key] = fluid.freshContainer(value);
                segs.push(key);
                fluid.expandCompactRec(segs, target[key], value);
                segs.pop();
                return;
            }
            else if (typeof(value) === "string") {
                value = fluid.expandCompactString(value, active);
            }
            target[key] = value;
        });
    };

    fluid.expandCompact = function (options) {
        var togo = {};
        fluid.expandCompactRec([], togo, options);
        return togo;
    };

    /** End compact record expansion machinery **/

    fluid.extractEL = function (string, options) {
        if (options.ELstyle === "ALL" || options.ELstyle === "{}") {
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

    fluid.extractELWithContext = function (string, options) {
        var EL = fluid.extractEL(string, options);
        if (fluid.isIoCReference(EL)) {
            return fluid.parseContextReference(EL);
        } else if (options.ELstyle === "{}") {
            return null;
        }
        return EL ? {path: EL} : EL;
    };

    /**
     * Parse the string form of a contextualised IoC reference into an object.
     *
     * @param {String} reference - The reference to be parsed. The character at position `index` is assumed to be `{`
     * @param {String} [index] - (optional) The index into the string to start parsing at, if omitted, defaults to 0
     * @param {Character} [delimiter] - (optional) A character which will delimit the end of the context expression. If omitted, the expression continues to the end of the string.
     * @return {ParsedContext} A structure holding the parsed structure, with members
     *    context {String|ParsedContext} The context portion of the reference. This will be a `string` for a flat reference, or a further `ParsedContext` for a recursive reference
     *    path {String} The string portion of the reference
     *    endpos {Integer} The position in the string where parsing stopped [this member is not supported and will be removed in a future release]
     */
    fluid.parseContextReference = function (reference, index, delimiter) {
        index = index || 0;
        var isNested = reference.charAt(index + 1) === "{", endcpos, context, nested;
        if (isNested) {
            nested = fluid.parseContextReference(reference, index + 1, "}");
            endcpos = nested.endpos;
        } else {
            endcpos = reference.indexOf("}", index + 1);
        }
        if (endcpos === -1) {
            fluid.fail("Cannot parse context reference \"" + reference + "\": Malformed context reference without }");
        }
        if (isNested) {
            context = nested;
        } else {
            context = reference.substring(index + 1, endcpos);
        }
        var endpos = delimiter ? reference.indexOf(delimiter, endcpos + 1) : reference.length;
        var path = reference.substring(endcpos + 1, endpos);
        if (path.charAt(0) === ".") {
            path = path.substring(1);
        }
        return {context: context, path: path, endpos: endpos};
    };

    fluid.renderContextReference = function (parsed) {
        var context = parsed.context;
        return "{" + (fluid.isPrimitive(context) ? context : fluid.renderContextReference(context)) + "}" + (parsed.path ? "." + parsed.path : "");
    };

    // TODO: Once we eliminate expandSource (in favour of fluid.expander.fetch), all of this tree of functions can be hived off to RendererUtilities
    fluid.resolveContextValue = function (string, options) {
        function fetch(parsed) {
            fluid.pushActivity("resolveContextValue", "resolving context value %parsed", {parsed: parsed});
            var togo = options.fetcher(parsed);
            fluid.pushActivity("resolvedContextValue", "resolved value %parsed to value %value", {parsed: parsed, value: togo});
            fluid.popActivity(2);
            return togo;
        }
        var parsed;
        if (options.bareContextRefs && fluid.isIoCReference(string)) {
            parsed = fluid.parseContextReference(string);
            return fetch(parsed);
        }
        else if (options.ELstyle && options.ELstyle !== "${}") {
            parsed = fluid.extractELWithContext(string, options);
            if (parsed) {
                return fetch(parsed);
            }
        }
        if (options.ELstyle === "${}") {
            while (typeof(string) === "string") {
                var i1 = string.indexOf("${");
                var i2 = string.indexOf("}", i1 + 2);
                if (i1 !== -1 && i2 !== -1) {
                    if (string.charAt(i1 + 2) === "{") {
                        parsed = fluid.parseContextReference(string, i1 + 2, "}");
                        i2 = parsed.endpos;
                    }
                    else {
                        parsed = {path: string.substring(i1 + 2, i2)};
                    }
                    var subs = fetch(parsed);
                    var all = (i1 === 0 && i2 === string.length - 1);
                    // TODO: test case for all undefined substitution
                    if (subs === undefined || subs === null) {
                        return subs;
                    }
                    string = all ? subs : string.substring(0, i1) + subs + string.substring(i2 + 1);
                }
                else {
                    break;
                }
            }
        }
        return string;
    };

    // This function appears somewhat reusable, but not entirely - it probably needs to be packaged
    // along with the particular "strategy". Very similar to the old "filter"... the "outer driver" needs
    // to execute it to get the first recursion going at top level. This was one of the most odd results
    // of the reorganisation, since the "old work" seemed much more naturally expressed in terms of values
    // and what happened to them. The "new work" is expressed in terms of paths and how to move amongst them.
    fluid.fetchExpandChildren = function (target, i, segs, source, mergePolicy, options) {
        if (source.expander) { // possible expander at top level
            var expanded = fluid.expandExpander(target, source, options);
            if (fluid.isPrimitive(expanded) || !fluid.isPlainObject(expanded) || (fluid.isArrayable(expanded) ^ fluid.isArrayable(target))) {
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
            else if (key !== "expander") {
                segs[i] = key;
                if (fluid.getImmediate(options.exceptions, segs, i) !== true) {
                    options.strategy(target, key, i + 1, segs, source, mergePolicy);
                }
            }
        });
        return target;
    };

    // TODO: This method is unnecessary and will quadratic inefficiency if RHS block is not concrete.
    // The driver should detect "homogeneous uni-strategy trundling" and agree to preserve the extra
    // "cursor arguments" which should be advertised somehow (at least their number)
    function regenerateCursor(source, segs, limit, sourceStrategy) {
        for (var i = 0; i < limit; ++i) {
            // copy segs to avoid aliasing with FLUID-5243
            source = sourceStrategy(source, segs[i], i, fluid.makeArray(segs));
        }
        return source;
    }

    fluid.isUnexpandable = function (source) { // slightly more efficient compound of fluid.isCopyable and fluid.isComponent - review performance
        return fluid.isPrimitive(source) || !fluid.isPlainObject(source);
    };

    fluid.expandSource = function (options, target, i, segs, deliverer, source, policy, recurse) {
        var expanded, isTrunk;
        var thisPolicy = fluid.derefMergePolicy(policy);
        if (typeof(source) === "string" && !thisPolicy.noexpand) {
            if (!options.defaultEL || source.charAt(0) === "{") { // hard-code this for performance
                fluid.pushActivity("expandContextValue", "expanding context value %source held at path %path", {source: source, path: fluid.path.apply(null, segs.slice(0, i))});
                expanded = fluid.resolveContextValue(source, options);
                fluid.popActivity(1);
            } else {
                expanded = source;
            }
        }
        else if (thisPolicy.noexpand || fluid.isUnexpandable(source)) {
            expanded = source;
        }
        else if (source.expander) {
            expanded = fluid.expandExpander(deliverer, source, options);
        }
        else {
            expanded = fluid.freshContainer(source);
            isTrunk = true;
        }
        if (expanded !== fluid.NO_VALUE) {
            deliverer(expanded);
        }
        if (isTrunk) {
            recurse(expanded, source, i, segs, policy);
        }
        return expanded;
    };

    fluid.guardCircularExpansion = function (segs, i) {
        if (i > fluid.strategyRecursionBailout) {
            fluid.fail("Overflow/circularity in options expansion, current path is ", segs, " at depth " , i, " - please ensure options are not circularly connected, or protect from expansion using the \"noexpand\" policy or expander");
        }
    };

    fluid.makeExpandStrategy = function (options) {
        var recurse = function (target, source, i, segs, policy) {
            return fluid.fetchExpandChildren(target, i || 0, segs || [], source, policy, options);
        };
        var strategy = function (target, name, i, segs, source, policy) {
            fluid.guardCircularExpansion(segs, i);
            if (!target) {
                return;
            }
            if (target.hasOwnProperty(name)) { // bail out if our work has already been done
                return target[name];
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
            return fluid.expandSource(options, target, i, segs, deliverer, thisSource, thisPolicy, recurse);
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

    fluid.makeExpandOptions = function (source, options) {
        options = $.extend({}, fluid.rawDefaults("fluid.makeExpandOptions"), options);
        options.defaultEL = options.ELStyle === "${}" && options.bareContextRefs; // optimisation to help expander
        options.expandSource = function (source) {
            return fluid.expandSource(options, null, 0, [], fluid.identity, source, options.mergePolicy, false);
        };
        if (!fluid.isUnexpandable(source)) {
            options.source = source;
            options.target = fluid.freshContainer(source);
            options.sourceStrategy = options.sourceStrategy || fluid.concreteTrundler;
            fluid.makeExpandStrategy(options);
            options.initter = function () {
                options.target = fluid.fetchExpandChildren(options.target, 0, [], options.source, options.mergePolicy, options);
            };
        }
        else { // these init immediately since we must deliver a valid root target
            options.strategy = fluid.concreteTrundler;
            options.initter = fluid.identity;
            if (typeof(source) === "string") {
                // Copy is necessary to resolve FLUID-6213 since targets are regularly scrawled over with "undefined" by dim expansion pathway
                // However, we can't screw up object identity for uncloneable things like events resolved via local expansion
                options.target = (options.defer ? fluid.copy : fluid.identity)(options.expandSource(source));
            }
            else {
                options.target = source;
            }
            options.immutableTarget = true;
        }
        return options;
    };

    // supported, PUBLIC API function
    fluid.expand = function (source, options) {
        var expandOptions = fluid.makeExpandOptions(source, options);
        expandOptions.initter();
        return expandOptions.target;
    };

    fluid.preExpandRecurse = function (root, source, holder, member, rootSegs) { // on entry, holder[member] = source
        fluid.guardCircularExpansion(rootSegs, rootSegs.length);
        function pushExpander(expander) {
            root.expanders.push({expander: expander, holder: holder, member: member});
            delete holder[member];
        }
        if (fluid.isIoCReference(source)) {
            var parsed = fluid.parseContextReference(source);
            var segs = fluid.model.parseEL(parsed.path);
            pushExpander({
                typeFunc: fluid.expander.fetch,
                context: parsed.context,
                segs: segs
            });
        } else if (fluid.isPlainObject(source)) {
            if (source.expander) {
                source.expander.typeFunc = fluid.getGlobalValue(source.expander.type || "fluid.invokeFunc");
                pushExpander(source.expander);
            } else {
                fluid.each(source, function (value, key) {
                    rootSegs.push(key);
                    fluid.preExpandRecurse(root, value, source, key, rootSegs);
                    rootSegs.pop();
                });
            }
        }
    };

    fluid.preExpand = function (source) {
        var root = {
            expanders: [],
            source: fluid.isUnexpandable(source) ? source : fluid.copy(source)
        };
        fluid.preExpandRecurse(root, root.source, root, "source", []);
        return root;
    };

    // Main pathway for freestanding material that is not part of a component's options
    fluid.expandImmediate = function (source, that, localRecord) {
        var options = fluid.makeStackResolverOptions(that, localRecord, true); // TODO: ELstyle and target are now ignored
        var root = fluid.preExpand(source);
        fluid.expandImmediateImpl(root, options);
        return root.source;
    };

    // High performance expander for situations such as invokers, listeners, where raw materials can be cached - consumes "root" structure produced by preExpand
    fluid.expandImmediateImpl = function (root, options) {
        var expanders = root.expanders;
        for (var i = 0; i < expanders.length; ++i) {
            var expander = expanders[i];
            expander.holder[expander.member] = expander.expander.typeFunc(null, expander, options);
        }
    };

    fluid.expandExpander = function (deliverer, source, options) {
        var expander = fluid.getGlobalValue(source.expander.type || "fluid.invokeFunc");
        if (!expander) {
            fluid.fail("Unknown expander with type " + source.expander.type);
        }
        return expander(deliverer, source, options);
    };

    fluid.registerNamespace("fluid.expander");

    // "deliverer" is null in the new (fast) pathway, this is a relic of the old "source expander" signature. It appears we can already globally remove this
    fluid.expander.fetch = function (deliverer, source, options) {
        var localRecord = options.localRecord, context = source.expander.context, segs = source.expander.segs;
        // TODO: Either type-check on context as string or else create fetchSlow
        var inLocal = localRecord[context] !== undefined;
        var contextStatus = options.contextThat.lifecycleStatus;
        // somewhat hack to anticipate "fits" for FLUID-4925 - we assume that if THIS component is in construction, its reference target might be too
        // if context is destroyed, we are most likely in an afterDestroy listener and so path records have been destroyed
        var fast = contextStatus === "treeConstructed" || contextStatus === "destroyed";
        var component = inLocal ? localRecord[context] : fluid.resolveContext(context, options.contextThat, fast);
        if (component) {
            var root = component;
            if (inLocal || component.lifecycleStatus !== "constructing") {
                for (var i = 0; i < segs.length; ++i) { // fast resolution of paths when no ginger process active
                    root = root ? root[segs[i]] : undefined;
                }
            } else {
                root = fluid.getForComponent(component, segs);
            }
            if (root === undefined && !inLocal) { // last-ditch attempt to get exotic EL value from component
                root = fluid.getForComponent(component, segs);
            }
            return root;
        } else if (segs.length > 0) {
            fluid.triggerMismatchedPathError(source.expander, options.contextThat);
        }
    };

    /* "light" expanders, starting with the default expander invokeFunc,
         which makes an arbitrary function call (after expanding arguments) and are then replaced in
         the configuration with the call results. These will probably be abolished and replaced with
         equivalent model transformation machinery */

    // This one is now positioned as the "universal expander" - default if no type supplied
    fluid.invokeFunc = function (deliverer, source, options) {
        var expander = source.expander;
        var args = fluid.makeArray(expander.args);
        expander.args = args; // head off case where args is an EL reference which resolves to an array
        if (options.recurse) { // only available in the path from fluid.expandOptions - this will be abolished in the end
            args = options.recurse([], args);
        } else {
            expander = fluid.expandImmediate(expander, options.contextThat, options.localRecord);
            args = expander.args;
        }
        var funcEntry = expander.func || expander.funcName;
        var func = (options.expandSource ? options.expandSource(funcEntry) : funcEntry) || fluid.recordToApplicable(expander, options.contextThat);
        if (typeof(func) === "string") {
            func = fluid.getGlobalValue(func);
        }
        if (!func) {
            fluid.fail("Error in expander record ", expander, ": " + funcEntry + " could not be resolved to a function for component ", options.contextThat);
        }
        return func.apply(null, args);
    };

    // The "noexpand" expander which simply unwraps one level of expansion and ceases.
    fluid.noexpand = function (deliverer, source) {
        return source.expander.value ? source.expander.value : source.expander.tree;
    };

})(jQuery, fluid_3_0_0);
