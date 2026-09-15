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

    fluid.registerNamespace("fluid.model.transform");

    /** Grade definitions for standard transformation function hierarchy **/

    fluid.defaults("fluid.transformFunction", {
        gradeNames: "fluid.function"
    });

    // uses standard layout and workflow involving inputPath - an undefined input value
    // will short-circuit the evaluation
    fluid.defaults("fluid.standardInputTransformFunction", {
        gradeNames: "fluid.transformFunction"
    });

    fluid.defaults("fluid.standardOutputTransformFunction", {
        gradeNames: "fluid.transformFunction"
    });

    // defines a set of options "inputVariables" referring to its inputs, which are converted
    // to functions that the transform may explicitly use to demand the input value
    fluid.defaults("fluid.multiInputTransformFunction", {
        gradeNames: "fluid.transformFunction"
    });

    // uses the standard layout and workflow involving inputPath and outputPath
    fluid.defaults("fluid.standardTransformFunction", {
        gradeNames: ["fluid.standardInputTransformFunction", "fluid.standardOutputTransformFunction"]
    });

    fluid.defaults("fluid.lens", {
        gradeNames: "fluid.transformFunction",
        invertConfiguration: null
        // this function method returns "inverted configuration" rather than actually performing inversion
        // TODO: harmonise with strategy used in VideoPlayer_framework.js
    });

    /***********************************
     * Base utilities for transformers *
     ***********************************/

    // unsupported, NON-API function
    fluid.model.transform.pathToRule = function (inputPath) {
        return {
            transform: {
                type: "fluid.transforms.value",
                inputPath: inputPath
            }
        };
    };

    // unsupported, NON-API function
    fluid.model.transform.literalValueToRule = function (input) {
        return {
            transform: {
                type: "fluid.transforms.literalValue",
                input: input
            }
        };
    };

    /* Accepts two fully escaped paths, either of which may be empty or null */
    fluid.model.composePaths = function (prefix, suffix) {
        prefix = prefix === 0 ? "0" : prefix || "";
        suffix = suffix === 0 ? "0" : suffix || "";
        return !prefix ? suffix : (!suffix ? prefix : prefix + "." + suffix);
    };

    fluid.model.transform.accumulateInputPath = function (inputPath, transformer, paths) {
        if (inputPath !== undefined) {
            paths.push(fluid.model.composePaths(transformer.inputPrefix, inputPath));
        }
    };

    fluid.model.transform.accumulateStandardInputPath = function (input, transformSpec, transformer, paths) {
        fluid.model.transform.getValue(undefined, transformSpec[input], transformer);
        fluid.model.transform.accumulateInputPath(transformSpec[input + "Path"], transformer, paths);
    };

    fluid.model.transform.accumulateMultiInputPaths = function (inputVariables, transformSpec, transformer, paths) {
        fluid.each(inputVariables, function (v, k) {
            fluid.model.transform.accumulateStandardInputPath(k, transformSpec, transformer, paths);
        });
    };

    fluid.model.transform.getValue = function (inputPath, value, transformer) {
        var togo;
        if (inputPath !== undefined) { // NB: We may one day want to reverse the crazy jQuery-like convention that "no path means root path"
            togo = fluid.get(transformer.source, fluid.model.composePaths(transformer.inputPrefix, inputPath), transformer.resolverGetConfig);
        }
        if (togo === undefined) {
            // FLUID-5867 - actually helpful behaviour here rather than the insane original default of expecting a short-form value document
            togo = fluid.isPrimitive(value) ? value :
                ("literalValue" in value ? value.literalValue :
                    (value.transform === undefined ? value : transformer.expand(value)));
        }
        return togo;
    };

    // distinguished value which indicates that a transformation rule supplied a
    // non-default output path, and so the user should be prevented from making use of it
    // in a compound transform definition
    fluid.model.transform.NONDEFAULT_OUTPUT_PATH_RETURN = {};

    fluid.model.transform.setValue = function (userOutputPath, value, transformer) {
        // avoid crosslinking to input object - this might be controlled by a "nocopy" option in future
        var toset = fluid.copy(value);
        var outputPath = fluid.model.composePaths(transformer.outputPrefix, userOutputPath);
        // TODO: custom resolver config here to create non-hash output model structure
        if (toset !== undefined) {
            transformer.applier.change(outputPath, toset);
        }
        return userOutputPath ? fluid.model.transform.NONDEFAULT_OUTPUT_PATH_RETURN : toset;
    };

    /* Resolves the <key> given as parameter by looking up the path <key>Path in the object
     * to be transformed. If not present, it resolves the <key> by using the literal value if primitive,
     * or expanding otherwise. <def> defines the default value if unableto resolve the key. If no
     * default value is given undefined is returned
     */
    fluid.model.transform.resolveParam = function (transformSpec, transformer, key, def) {
        var val = fluid.model.transform.getValue(transformSpec[key + "Path"], transformSpec[key], transformer);
        return (val !== undefined) ? val : def;
    };

    // Compute a "match score" between two pieces of model material, with 0 indicating a complete mismatch, and
    // higher values indicating increasingly good matches
    fluid.model.transform.matchValue = function (expected, actual, partialMatches) {
        var stats = {changes: 0, unchanged: 0, changeMap: {}};
        fluid.model.diff(expected, actual, stats);
        // i) a pair with 0 matches counts for 0 in all cases
        // ii) without "partial match mode" (the default), we simply count matches, with any mismatch giving 0
        // iii) with "partial match mode", a "perfect score" in the top 24 bits is
        // penalised for each mismatch, with a positive score of matches store in the bottom 24 bits
        return stats.unchanged === 0 ? 0 :
            (partialMatches ? 0xffffff000000 - 0x1000000 * stats.changes + stats.unchanged :
                (stats.changes ? 0 : 0xffffff000000 + stats.unchanged));
    };

    fluid.model.transform.invertPaths = function (transformSpec, transformer) {
        // TODO: this will not behave correctly in the face of compound "input" which contains
        // further transforms
        var oldOutput = fluid.model.composePaths(transformer.outputPrefix, transformSpec.outputPath);
        transformSpec.outputPath = fluid.model.composePaths(transformer.inputPrefix, transformSpec.inputPath);
        transformSpec.inputPath = oldOutput;
        return transformSpec;
    };


    // TODO: prefixApplier is a transform which is currently unused and untested
    fluid.model.transform.prefixApplier = function (transformSpec, transformer) {
        if (transformSpec.inputPrefix) {
            transformer.inputPrefixOp.push(transformSpec.inputPrefix);
        }
        if (transformSpec.outputPrefix) {
            transformer.outputPrefixOp.push(transformSpec.outputPrefix);
        }
        transformer.expand(transformSpec.input);
        if (transformSpec.inputPrefix) {
            transformer.inputPrefixOp.pop();
        }
        if (transformSpec.outputPrefix) {
            transformer.outputPrefixOp.pop();
        }
    };

    fluid.defaults("fluid.model.transform.prefixApplier", {
        gradeNames: ["fluid.transformFunction"]
    });

    // unsupported, NON-API function
    fluid.model.makePathStack = function (transform, prefixName) {
        var stack = transform[prefixName + "Stack"] = [];
        transform[prefixName] = "";
        return {
            push: function (prefix) {
                var newPath = fluid.model.composePaths(transform[prefixName], prefix);
                stack.push(transform[prefixName]);
                transform[prefixName] = newPath;
            },
            pop: function () {
                transform[prefixName] = stack.pop();
            }
        };
    };

    // unsupported, NON-API function
    fluid.model.transform.doTransform = function (transformSpec, transformer, transformOpts) {
        var expdef = transformOpts.defaults;
        var transformFn = fluid.getGlobalValue(transformOpts.typeName);
        if (typeof(transformFn) !== "function") {
            fluid.fail("Transformation record specifies transformation function with name " +
                transformSpec.type + " which is not a function - ", transformFn);
        }
        if (!fluid.hasGrade(expdef, "fluid.transformFunction")) {
            // If no suitable grade is set up, assume that it is intended to be used as a standardTransformFunction
            expdef = fluid.defaults("fluid.standardTransformFunction");
        }
        var transformArgs = [transformSpec, transformer];
        if (fluid.hasGrade(expdef, "fluid.multiInputTransformFunction")) {
            var inputs = {};
            fluid.each(expdef.inputVariables, function (v, k) {
                inputs[k] = function () {
                    var input = fluid.model.transform.getValue(transformSpec[k + "Path"], transformSpec[k], transformer);
                    // TODO: This is a mess, null might perfectly well be a possible default
                    // if no match, assign default if one exists (v != null)
                    input = (input === undefined && v !== null) ? v : input;
                    return input;
                };
            });
            transformArgs.unshift(inputs);
        }
        if (fluid.hasGrade(expdef, "fluid.standardInputTransformFunction")) {
            if (!("input" in transformSpec) && !("inputPath" in transformSpec)) {
                fluid.fail("Error in transform specification. Either \"input\" or \"inputPath\" must be specified for a standardInputTransformFunction: received ", transformSpec);
            }
            var expanded = fluid.model.transform.getValue(transformSpec.inputPath, transformSpec.input, transformer);

            transformArgs.unshift(expanded);
            // if the function has no input, the result is considered undefined, and this is returned
            if (expanded === undefined) {
                return undefined;
            }
        }
        var transformed = transformFn.apply(null, transformArgs);
        if (fluid.hasGrade(expdef, "fluid.standardOutputTransformFunction")) {
            // "doOutput" flag is currently set nowhere, but could be used in future
            var outputPath = transformSpec.outputPath !== undefined ? transformSpec.outputPath : (transformOpts.doOutput ? "" : undefined);
            if (outputPath !== undefined && transformed !== undefined) {
                //If outputPath is given in the expander we want to:
                // (1) output to the document
                // (2) return undefined, to ensure that expanders higher up in the hierarchy doesn't attempt to output it again
                fluid.model.transform.setValue(transformSpec.outputPath, transformed, transformer);
                transformed = undefined;
            }
        }
        return transformed;
    };

    // OLD PATHUTIL utilities: Rescued from old DataBinding implementation to support obsolete "schema" scheme for transforms - all of this needs to be rethought
    var globalAccept = [];

    fluid.registerNamespace("fluid.pathUtil");

    /* Parses a path segment, following escaping rules, starting from character index i in the supplied path */
    fluid.pathUtil.getPathSegment = function (path, i) {
        fluid.pathUtil.getPathSegmentImpl(globalAccept, path, i);
        return globalAccept[0];
    };
    /* Returns just the head segment of an EL path */
    fluid.pathUtil.getHeadPath = function (path) {
        return fluid.pathUtil.getPathSegment(path, 0);
    };

    /* Returns all of an EL path minus its first segment - if the path consists of just one segment, returns "" */
    fluid.pathUtil.getFromHeadPath = function (path) {
        var firstdot = fluid.pathUtil.getPathSegmentImpl(null, path, 0);
        return firstdot === path.length ? "" : path.substring(firstdot + 1);
    };

    /** Determines whether a particular EL path matches a given path specification.
     * The specification consists of a path with optional wildcard segments represented by "*".
     * @param {String} spec - The specification to be matched
     * @param {String} path - The path to be tested
     * @param {Boolean} exact - Whether the path must exactly match the length of the specification in
     * terms of path segments in order to count as match. If exact is falsy, short specifications will
     * match all longer paths as if they were padded out with "*" segments
     * @return {Array|null} - An array of {String} path segments which matched the specification, or <code>null</code> if there was no match.
     */
    fluid.pathUtil.matchPath = function (spec, path, exact) {
        var togo = [];
        while (true) {
            if (((path === "") ^ (spec === "")) && exact) {
                return null;
            }
            // FLUID-4625 - symmetry on spec and path is actually undesirable, but this
            // quickly avoids at least missed notifications - improved (but slower)
            // implementation should explode composite changes
            if (!spec || !path) {
                break;
            }
            var spechead = fluid.pathUtil.getHeadPath(spec);
            var pathhead = fluid.pathUtil.getHeadPath(path);
            // if we fail to match on a specific component, fail.
            if (spechead !== "*" && spechead !== pathhead) {
                return null;
            }
            togo.push(pathhead);
            spec = fluid.pathUtil.getFromHeadPath(spec);
            path = fluid.pathUtil.getFromHeadPath(path);
        }
        return togo;
    };

    // unsupported, NON-API function
    fluid.model.transform.expandWildcards = function (transformer, source) {
        fluid.each(source, function (value, key) {
            var q = transformer.queuedTransforms;
            transformer.pathOp.push(fluid.pathUtil.escapeSegment(key.toString()));
            for (var i = 0; i < q.length; ++i) {
                if (fluid.pathUtil.matchPath(q[i].matchPath, transformer.path, true)) {
                    var esCopy = fluid.copy(q[i].transformSpec);
                    if (esCopy.inputPath === undefined || fluid.model.transform.hasWildcard(esCopy.inputPath)) {
                        esCopy.inputPath = "";
                    }
                    // TODO: allow some kind of interpolation for output path
                    // TODO: Also, we now require outputPath to be specified in these cases for output to be produced as well.. Is that something we want to continue with?
                    transformer.inputPrefixOp.push(transformer.path);
                    transformer.outputPrefixOp.push(transformer.path);
                    var transformOpts = fluid.model.transform.lookupType(esCopy.type);
                    var result = fluid.model.transform.doTransform(esCopy, transformer, transformOpts);
                    if (result !== undefined) {
                        fluid.model.transform.setValue(null, result, transformer);
                    }
                    transformer.outputPrefixOp.pop();
                    transformer.inputPrefixOp.pop();
                }
            }
            if (!fluid.isPrimitive(value)) {
                fluid.model.transform.expandWildcards(transformer, value);
            }
            transformer.pathOp.pop();
        });
    };

    // unsupported, NON-API function
    fluid.model.transform.hasWildcard = function (path) {
        return typeof(path) === "string" && path.indexOf("*") !== -1;
    };

    // unsupported, NON-API function
    fluid.model.transform.maybePushWildcard = function (transformSpec, transformer) {
        var hw = fluid.model.transform.hasWildcard;
        var matchPath;
        if (hw(transformSpec.inputPath)) {
            matchPath = fluid.model.composePaths(transformer.inputPrefix, transformSpec.inputPath);
        }
        else if (hw(transformer.outputPrefix) || hw(transformSpec.outputPath)) {
            matchPath = fluid.model.composePaths(transformer.outputPrefix, transformSpec.outputPath);
        }

        if (matchPath) {
            transformer.queuedTransforms.push({transformSpec: transformSpec, outputPrefix: transformer.outputPrefix, inputPrefix: transformer.inputPrefix, matchPath: matchPath});
            return true;
        }
        return false;
    };

    fluid.model.sortByKeyLength = function (inObject) {
        var keys = fluid.keys(inObject);
        return keys.sort(fluid.compareStringLength(true));
    };

    // Three handler functions operating the (currently) three different processing modes
    // unsupported, NON-API function
    fluid.model.transform.handleTransformStrategy = function (transformSpec, transformer, transformOpts) {
        if (fluid.model.transform.maybePushWildcard(transformSpec, transformer)) {
            return;
        }
        else {
            return fluid.model.transform.doTransform(transformSpec, transformer, transformOpts);
        }
    };
    // unsupported, NON-API function
    fluid.model.transform.handleInvertStrategy = function (transformSpec, transformer, transformOpts) {
        transformSpec = fluid.copy(transformSpec);
        // if we have a standardTransformFunction we can switch input and output arguments:
        if (fluid.hasGrade(transformOpts.defaults, "fluid.standardTransformFunction")) {
            transformSpec = fluid.model.transform.invertPaths(transformSpec, transformer);
        }
        var invertor = transformOpts.defaults && transformOpts.defaults.invertConfiguration;
        if (invertor) {
            var inverted = fluid.invokeGlobalFunction(invertor, [transformSpec, transformer]);
            transformer.inverted.push(inverted);
        } else {
            transformer.inverted.push(fluid.model.transform.uninvertibleTransform);
        }
    };

    // unsupported, NON-API function
    fluid.model.transform.handleCollectStrategy = function (transformSpec, transformer, transformOpts) {
        var defaults = transformOpts.defaults;
        var standardInput = fluid.hasGrade(defaults, "fluid.standardInputTransformFunction");
        var multiInput = fluid.hasGrade(defaults, "fluid.multiInputTransformFunction");

        if (standardInput) {
            fluid.model.transform.accumulateStandardInputPath("input", transformSpec, transformer, transformer.inputPaths);
        }
        if (multiInput) {
            fluid.model.transform.accumulateMultiInputPaths(defaults.inputVariables, transformSpec, transformer, transformer.inputPaths);
        }
        var collector = defaults.collectInputPaths;
        if (collector) {
            var collected = fluid.makeArray(fluid.invokeGlobalFunction(collector, [transformSpec, transformer]));
            Array.prototype.push.apply(transformer.inputPaths, collected); // push all elements of collected onto inputPaths
        }
    };

    fluid.model.transform.lookupType = function (typeName, transformSpec) {
        if (!typeName) {
            fluid.fail("Transformation record is missing a type name: ", transformSpec);
        }
        if (typeName.indexOf(".") === -1) {
            typeName = "fluid.transforms." + typeName;
        }
        var defaults = fluid.defaults(typeName);
        return { defaults: defaults, typeName: typeName};
    };

    // unsupported, NON-API function
    fluid.model.transform.processRule = function (rule, transformer) {
        if (typeof(rule) === "string") {
            rule = fluid.model.transform.pathToRule(rule);
        }
        // special dispensation to allow "literalValue" to escape any value
        else if (rule.literalValue !== undefined) {
            rule = fluid.model.transform.literalValueToRule(rule.literalValue);
        }
        var togo;
        if (rule.transform) {
            var transformSpec, transformOpts;
            if (fluid.isArrayable(rule.transform)) {
                // if the transform holds an array, each transformer within that is responsible for its own output
                var transforms = rule.transform;
                togo = undefined;
                for (var i = 0; i < transforms.length; ++i) {
                    transformSpec = transforms[i];
                    transformOpts = fluid.model.transform.lookupType(transformSpec.type);
                    transformer.transformHandler(transformSpec, transformer, transformOpts);
                }
            } else {
                // else we just have a normal single transform which will return 'undefined' as a flag to defeat cascading output
                transformSpec = rule.transform;
                transformOpts = fluid.model.transform.lookupType(transformSpec.type);
                togo = transformer.transformHandler(transformSpec, transformer, transformOpts);
            }
        }
        // if rule is an array, save path for later use in schema strategy on final applier (so output will be interpreted as array)
        if (fluid.isArrayable(rule)) {
            transformer.collectedFlatSchemaOpts = transformer.collectedFlatSchemaOpts || {};
            transformer.collectedFlatSchemaOpts[transformer.outputPrefix] = "array";
        }
        fluid.each(rule, function (value, key) {
            if (key !== "transform") {
                transformer.outputPrefixOp.push(key);
                var togo = transformer.expand(value, transformer);
                // Value expanders and arrays as rules implicitly output, unless they have nothing (undefined) to output
                if (togo !== undefined) {
                    fluid.model.transform.setValue(null, togo, transformer);
                    // ensure that expanders further up does not try to output this value as well.
                    togo = undefined;
                }
                transformer.outputPrefixOp.pop();
            }
        });
        return togo;
    };

    // unsupported, NON-API function
    // 3rd arg is disused by the framework and always defaults to fluid.model.transform.processRule
    fluid.model.transform.makeStrategy = function (transformer, handleFn, transformFn) {
        transformFn = transformFn || fluid.model.transform.processRule;
        transformer.expand = function (rules) {
            return transformFn(rules, transformer);
        };
        transformer.outputPrefixOp = fluid.model.makePathStack(transformer, "outputPrefix");
        transformer.inputPrefixOp = fluid.model.makePathStack(transformer, "inputPrefix");
        transformer.transformHandler = handleFn;
    };

    /* A special, empty, transform document representing the inversion of a transformation which does not not have an inverse
     */
    fluid.model.transform.uninvertibleTransform = Object.freeze({});

    /** Accepts a transformation document, and returns its inverse if all of its constituent transforms have inverses
     * defined via their individual invertConfiguration functions, or else `fluid.model.transform.uninvertibleTransform`
     * if any of them do not.
     * Note that this algorithm will give faulty results in many cases of compound transformation documents.
     * @param {Transform} rules - The model transformation document to be inverted
     * @return {Transform} The inverse transformation document if it can be computed easily, or
     * `fluid.model.transform.uninvertibleTransform` if it is clear that it cannot.
     */
    fluid.model.transform.invertConfiguration = function (rules) {
        var transformer = {
            inverted: []
        };
        fluid.model.transform.makeStrategy(transformer, fluid.model.transform.handleInvertStrategy);
        transformer.expand(rules);
        var invertible = transformer.inverted.indexOf(fluid.model.transform.uninvertibleTransform) === -1;
        return invertible ? {
            transform: transformer.inverted
        } : fluid.model.transform.uninvertibleTransform;
    };

    /** Compute the paths which will be read from the input document of the supplied transformation if it were operated.
     *
     * @param {Transform} rules - The transformation for which the input paths are to be computed.
     * @return {Array} - An array of paths which will be read by the document.
     */
    fluid.model.transform.collectInputPaths = function (rules) {
        var transformer = {
            inputPaths: []
        };
        fluid.model.transform.makeStrategy(transformer, fluid.model.transform.handleCollectStrategy);
        transformer.expand(rules);
        // Deduplicate input paths
        var inputPathHash = fluid.arrayToHash(transformer.inputPaths);
        return Object.keys(inputPathHash);
    };

    // unsupported, NON-API function
    fluid.model.transform.flatSchemaStrategy = function (flatSchema, getConfig) {
        var keys = fluid.model.sortByKeyLength(flatSchema);
        return function (root, segment, index, segs) {
            var path = getConfig.parser.compose.apply(null, segs.slice(0, index));
            // TODO: clearly this implementation could be much more efficient
            for (var i = 0; i < keys.length; ++i) {
                var key = keys[i];
                if (fluid.pathUtil.matchPath(key, path, true) !== null) {
                    return flatSchema[key];
                }
            }
        };
    };

    // unsupported, NON-API function
    fluid.model.transform.defaultSchemaValue = function (schemaValue) {
        var type = fluid.isPrimitive(schemaValue) ? schemaValue : schemaValue.type;
        return type === "array" ? [] : {};
    };

    // unsupported, NON-API function
    fluid.model.transform.isomorphicSchemaStrategy = function (source, getConfig) {
        return function (root, segment, index, segs) {
            var existing = fluid.get(source, segs.slice(0, index), getConfig);
            return fluid.isArrayable(existing) ? "array" : "object";
        };
    };

    // unsupported, NON-API function
    fluid.model.transform.decodeStrategy = function (source, options, getConfig) {
        if (options.isomorphic) {
            return fluid.model.transform.isomorphicSchemaStrategy(source, getConfig);
        }
        else if (options.flatSchema) {
            return fluid.model.transform.flatSchemaStrategy(options.flatSchema, getConfig);
        }
    };

    // unsupported, NON-API function
    fluid.model.transform.schemaToCreatorStrategy = function (strategy) {
        return function (root, segment, index, segs) {
            if (root[segment] === undefined) {
                var schemaValue = strategy(root, segment, index, segs);
                root[segment] = fluid.model.transform.defaultSchemaValue(schemaValue);
                return root[segment];
            }
        };
    };

    /* Transforms a model by a sequence of rules. Parameters as for fluid.model.transform,
     * only with an array accepted for "rules"
     */
    fluid.model.transform.sequence = function (source, rules, options) {
        for (var i = 0; i < rules.length; ++i) {
            source = fluid.model.transform(source, rules[i], options);
        }
        return source;
    };

    fluid.model.compareByPathLength = function (changea, changeb) {
        var pdiff = changea.path.length - changeb.path.length;
        return pdiff === 0 ? changea.sequence - changeb.sequence : pdiff;
    };

    /* Fires an accumulated set of change requests in increasing order of target pathlength */
    fluid.model.fireSortedChanges = function (changes, applier) {
        changes.sort(fluid.model.compareByPathLength);
        fluid.fireChanges(applier, changes);
    };

    /**
     * Transforms a model based on a specified expansion rules objects.
     * Rules objects take the form of:
     *   {
     *       "target.path": "value.el.path" || {
     *          transform: {
     *              type: "transform.function.path",
     *               ...
     *           }
     *       }
     *   }
     *
     * @param {Object} source - the model to transform
     * @param {Object} rules - a rules object containing instructions on how to transform the model
     * @param {Object} options - a set of rules governing the transformations. At present this may contain
     * the values <code>isomorphic: true</code> indicating that the output model is to be governed by the
     * same schema found in the input model, or <code>flatSchema</code> holding a flat schema object which
     * consists of a hash of EL path specifications with wildcards, to the values "array"/"object" defining
     * the schema to be used to construct missing trunk values.
     * @return {Any} The transformed model.
     */
    fluid.model.transformWithRules = function (source, rules, options) {
        options = options || {};

        var getConfig = fluid.model.escapedGetConfig;
        var setConfig = fluid.model.escapedSetConfig;

        var schemaStrategy = fluid.model.transform.decodeStrategy(source, options, getConfig);

        var transformer = {
            source: source,
            target: {
                // TODO: This should default to undefined to allow return of primitives, etc.
                model: schemaStrategy ? fluid.model.transform.defaultSchemaValue(schemaStrategy(null, "", 0, [""])) : {}
            },
            resolverGetConfig: getConfig,
            resolverSetConfig: setConfig,
            collectedFlatSchemaOpts: undefined, // to hold options for flat schema collected during transforms
            queuedChanges: [],
            queuedTransforms: [] // TODO: This is used only by wildcard applier - explain its operation
        };
        fluid.model.transform.makeStrategy(transformer, fluid.model.transform.handleTransformStrategy);
        transformer.applier = {
            fireChangeRequest: function (changeRequest) {
                changeRequest.sequence = transformer.queuedChanges.length;
                transformer.queuedChanges.push(changeRequest);
            }
        };
        fluid.bindRequestChange(transformer.applier);

        transformer.expand(rules);

        var rootSetConfig = fluid.copy(setConfig);
        // Modify schemaStrategy if we collected flat schema options for the setConfig of finalApplier
        if (transformer.collectedFlatSchemaOpts !== undefined) {
            $.extend(transformer.collectedFlatSchemaOpts, options.flatSchema);
            schemaStrategy = fluid.model.transform.flatSchemaStrategy(transformer.collectedFlatSchemaOpts, getConfig);
        }
        rootSetConfig.strategies = [fluid.model.defaultFetchStrategy, schemaStrategy ? fluid.model.transform.schemaToCreatorStrategy(schemaStrategy) :
            fluid.model.defaultCreatorStrategy];
        transformer.finalApplier = options.finalApplier || fluid.makeHolderChangeApplier(transformer.target, {resolverSetConfig: rootSetConfig});

        if (transformer.queuedTransforms.length > 0) {
            transformer.typeStack = [];
            transformer.pathOp = fluid.model.makePathStack(transformer, "path");
            fluid.model.transform.expandWildcards(transformer, source);
        }
        fluid.model.fireSortedChanges(transformer.queuedChanges, transformer.finalApplier);
        return transformer.target.model;
    };

    $.extend(fluid.model.transformWithRules, fluid.model.transform);
    fluid.model.transform = fluid.model.transformWithRules;

    /* Utility function to produce a standard options transformation record for a single set of rules */
    fluid.transformOne = function (rules) {
        return {
            transformOptions: {
                transformer: "fluid.model.transformWithRules",
                config: rules
            }
        };
    };

    /* Utility function to produce a standard options transformation record for multiple rules to be applied in sequence */
    fluid.transformMany = function (rules) {
        return {
            transformOptions: {
                transformer: "fluid.model.transform.sequence",
                config: rules
            }
        };
    };

})(jQuery, fluid_3_0_0);
