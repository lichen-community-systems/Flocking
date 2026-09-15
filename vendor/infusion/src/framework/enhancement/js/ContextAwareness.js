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

    fluid.registerNamespace("fluid.contextAware");

    fluid.defaults("fluid.contextAware.marker", {
        gradeNames: ["fluid.component"]
    });


    // unsupported, NON-API function
    fluid.contextAware.makeCheckMarkers = function (checks, path, instantiator) {
        fluid.each(checks, function (value, markerTypeName) {
            fluid.constructSingle(path, {
                type: markerTypeName,
                gradeNames: "fluid.contextAware.marker",
                value: value
            }, instantiator);
        });

    };

    /**
     * Peforms the computation for `fluid.contextAware.makeChecks` and returns a structure suitable for being sent to `fluid.contextAware.makeCheckMarkers` -
     *
     * @param {Object} checkHash - a hash of context awareness checks to compute
     * @return {Object} - A hash of marker type names to grade names - this can be sent to fluid.contextAware.makeCheckMarkers
     */
    // unsupported, NON-API function
    fluid.contextAware.performChecks = function (checkHash) {
        return fluid.transform(checkHash, function (checkRecord) {
            if (typeof(checkRecord) === "function") {
                checkRecord = {func: checkRecord};
            } else if (typeof(checkRecord) === "string") {
                checkRecord = {funcName: checkRecord};
            }
            if (fluid.isPrimitive(checkRecord)) {
                return checkRecord;
            } else if ("value" in checkRecord) {
                return checkRecord.value;
            } else if ("func" in checkRecord) {
                return checkRecord.func();
            } else if ("funcName" in checkRecord) {
                return fluid.invokeGlobalFunction(checkRecord.funcName);
            } else {
                fluid.fail("Error in contextAwareness check record ", checkRecord, " - must contain an entry with name value, func, or funcName");
            }
        });
    };

    /**
     * Takes an object whose keys are check context names and whose values are check records, designating a collection of context markers which might be registered at a location
     * in the component tree.
     *
     * @param {Object} checkHash - The keys in this structure are the context names to be supplied if the check passes, and the values are check records.
     * A check record contains:
     *    ONE OF:
     *    value {Any} [optional] A literal value name to be attached to the context
     *    func {Function} [optional] A zero-arg function to be called to compute the value
     *    funcName {String} [optional] The name of a zero-arg global function which will compute the value
     * If the check record consists of a Number or Boolean, it is assumed to be the value given to "value".
     * @param {String|Array} [path] - [optional] The path in the component tree at which the check markers are to be registered. If omitted, "" is assumed
     * @param {Instantiator} [instantiator] - [optional] The instantiator holding the component tree which will receive the markers. If omitted, use `fluid.globalInstantiator`.
     */
    fluid.contextAware.makeChecks = function (checkHash, path, instantiator) {
        var checkOptions = fluid.contextAware.performChecks(checkHash);
        fluid.contextAware.makeCheckMarkers(checkOptions, path, instantiator);
    };

    /**
     * Forgets a check made at a particular level of the component tree.
     *
     * @param {String[]} markerNames - The marker typeNames whose check values are to be forgotten.
     * @param {String|String[]} [path] - [optional] The path in the component tree at which the check markers are to be removed. If omitted, "" is assumed
     * @param {Instantiator} [instantiator] - [optional] The instantiator holding the component tree the markers are to be removed from. If omitted, use `fluid.globalInstantiator`.
     */
    fluid.contextAware.forgetChecks = function (markerNames, path, instantiator) {
        instantiator = instantiator || fluid.globalInstantiator;
        path = path || [];
        var markerArray = fluid.makeArray(markerNames);
        fluid.each(markerArray, function (markerName) {
            var memberName = fluid.typeNameToMemberName(markerName);
            var segs = fluid.model.parseToSegments(path, instantiator.parseEL, true);
            segs.push(memberName);
            fluid.destroy(segs, instantiator);
        });
    };

    /** A grade to be given to a component which requires context-aware adaptation.
     * This grade consumes configuration held in the block named "contextAwareness", which is an object whose keys are check namespaces and whose values hold
     * sequences of "checks" to be made in the component tree above the component. The value searched by
     * each check is encoded as the element named `contextValue` - this either represents an IoC reference to a component
     * or a particular value held at the component. If this reference has no path component, the path ".options.value" will be assumed.
     * These checks seek contexts which
     * have been previously registered using fluid.contextAware.makeChecks. The first context which matches
     * with a value of `true` terminates the search, and returns by applying the grade names held in `gradeNames` to the current component.
     * If no check matches, the grades held in `defaultGradeNames` will be applied.
     */
    fluid.defaults("fluid.contextAware", {
        gradeNames: ["{that}.check"],
        mergePolicy: {
            contextAwareness: "noexpand"
        },
        contextAwareness: {
            // Hash of names (check namespaces) to records: {
            //     checks: {}, // Hash of check namespace to: {
            //         contextValue: IoCExpression testing value in environment,
            //         gradeNames: gradeNames which will be output,
            //         priority: String/Number for priority of check [optional]
            //         equals: Value to be compared to contextValue [optional - default is `true`]
            //     defaultGradeNames: // String or String[] holding default gradeNames which will be output if no check matches [optional]
            //     priority: // Number or String encoding priority relative to other records (same format as with event listeners) [optional]
            // }
        },
        invokers: {
            check: {
                funcName: "fluid.contextAware.check",
                args: ["{that}", "{that}.options.contextAwareness"]
            }
        }
    });

    fluid.contextAware.getCheckValue = function (that, reference) {
        // cf. core of distributeOptions!
        var targetRef = fluid.parseContextReference(reference);
        var targetComponent = fluid.resolveContext(targetRef.context, that);
        var path = targetRef.path || ["options", "value"];
        var value = fluid.getForComponent(targetComponent, path);
        return value;
    };

    // unsupported, NON-API function
    fluid.contextAware.checkOne = function (that, contextAwareRecord) {
        if (contextAwareRecord.checks && contextAwareRecord.checks.contextValue) {
            fluid.fail("Nesting error in contextAwareness record ", contextAwareRecord, " - the \"checks\" entry must contain a hash and not a contextValue/gradeNames record at top level");
        }
        var checkList = fluid.parsePriorityRecords(contextAwareRecord.checks, "contextAwareness checkRecord");
        return fluid.find(checkList, function (check) {
            if (!check.contextValue) {
                fluid.fail("Cannot perform check for contextAwareness record ", check, " without a valid field named \"contextValue\"");
            }
            var value = fluid.contextAware.getCheckValue(that, check.contextValue);
            if (check.equals === undefined ? value : value === check.equals) {
                return check.gradeNames;
            }
        }, contextAwareRecord.defaultGradeNames);
    };

    // unsupported, NON-API function
    fluid.contextAware.check = function (that, contextAwarenessOptions) {
        var gradeNames = [];
        var contextAwareList = fluid.parsePriorityRecords(contextAwarenessOptions, "contextAwareness adaptationRecord");
        fluid.each(contextAwareList, function (record) {
            var matched = fluid.contextAware.checkOne(that, record);
            gradeNames = gradeNames.concat(fluid.makeArray(matched));
        });
        return gradeNames;
    };

    /** Given a set of options, broadcast an adaptation to all instances of a particular component in a particular context. ("new demands blocks").
     * This has the effect of fabricating a grade with a particular name with an options distribution to `{/ typeName}` for the required component,
     * and then constructing a single well-known instance of it.
     * Options layout:
     *  distributionName {String} A grade name - the name to be given to the fabricated grade
     *  targetName {String} A grade name - the name of the grade to receive the adaptation
     *  adaptationName {String} the name of the contextAwareness record to receive the record - this will be a simple string
     *  checkName {String} the name of the check within the contextAwareness record to receive the record - this will be a simple string
     *  record {Object} the record to be broadcast into contextAwareness - should contain entries
     *      contextValue {IoC expression} the context value to be checked to activate the adaptation
     *      gradeNames {String/String[]} the grade names to be supplied to the adapting target (matching advisedName)
     *
     * @param {Object} options - The options to use when making an adaptation.  See above for supported sub-options.
     */
    fluid.contextAware.makeAdaptation = function (options) {
        fluid.expect("fluid.contextAware.makeAdaptation", options, ["distributionName", "targetName", "adaptationName", "checkName", "record"]);
        fluid.defaults(options.distributionName, {
            gradeNames: ["fluid.component"],
            distributeOptions: {
                target: "{/ " + options.targetName + "}.options.contextAwareness." + options.adaptationName + ".checks." + options.checkName,
                record: options.record
            }
        });
        fluid.constructSingle([], options.distributionName);
    };

    // Context awareness for the browser environment

    fluid.contextAware.isBrowser = function () {
        return typeof(window) !== "undefined" && !!window.document;
    };

    fluid.contextAware.makeChecks({
        "fluid.browser": {
            funcName: "fluid.contextAware.isBrowser"
        }
    });

    // Context awareness for the reported browser platform name (operating system)

    fluid.registerNamespace("fluid.contextAware.browser");

    fluid.contextAware.browser.getPlatformName = function () {
        return typeof(navigator) !== "undefined" && navigator.platform ? navigator.platform : undefined;
    };

    // Context awareness for the reported user agent name

    fluid.contextAware.browser.getUserAgent = function () {
        return typeof(navigator) !== "undefined" && navigator.userAgent ? navigator.userAgent : undefined;
    };

    fluid.contextAware.makeChecks({
        "fluid.browser.platformName": {
            funcName: "fluid.contextAware.browser.getPlatformName"
        },
        "fluid.browser.userAgent": {
            funcName: "fluid.contextAware.browser.getUserAgent"
        }
    });

})(jQuery, fluid_3_0_0);
