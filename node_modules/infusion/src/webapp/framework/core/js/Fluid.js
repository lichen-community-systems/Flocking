/*!
 * Fluid Infusion v1.5
 *
 * Infusion is distributed under the Educational Community License 2.0 and new BSD licenses: 
 * http://wiki.fluidproject.org/display/fluid/Fluid+Licensing
 *
 * For information on copyright, see the individual Infusion source code files: 
 * https://github.com/fluid-project/infusion/
 */

/*
Copyright 2007-2010 University of Cambridge
Copyright 2007-2009 University of Toronto
Copyright 2007-2009 University of California, Berkeley
Copyright 2010-2011 Lucendo Development Ltd.
Copyright 2010 OCAD University
Copyright 2011 Charly Molter

Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.

You may obtain a copy of the ECL 2.0 License and BSD License at
https://github.com/fluid-project/infusion/raw/master/Infusion-LICENSE.txt
*/

// Declare dependencies
/*global console, window, fluid:true, fluid_1_5:true, jQuery, opera, YAHOO*/

// JSLint options 
/*jslint white: true, trailing: true, funcinvoke: true, continue: true, jslintok: true, undef: true, newcap: true, nomen: true, regexp: true, bitwise: true, browser: true, forin: true, maxerr: 100, indent: 4 */

var fluid_1_5 = fluid_1_5 || {};
var fluid = fluid || fluid_1_5;

(function ($, fluid) {
    
    fluid.version = "Infusion 1.5";
    
    // Export this for use in environments like node.js, where it is useful for
    // configuring stack trace behaviour
    fluid.Error = Error;
    
    fluid.environment = {
        fluid: fluid
    };
    
    var globalObject = window || {};
    
    fluid.singleThreadLocal = function (initFunc) {
        var value = initFunc();
        return function () {
            return value;
        };
    };
    
    // Return to the old strategy of monkey-patching this, since this is a most frequently used function within IoC
    fluid.threadLocal = fluid.singleThreadLocal;
    
    var softFailure = [false];
    
    // This function will be patched from FluidIoC.js in order to describe complex activities
    fluid.describeActivity = function () {
        return [];
    };
    
    /**
     * Signals an error to the framework. The default behaviour is to log a structured error message and throw a variety of
     * exception (hard or soft) - see fluid.pushSoftFailure for configuration
     *
     * @param {String} message the error message to log
     * @param ... Additional arguments, suitable for being sent to native console.log function
     */
    fluid.fail = function (message /*, ... */) { // jslint:ok - whitespace in arg list
        var args = fluid.makeArray(arguments);
        var activity = fluid.describeActivity();

        var topFailure = softFailure[0];
        if (typeof(topFailure) === "boolean") {
            fluid.setLogging(true);
            fluid.log.apply(null, ["ASSERTION FAILED: "].concat(args).concat(activity));          
            if (topFailure) {
                throw new Error(message);
            } else {
                message.fail(); // Intentionally cause a browser error by invoking a nonexistent function.
            }
        } else if (typeof(topFailure) === "function") {
            topFailure(args, activity);
        }
    };
    
    /** 
     * Configure the behaviour of fluid.fail by pushing or popping a disposition record onto a stack.
     * @param {Boolean|Number|Function} condition
     & Supply either a boolean flag choosing between built-in framework strategies to be used in fluid.fail 
     * - <code>false</code>, the default causes a "hard failure" by using a nonexistent property on a String, which
     * will in all known environments trigger an unhandleable exception which aids debugging. The boolean value
     * <code>true</code> downgrades this behaviour to throw a conventional exception, which is more appropriate in
     * test cases which need to demonstrate failure, as well as in some production environments.
     * The argument may also be a function, which will be called with two arguments, args (the complete arguments to
     * fluid.fail) and activity, an array of strings describing the current framework invocation state.
     * Finally, the argument may be the number <code>-1</code> indicating that the previously supplied disposition should
     * be popped off the stack 
     */ 
    fluid.pushSoftFailure = function (condition) {
        if (typeof (condition) === "boolean" || typeof (condition) === "function") {
            softFailure.unshift(condition);
        } else if (condition === -1) {
            softFailure.shift();
        }
    };
    
    fluid.notrycatch = false;
    
    // A wrapper for the try/catch/finally language feature, to aid debugging on environments
    // such as IE, where any try will destroy stack information for errors
    fluid.tryCatch = function (tryfun, catchfun, finallyfun) {
        finallyfun = finallyfun || fluid.identity;
        if (fluid.notrycatch) {
            var togo = tryfun();
            finallyfun();
            return togo;
        } else {
            try {
                return tryfun();
            } catch (e) {
                if (catchfun) {
                    catchfun(e);
                } else {
                    throw (e);
                }
            } finally {
                finallyfun();
            }
        }
    };
    
    // TODO: rescued from kettleCouchDB.js - clean up in time
    fluid.expect = function (name, members, target) {
        fluid.transform(fluid.makeArray(members), function (key) {
            if (typeof target[key] === "undefined") {
                fluid.fail(name + " missing required parameter " + key);
            }
        });
    };

    // Logging

    var logging;
        
    /** Returns whether logging is enabled **/
    fluid.isLogging = function () {
        return logging;
    };

    /** method to allow user to enable logging (off by default) */
    fluid.setLogging = function (enabled) {
        if (typeof enabled === "boolean") {
            logging = enabled;
        } else {
            logging = false;
        }
    };

    // On some dodgy environments (notably IE9 and recent alphas of Firebug 1.8),
    // console.log/debug are incomplete function objects and need to be operated via
    // this trick: http://stackoverflow.com/questions/5472938/does-ie9-support-console-log-and-is-it-a-real-function
    fluid.applyHostFunction = function (obj, func, args) {
        if (func.apply) {
            func.apply(obj, args);
        } else {
            var applier = Function.prototype.bind.call(func, obj);
            applier.apply(obj, args);
        }
    };

    /** Log a message to a suitable environmental console. If the standard "console"
     * stream is available, the message will be sent there - otherwise either the
     * YAHOO logger or the Opera "postError" stream will be used. Logging must first
     * be enabled with a call to the fluid.setLogging(true) function.
     */
    fluid.log = function (message /*, ... */) { // jslint:ok - whitespace in arg list
        if (logging) {
            var arg0 = fluid.renderTimestamp(new Date()) + ":  ";
            var args = [arg0].concat(fluid.makeArray(arguments));
            var str = args.join("");
            if (typeof (console) !== "undefined") {
                if (console.debug) {
                    fluid.applyHostFunction(console, console.debug, args);
                } else if (typeof (console.log) === "function") {
                    fluid.applyHostFunction(console, console.log, args);
                } else {
                    console.log(str); // this branch executes on old IE, fully synthetic console.log
                }
            } else if (typeof (YAHOO) !== "undefined") {
                YAHOO.log(str);
            } else if (typeof (opera) !== "undefined") {
                opera.postError(str);
            }
        }
    };
     
    // Functional programming utilities.
               
    /** A basic utility that returns its argument unchanged */
    
    fluid.identity = function (arg) {
        return arg;
    };
    
    // Framework and instantiation functions.

    
    /** Returns true if the argument is a value other than null or undefined **/
    fluid.isValue = function (value) {
        return value !== undefined && value !== null;
    };
    
    /** Returns true if the argument is a primitive type **/
    fluid.isPrimitive = function (value) {
        var valueType = typeof (value);
        return !value || valueType === "string" || valueType === "boolean" || valueType === "number" || valueType === "function";
    };
    
    /** Determines whether the supplied object is an array. The strategy used is an optimised
     * approach taken from an earlier version of jQuery - detecting whether the toString() version
     * of the object agrees with the textual form [object Array], or else whether the object is a
     * jQuery object (the most common source of "fake arrays").
     */
    fluid.isArrayable = function (totest) {
        return totest && (totest.jquery || Object.prototype.toString.call(totest) === "[object Array]");
    };
    
    fluid.isDOMNode = function (obj) {
      // This could be more sound, but messy:
      // http://stackoverflow.com/questions/384286/javascript-isdom-how-do-you-check-if-a-javascript-object-is-a-dom-object
        return obj && typeof (obj.nodeType) === "number";
    };
    
    /** Return an empty container as the same type as the argument (either an
     * array or hash */
    fluid.freshContainer = function (tocopy) {
        return fluid.isArrayable(tocopy) ? [] : {};
    };
    
    /** Performs a deep copy (clone) of its argument **/
    
    fluid.copy = function (tocopy) {
        if (fluid.isPrimitive(tocopy)) {
            return tocopy;
        }
        return $.extend(true, fluid.freshContainer(tocopy), tocopy);
    };
            
    /** Corrected version of jQuery makeArray that returns an empty array on undefined rather than crashing.
      * We don't deal with as many pathological cases as jQuery **/
    fluid.makeArray = function (arg) {
        var togo = [];
        if (arg !== null && arg !== undefined) {
            if (fluid.isPrimitive(arg) || typeof(arg.length) !== "number") {
                togo.push(arg);
            }
            else {
                for (var i = 0; i < arg.length; ++ i) {
                    togo[i] = arg[i];
                }
            }
        }
        return togo;
    };
    
    function transformInternal(source, togo, key, args) {
        var transit = source[key];
        for (var j = 0; j < args.length - 1; ++j) {
            transit = args[j + 1](transit, key);
        }
        togo[key] = transit;
    }
    
    /** Return a list or hash of objects, transformed by one or more functions. Similar to
     * jQuery.map, only will accept an arbitrary list of transformation functions and also
     * works on non-arrays.
     * @param source {Array or Object} The initial container of objects to be transformed.
     * @param fn1, fn2, etc. {Function} An arbitrary number of optional further arguments,
     * all of type Function, accepting the signature (object, index), where object is the
     * list member to be transformed, and index is its list index. Each function will be
     * applied in turn to each list member, which will be replaced by the return value
     * from the function.
     * @return The finally transformed list, where each member has been replaced by the
     * original member acted on by the function or functions.
     */
    fluid.transform = function (source) {
        var togo = fluid.freshContainer(source);
        if (fluid.isArrayable(source)) {
            for (var i = 0; i < source.length; ++i) {
                transformInternal(source, togo, i, arguments);
            }
        } else {
            for (var key in source) {
                transformInternal(source, togo, key, arguments);
            }
        }
        return togo;
    };
    
    /** Better jQuery.each which works on hashes as well as having the arguments
     * the right way round.
     * @param source {Arrayable or Object} The container to be iterated over
     * @param func {Function} A function accepting (value, key) for each iterated
     * object. This function may return a value to terminate the iteration
     */
    fluid.each = function (source, func) {
        if (fluid.isArrayable(source)) {
            for (var i = 0; i < source.length; ++i) {
                func(source[i], i);
            }
        } else {
            for (var key in source) {
                func(source[key], key);
            }
        }
    };
    
    /** Scan through a list or hash of objects, terminating on the first member which
     * matches a predicate function.
     * @param source {Arrayable or Object} The list or hash of objects to be searched.
     * @param func {Function} A predicate function, acting on a member. A predicate which
     * returns any value which is not <code>undefined</code> will terminate
     * the search. The function accepts (object, index).
     * @param deflt {Object} A value to be returned in the case no predicate function matches
     * a list member. The default will be the natural value of <code>undefined</code>
     * @return The first return value from the predicate function which is not <code>undefined</code>
     */
    fluid.find = function (source, func, deflt) {
        var disp;
        if (fluid.isArrayable(source)) {
            for (var i = 0; i < source.length; ++i) {
                disp = func(source[i], i);
                if (disp !== undefined) {
                    return disp;
                }
            }
        } else {
            for (var key in source) {
                disp = func(source[key], key);
                if (disp !== undefined) {
                    return disp;
                }
            }
        }
        return deflt;
    };
    
    /** Scan through a list of objects, "accumulating" a value over them
     * (may be a straightforward "sum" or some other chained computation).
     * @param list {Array} The list of objects to be accumulated over.
     * @param fn {Function} An "accumulation function" accepting the signature (object, total, index) where
     * object is the list member, total is the "running total" object (which is the return value from the previous function),
     * and index is the index number.
     * @param arg {Object} The initial value for the "running total" object.
     * @return {Object} the final running total object as returned from the final invocation of the function on the last list member.
     */
    fluid.accumulate = function (list, fn, arg) {
        for (var i = 0; i < list.length; ++i) {
            arg = fn(list[i], arg, i);
        }
        return arg;
    };
    
    /** Can through a list of objects, removing those which match a predicate. Similar to
     * jQuery.grep, only acts on the list in-place by removal, rather than by creating
     * a new list by inclusion.
     * @param source {Array|Object} The list of objects to be scanned over.
     * @param fn {Function} A predicate function determining whether an element should be
     * removed. This accepts the standard signature (object, index) and returns a "truthy"
     * result in order to determine that the supplied object should be removed from the list.
     * @return The list, transformed by the operation of removing the matched elements. The
     * supplied list is modified by this operation.
     */
    fluid.remove_if = function (source, fn) {
        if (fluid.isArrayable(source)) {
            for (var i = 0; i < source.length; ++i) {
                if (fn(source[i], i)) {
                    source.splice(i, 1);
                    --i;
                }
            }
        } else {
            for (var key in source) {
                if (fn(source[key], key)) {
                    delete source[key];
                }
            }
        }
        return source;
    };
    
    /** Accepts an object to be filtered, and a list of keys. Either all keys not present in
     * the list are removed, or only keys present in the list are returned.
     * @param toFilter {Array|Object} The object to be filtered - this will be modified by the operation
     * @param keys {Array of String} The list of keys to operate with
     * @param exclude {boolean} If <code>true</code>, the keys listed are removed rather than included
     * @return the filtered object (the same object that was supplied as <code>toFilter</code>
     */
    
    fluid.filterKeys = function (toFilter, keys, exclude) {
        return fluid.remove_if($.extend({}, toFilter), function (value, key) {
            return exclude ^ ($.inArray(key, keys) === -1);
        });
    };
    
    /** A convenience wrapper for <code>fluid.filterKeys</code> with the parameter <code>exclude</code> set to <code>true</code>
     *  Returns the supplied object with listed keys removed */

    fluid.censorKeys = function (toCensor, keys) {
        return fluid.filterKeys(toCensor, keys, true);
    };
    
    fluid.makeFlatten = function (index) {
        return function (obj) {
            var togo = [];
            fluid.each(obj, function (value, key) {
                togo.push(arguments[index]);
            });
            return togo;
        };
    };
    
    /** Return the keys in the supplied object as an array **/
    fluid.keys = fluid.makeFlatten(1);
    
    /** Return the values in the supplied object as an array **/
    fluid.values = fluid.makeFlatten(0);
    
    /**
     * Searches through the supplied object, and returns <code>true</code> if the supplied value
     * can be found
     */
    fluid.contains = function (obj, value) {
        return obj ? fluid.find(obj, function (thisValue, key) {
            if (value === thisValue) {
                return true;
            }
        }) : undefined;
    };
    
    /**
     * Searches through the supplied object for the first value which matches the one supplied.
     * @param obj {Object} the Object to be searched through
     * @param value {Object} the value to be found. This will be compared against the object's
     * member using === equality.
     * @return {String} The first key whose value matches the one supplied, or <code>null</code> if no
     * such key is found.
     */
    fluid.keyForValue = function (obj, value) {
        return fluid.find(obj, function (thisValue, key) {
            if (value === thisValue) {
                return key;
            }
        });
    };
    
    /**
     * This method is now deprecated and will be removed in a future release of Infusion.
     * See fluid.keyForValue instead.
     */
    fluid.findKeyInObject = fluid.keyForValue;
    
    /** Converts an array into an object whose keys are the elements of the array, each with the value "true"
     */
    
    fluid.arrayToHash = function (array) {
        var togo = {};
        fluid.each(array, function (el) {
            togo[el] = true;
        });
        return togo;
    };
    
    /**
     * Clears an object or array of its contents. For objects, each property is deleted.
     *
     * @param {Object|Array} target the target to be cleared
     */
    fluid.clear = function (target) {
        if (fluid.isArrayable(target)) {
            target.length = 0;
        } else {
            for (var i in target) {
                delete target[i];
            }
        }
    };
    
   /**
    * @param boolean ascending <code>true</code> if a comparator is to be returned which
    * sorts strings in descending order of length
    */
    fluid.compareStringLength = function (ascending) {
        return ascending ? function (a, b) {
            return a.length - b.length;
        } : function (a, b) {
            return b.length - a.length;
        };
    };
        
    // Model functions
    fluid.model = {}; // cannot call registerNamespace yet since it depends on fluid.model
       
    /** Another special "marker object" representing that a distinguished
     * (probably context-dependent) value should be substituted.
     */
    fluid.VALUE = {type: "fluid.marker", value: "VALUE"};
    
    /** Another special "marker object" representing that no value is present (where
     * signalling using the value "undefined" is not possible) */
    fluid.NO_VALUE = {type: "fluid.marker", value: "NO_VALUE"};
    
    /** A marker indicating that a value requires to be expanded after component construction begins **/
    fluid.EXPAND = {type: "fluid.marker", value: "EXPAND"};
    /** A marker indicating that a value requires to be expanded immediately**/
    fluid.EXPAND_NOW = {type: "fluid.marker", value: "EXPAND_NOW"};
    
    /** Determine whether an object is any marker, or a particular marker - omit the
     * 2nd argument to detect any marker
     */
    fluid.isMarker = function (totest, type) {
        if (!totest || typeof (totest) !== 'object' || totest.type !== "fluid.marker") {
            return false;
        }
        if (!type) {
            return true;
        }
        return totest === type;
    };
   
    /** Copy a source "model" onto a target **/
    fluid.model.copyModel = function (target, source) {
        fluid.clear(target);
        $.extend(true, target, source);
    };
    
    /** Parse an EL expression separated by periods (.) into its component segments.
     * @param {String} EL The EL expression to be split
     * @return {Array of String} the component path expressions.
     * TODO: This needs to be upgraded to handle (the same) escaping rules (as RSF), so that
     * path segments containing periods and backslashes etc. can be processed, and be harmonised
     * with the more complex implementations in fluid.pathUtil(data binding).
     */
    fluid.model.parseEL = function (EL) {
        return EL === "" ? [] : String(EL).split('.');
    };
    
    /** Compose an EL expression from two separate EL expressions. The returned
     * expression will be the one that will navigate the first expression, and then
     * the second, from the value reached by the first. Either prefix or suffix may be
     * the empty string **/
    
    fluid.model.composePath = function (prefix, suffix) {
        return prefix === "" ? suffix : (suffix === "" ? prefix : prefix + "." + suffix);
    };
    
    /** Compose any number of path segments, none of which may be empty **/
    fluid.model.composeSegments = function () {
        return fluid.makeArray(arguments).join(".");
    };
    
    /** Helpful alias for old-style API **/
    fluid.path = fluid.model.composeSegments;
    fluid.composePath = fluid.model.composePath;


    // unsupported, NON-API function
    fluid.requireDataBinding = function () {
        fluid.fail("Please include DataBinding.js in order to operate complex model accessor configuration");
    };
    
    fluid.model.setWithStrategy = fluid.model.getWithStrategy = fluid.requireDataBinding;
    
    // unsupported, NON-API function
    fluid.model.resolvePathSegment = function (root, segment, create, origEnv) {
        if (!origEnv && root.resolvePathSegment) {
            return root.resolvePathSegment(segment);
        }
        if (create && root[segment] === undefined) {
            // This optimisation in this heavily used function has a fair effect
            return root[segment] = {};
        }
        return root[segment];
    };

    // unsupported, NON-API function   
    fluid.model.pathToSegments = function (EL, config) {
        var parser = config && config.parser ? config.parser.parse : fluid.model.parseEL;
        var segs = typeof(EL) === "number" || typeof(EL) === "string" ? parser(EL) : EL;
        return segs;
    };
    
    // Overall strategy skeleton for all implementations of fluid.get/set
    fluid.model.accessImpl = function (root, EL, newValue, config, initSegs, returnSegs, traverser) {
        var segs = fluid.model.pathToSegments(EL, config);
        var initPos = 0;
        if (initSegs) {
            initPos = initSegs.length;
            segs = initSegs.concat(segs);
        }
        var uncess = newValue === fluid.NO_VALUE ? 0 : 1;
        var root = traverser(root, segs, initPos, config, uncess);
        if (newValue === fluid.NO_VALUE || newValue === fluid.VALUE) { // get or custom
            return returnSegs ? {root: root, segs: segs} : root;
        }
        else { // set
            root[segs[segs.length - 1]] = newValue; 
        }
    }
    
    // unsupported, NON-API function
    fluid.model.accessSimple = function (root, EL, newValue, environment, initSegs, returnSegs) {
        return fluid.model.accessImpl(root, EL, newValue, environment, initSegs, returnSegs, fluid.model.traverseSimple);
    };
    
    fluid.model.traverseSimple = function (root, segs, initPos, environment, uncess) {
        var origEnv = environment;
        var limit = segs.length - uncess;
        for (var i = 0; i < limit; ++i) {
            if (!root) {
                return root;
            }
            var segment = segs[i];
            if (environment && environment[segment]) {
                root = environment[segment];
            } else {
                root = fluid.model.resolvePathSegment(root, segment, uncess === 1, origEnv);
            }
            environment = null;
        }
        return root;
    };
    
    fluid.model.setSimple = function (root, EL, newValue, environment, initSegs) {
        fluid.model.accessSimple(root, EL, newValue, environment, initSegs, false);
    };
    
    /** Optimised version of fluid.get for uncustomised configurations **/
    
    fluid.model.getSimple = function (root, EL, environment, initSegs) {
        if (EL === null || EL === undefined || EL.length === 0) {
            return root;
        }
        return fluid.model.accessSimple(root, EL, fluid.NO_VALUE, environment, initSegs, false);
    };
    
    // unsupported, NON-API function
    // Returns undefined to signal complex configuration which needs to be farmed out to DataBinding.js
    // any other return represents an environment value AND a simple configuration we can handle here
    fluid.decodeAccessorArg = function (arg3) {
        return (!arg3 || arg3 === fluid.model.defaultGetConfig || arg3 === fluid.model.defaultSetConfig) ?
            null : (arg3.type === "environment" ? arg3.value : undefined);
    };
    
    fluid.set = function (root, EL, newValue, config, initSegs) {
        var env = fluid.decodeAccessorArg(config);
        if (env === undefined) {
            fluid.model.setWithStrategy(root, EL, newValue, config, initSegs);
        } else {
            fluid.model.setSimple(root, EL, newValue, env, initSegs);
        }
    };
    
    /** Evaluates an EL expression by fetching a dot-separated list of members
     * recursively from a provided root.
     * @param root The root data structure in which the EL expression is to be evaluated
     * @param {string/array} EL The EL expression to be evaluated, or an array of path segments
     * @param config An optional configuration or environment structure which can customise the fetch operation
     * @return The fetched data value.
     */
    
    fluid.get = function (root, EL, config, initSegs) {
        var env = fluid.decodeAccessorArg(config);
        return env === undefined ?
            fluid.model.getWithStrategy(root, EL, config, initSegs)
            : fluid.model.accessImpl(root, EL, fluid.NO_VALUE, env, null, false, fluid.model.traverseSimple); 
    };

    // This backward compatibility will be maintained for a number of releases, probably until Fluid 2.0
    fluid.model.setBeanValue = fluid.set;
    fluid.model.getBeanValue = fluid.get;
    
    fluid.getGlobalValue = function (path, env) {
        if (path) {
            env = env || fluid.environment;
            return fluid.get(globalObject, path, {type: "environment", value: env});
        }
    };
    
    /**
     * Allows for the calling of a function from an EL expression "functionPath", with the arguments "args", scoped to an framework version "environment".
     * @param {Object} functionPath - An EL expression
     * @param {Object} args - An array of arguments to be applied to the function, specified in functionPath
     * @param {Object} environment - (optional) The object to scope the functionPath to  (typically the framework root for version control)
     */
    fluid.invokeGlobalFunction = function (functionPath, args, environment) {
        var func = fluid.getGlobalValue(functionPath, environment);
        if (!func) {
            fluid.fail("Error invoking global function: " + functionPath + " could not be located");
        } else {
            return func.apply(null, args);
        }
    };
    
    /** Registers a new global function at a given path (currently assumes that
     * it lies within the fluid namespace)
     */
    
    fluid.registerGlobalFunction = function (functionPath, func, env) {
        env = env || fluid.environment;
        fluid.set(globalObject, functionPath, func, {type: "environment", value: env});
    };
    
    fluid.setGlobalValue = fluid.registerGlobalFunction;
    
    /** Ensures that an entry in the global namespace exists **/
    fluid.registerNamespace = function (naimspace, env) {
        env = env || fluid.environment;
        var existing = fluid.getGlobalValue(naimspace, env);
        if (!existing) {
            existing = {};
            fluid.setGlobalValue(naimspace, existing, env);
        }
        return existing;
    };
    
    // stubs for two functions in FluidDebugging.js
    fluid.dumpEl = fluid.identity;
    fluid.renderTimestamp = fluid.identity;
    
    
    /*** The Model Events system. ***/
    
    fluid.registerNamespace("fluid.event");
    
    fluid.generateUniquePrefix = function () {
        return (Math.floor(Math.random() * 1e12)).toString(36) + "-";
    };
    
    var fluid_prefix = fluid.generateUniquePrefix();
    
    var fluid_guid = 1;
    
    /** Allocate an string value that will be very likely unique within this Fluid scope (frame or process) **/
    
    fluid.allocateGuid = function () {
        return fluid_prefix + (fluid_guid++);
    };
    
    fluid.event.identifyListener = function (listener) {
        if (!listener.$$fluid_guid) {
            listener.$$fluid_guid = fluid.allocateGuid();
        }
        return listener.$$fluid_guid;
    };
    
    // unsupported, NON-API function
    fluid.event.impersonateListener = function (origListener, newListener) {
        fluid.event.identifyListener(origListener);
        newListener.$$fluid_guid = origListener.$$fluid_guid;
    };
    
    // unsupported, NON-API function
    fluid.event.mapPriority = function (priority, count) {
        return (priority === null || priority === undefined ? -count :
           (priority === "last" ? -Number.MAX_VALUE :
              (priority === "first" ? Number.MAX_VALUE : priority)));
    };
    
    // unsupported, NON-API function
    fluid.event.listenerComparator = function (recA, recB) {
        return recB.priority - recA.priority;
    };
    
    // unsupported, NON-API function
    fluid.event.sortListeners = function (listeners) {
        var togo = [];
        fluid.each(listeners, function (listener) {
            togo.push(listener);
        });
        return togo.sort(fluid.event.listenerComparator);
    };
    
    // unsupported, NON-API function
    fluid.event.resolveListener = function (listener) {
        if (listener.globalName) {
            var listenerFunc = fluid.getGlobalValue(listener.globalName);
            if (!listenerFunc) {
                fluid.fail("Unable to look up name " + listener.globalName + " as a global function");
            } else {
                listener = listenerFunc;
            }
        }
        return listener;
    };
    
    fluid.event.nameEvent = function (that, eventName) {
        return eventName + " of " + fluid.nameComponent(that);
    };
    
    /** Construct an "event firer" object which can be used to register and deregister
     * listeners, to which "events" can be fired. These events consist of an arbitrary
     * function signature. General documentation on the Fluid events system is at
     * http://wiki.fluidproject.org/display/fluid/The+Fluid+Event+System .
     * @param {Boolean} unicast If <code>true</code>, this is a "unicast" event which may only accept
     * a single listener.
     * @param {Boolean} preventable If <code>true</code> the return value of each handler will
     * be checked for <code>false</code> in which case further listeners will be shortcircuited, and this
     * will be the return value of fire()
     */
    // This name will be deprecated in Fluid 2.0 for fluid.makeEventFirer (or fluid.eventFirer)
    fluid.event.getEventFirer = function (unicast, preventable, name) {
        var listeners; // = {}
        var byId; // = {}
        var sortedListeners; // = []
        
        function fireToListeners(listeners, args, wrapper) {
            if (!listeners) { return; }
            fluid.log("Firing event " + name + " to list of " + listeners.length + " listeners");
            for (var i = 0; i < listeners.length; ++i) {
                var lisrec = listeners[i];
                lisrec.listener = fluid.event.resolveListener(lisrec.listener);
                var listener = lisrec.listener;

                if (lisrec.predicate && !lisrec.predicate(listener, args)) {
                    continue;
                }
                var value = fluid.tryCatch(function () {
                    var ret = (wrapper ? wrapper(listener) : listener).apply(null, args);
                    if (preventable && ret === false) {
                        return false;
                    }
                    if (unicast) {
                        return ret;
                    }
                }, function (e) { // jslint:ok - function within a loop, only invoked synchronously
                    fluid.log("FireEvent received exception " + e.message + " e " + e + " firing to listener " + i);
                    throw (e);
                }); // jslint:ok - function within loop
                if (value !== undefined) {
                    return value;
                }
            }
        }
        var identify = fluid.event.identifyListener;
        
        var that;
        var lazyInit = function () { // Lazy init function to economise on object references
            listeners = {};
            byId = {};
            sortedListeners = [];
            that.addListener = function (listener, namespace, predicate, priority) {
                if (!listener) {
                    return;
                }
                if (unicast) {
                    namespace = "unicast";
                }
                if (typeof(listener) === "string") {
                    listener = {globalName: listener};
                }
                var id = identify(listener);
                namespace = namespace || id;
                var record = {listener: listener, predicate: predicate,
                    namespace: namespace, 
                    priority: fluid.event.mapPriority(priority, sortedListeners.length)};

                listeners[namespace] = byId[id] = record;
                sortedListeners = fluid.event.sortListeners(listeners);
            };
            that.addListener.apply(null, arguments);
        };
        that = {
            name: name,
            typeName: "fluid.event.firer",
            addListener: function () {
                lazyInit.apply(null, arguments);
            },

            removeListener: function (listener) {
                if (!listeners) { return; }
                var namespace;
                if (typeof (listener) === "string") {
                    namespace = listener;
                    var record = listeners[listener];
                    if (!record) {
                        return;
                    }
                    listener = record.listener;
                } 
                var id = identify(listener);
                if (!id) {
                    fluid.fail("Cannot remove unregistered listener function ", listener, " from event " + that.name);
                }
                namespace = namespace || (byId[id] && byId[id].namespace) || id;
                delete byId[id];
                delete listeners[namespace];
                sortedListeners = fluid.event.sortListeners(listeners);
            },
            // NB - this method exists currently solely for the convenience of the new,
            // transactional changeApplier. As it exists it is hard to imagine the function
            // being helpful to any other client. We need to get more experience on the kinds
            // of listeners that are useful, and ultimately factor this method away.
            fireToListeners: function (listeners, args, wrapper) {
                return fireToListeners(listeners, args, wrapper);
            },
            fire: function () {
                return fireToListeners(sortedListeners, arguments);
            }
        };
        return that;
    };
    
    fluid.makeEventFirer = fluid.event.getEventFirer;
    
    /** Fire the specified event with supplied arguments. This call is an optimisation utility
     * which handles the case where the firer has not been instantiated (presumably as a result
     * of having no listeners registered
     */
     
    fluid.fireEvent = function (component, path, args) {
        var firer = fluid.get(component, path);
        if (firer) {
            firer.fire.apply(null, fluid.makeArray(args));
        }
    };
    
    // unsupported, NON-API function
    fluid.event.addListenerToFirer = function (firer, value, namespace, wrapper) {
        wrapper = wrapper || fluid.identity;
        if (fluid.isArrayable(value)) {
            for (var i = 0; i < value.length; ++i) {
                fluid.event.addListenerToFirer(firer, value[i], namespace, wrapper);
            }
        } else if (typeof (value) === "function" || typeof (value) === "string") {
            wrapper(firer).addListener(value, namespace);
        } else if (value && typeof (value) === "object") {
            wrapper(firer).addListener(value.listener, namespace || value.namespace, value.predicate, value.priority);
        }
    };
    
    // unsupported, NON-API function - non-IOC passthrough
    fluid.event.resolveListenerRecord = function (records) {
        return { records: records };
    };
    
    // unsupported, NON-API function
    fluid.mergeListeners = function (that, events, listeners) {
        fluid.each(listeners, function (value, key) {
            var firer, namespace;
            if (key.charAt(0) === "{") {
                if (!fluid.expandOptions) {
                    fluid.fail("fluid.expandOptions could not be loaded - please include FluidIoC.js in order to operate IoC-driven event with descriptor " +
                        key);
                }
                firer = fluid.expandOptions(key, that);
            } else {
                var keydot = key.indexOf(".");
            
                if (keydot !== -1) {
                    namespace = key.substring(keydot + 1);
                    key = key.substring(0, keydot);
                }
                if (!events[key]) {
                    fluid.fail("Listener registered for event " + key + " which is not defined for this component");
                    events[key] = fluid.makeEventFirer(null, null, fluid.event.nameEvent(that, key));
                }
                firer = events[key];
            }
            record = fluid.event.resolveListenerRecord(value, that, key);
            fluid.event.addListenerToFirer(firer, record.records, namespace, record.adderWrapper);
        });
    };
    
    function initEvents(that, events, pass) {
        fluid.each(events, function (eventSpec, eventKey) {
            var isIoCEvent = eventSpec && (typeof (eventSpec) !== "string" || eventSpec.charAt(0) === "{");
            var event;
            if (isIoCEvent && pass === "IoC") {
                if (!fluid.event.resolveEvent) {
                    fluid.fail("fluid.event.resolveEvent could not be loaded - please include FluidIoC.js in order to operate IoC-driven event with descriptor ",
                        eventSpec);
                } else {
                    event = fluid.event.resolveEvent(that, eventKey, eventSpec);
                }
            } else if (pass === "flat") {
                event = fluid.makeEventFirer(eventSpec === "unicast", eventSpec === "preventable", fluid.event.nameEvent(that, eventKey));
            }
            if (event) {
                that.events[eventKey] = event;
            }
        });
    }
    
    // unsupported, NON-API function
    fluid.instantiateFirers = function (that, options) {
        that.events = {};
        // TODO: manual 2-phase instantiation since we have no GINGER WORLD
        initEvents(that, options.events, "flat");
        initEvents(that, options.events, "IoC");
        // TODO: manually expand these late so that members attached to ourselves with preInitFunction can be detected
        //var listeners = fluid.expandOptions ? fluid.expandOptions(options.listeners, that) : options.listeners;
        fluid.mergeListeners(that, that.events, options.listeners);
    };
    
    fluid.mergeListenerPolicy = function (target, source, key) {
        // cf. triage in mergeListeners
        var hasNamespace = key.charAt(0) !== "{" && key.indexOf(".") !== -1;
        return hasNamespace ? (source ? source : target)
            : fluid.makeArray(target).concat(fluid.makeArray(source));
    };
    
    fluid.mergeListenersPolicy = function (target, source) {
        target = target || {};
        fluid.each(source, function (listeners, key) {
            target[key] = fluid.mergeListenerPolicy(target[key], listeners, key);
        });
        return target;
    };
    
    /*** DEFAULTS AND OPTIONS MERGING SYSTEM ***/
    
    var defaultsStore = {};
        
    var resolveGradesImpl = function (gs, gradeNames) {
        gradeNames = fluid.makeArray(gradeNames);
        fluid.each(gradeNames, function (gradeName) {
            var options = fluid.rawDefaults(gradeName) || {};
            gs.gradeHash[gradeName] = true;
            gs.gradeChain.push(gradeName);
            gs.optionsChain.push(options);
            var oGradeNames = fluid.makeArray(options.gradeNames);
            fluid.each(oGradeNames, function (parent) {
                if (!gs.gradeHash[parent]) {
                    resolveGradesImpl(gs, parent);
                }
            });
        });
        return gs;
    };
    
    // unsupported, NON-API function
    fluid.resolveGradeStructure = function (defaultName, gradeNames) {
        var gradeStruct = {
            gradeChain: [defaultName],
            gradeHash: {},
            optionsChain: []
        };
        return resolveGradesImpl(gradeStruct, gradeNames);
    };
        
    var mergedDefaultsCache = {};
    
    fluid.gradeNamesToKey = function (gradeNames, defaultName) {
        return defaultName + "|" + fluid.makeArray(gradeNames).sort().join("|");
    };
    
    // unsupported, NON-API function
    fluid.resolveGrade = function (defaults, defaultName, gradeNames) {
        var mergeArgs = [defaults];
        if (gradeNames) {
            var gradeStruct = fluid.resolveGradeStructure(defaultName, gradeNames);
            mergeArgs = gradeStruct.optionsChain.reverse().concat(mergeArgs).concat({gradeNames: gradeStruct.gradeChain});
        }
        var mergePolicy = {};
        for (var i = 0; i < mergeArgs.length; ++ i) {
            mergePolicy = $.extend(true, mergePolicy, mergeArgs[i].mergePolicy);
        }
        mergeArgs = [mergePolicy, {}].concat(mergeArgs);
        var mergedDefaults = fluid.merge.apply(null, mergeArgs);
        return mergedDefaults;
    };
    
    fluid.getGradedDefaults = function (defaults, defaultName, gradeNames) {
        var key = fluid.gradeNamesToKey(gradeNames, defaultName);
        var mergedDefaults = mergedDefaultsCache[key];
        if (!mergedDefaults) {
            mergedDefaults = mergedDefaultsCache[key] = fluid.resolveGrade(defaults, defaultName, gradeNames);
        }
        return mergedDefaults;
    };

    // unsupported, NON-API function
    fluid.resolveGradedOptions = function (componentName) {
        var defaults = fluid.rawDefaults(componentName);
        if (!defaults) {
            return defaults;
        } else {
            return fluid.getGradedDefaults(defaults, componentName, defaults.gradeNames);
        }
    };
    
    // unsupported, NON-API function
    fluid.rawDefaults = function (componentName, options) {
        if (options === undefined) {
            return defaultsStore[componentName];
        } else {
            defaultsStore[componentName] = options;
        }
    };
    
        
    fluid.hasGrade = function (options, gradeName) {
        return !options || !options.gradeNames ? false : fluid.contains(options.gradeNames, gradeName);
    };
    
     /**
     * Retrieves and stores a component's default settings centrally.
     * @param {boolean} (options) if true, manipulate a global option (for the head
     *   component) rather than instance options. NB - the use of "global options"
     *   is deprecated and will be removed from the framework in release 1.6
     * @param {String} componentName the name of the component
     * @param {Object} (optional) an container of key/value pairs to set
     */
     
    fluid.defaults = function () {
        var offset = 0;
        if (typeof arguments[0] === "boolean") {
            offset = 1;
        }
        var componentName = (offset === 0 ? "" : "*.global-") + arguments[offset];
        var options = arguments[offset + 1];
        if (options === undefined) {
            return fluid.resolveGradedOptions(componentName);
        } else {
            if (options && options.options) {
                fluid.fail("Probable error in options structure for " + componentName +
                    " with option named \"options\" - perhaps you meant to write these options at top level in fluid.defaults? - ", options);
            }
            fluid.rawDefaults(componentName, options);
            if (fluid.hasGrade(options, "autoInit")) {
                fluid.makeComponent(componentName, fluid.resolveGradedOptions(componentName));
            }
        }
    };
    
    fluid.makeComponent = function (componentName, options) {
        if (!options.initFunction || !options.gradeNames) {
            fluid.fail("Cannot autoInit component " + componentName + " which does not have an initFunction and gradeName defined");
        }
        var creator = function () {
            return fluid.initComponent(componentName, arguments);
        };
        var existing = fluid.getGlobalValue(componentName);
        if (existing) {
            $.extend(creator, existing);
        }
        fluid.setGlobalValue(componentName, creator);
    };
        
    fluid.makeComponents = function (components, env) {
        fluid.each(components, function (value, key) {
            var options = {
                gradeNames: fluid.makeArray(value).concat(["autoInit"])
            };
            fluid.defaults(key, options);
        });
    };
    
    // The base system grade definitions
    
    fluid.defaults("fluid.function", {});
    
    fluid.lifecycleFunctions = {
        preInitFunction: true,
        postInitFunction: true,
        finalInitFunction: true
    };
    
    fluid.rootMergePolicy = fluid.transform(fluid.lifecycleFunctions, function () {
        return fluid.mergeListenerPolicy;
    });
    
    fluid.defaults("fluid.littleComponent", {
        initFunction: "fluid.initLittleComponent",
        mergePolicy: fluid.rootMergePolicy,
        argumentMap: {
            options: 0
        }
    });
    
    fluid.defaults("fluid.eventedComponent", {
        gradeNames: ["fluid.littleComponent"],
        events: { // Four standard lifecycle points common to all components
            onCreate: null,
            onAttach: null, // events other than onCreate are only fired for IoC-configured components
            onClear: null,
            onDestroy: null
        },
        mergePolicy: {
            listeners: fluid.mergeListenersPolicy
        }
    });
    
        
    fluid.preInitModelComponent = function (that) {
        that.model = that.options.model || {};
        that.applier = that.options.applier || (fluid.makeChangeApplier ? fluid.makeChangeApplier(that.model, that.options.changeApplierOptions) : null);
    };
    
    fluid.defaults("fluid.modelComponent", {
        gradeNames: ["fluid.littleComponent"],
        preInitFunction: {
            namespace: "preInitModelComponent",
            listener: "fluid.preInitModelComponent"
        },
        mergePolicy: {
            model: "preserve",
            applier: "nomerge"
        }
    });

    /** Generate a name for a component for debugging purposes */
    fluid.nameComponent = function (that) {
        return that ? "component with typename " + that.typeName + " and id " + that.id : "[unknown component]";
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

    // TODO: so far, profiling does not suggest that this implementation is a performance risk, but we really should start
    // "precompiling" these.
    // unsupported, NON-API function
    fluid.mergePolicyIs = function (policy, test) {
        return typeof (policy) === "string" && $.inArray(test, policy.split(/\s*,\s*/)) !== -1;
    };

    // Cheapskate implementation which avoids dependency on DataBinding.js
    fluid.model.mergeModel = function (target, source, applier) {
        if (!fluid.isPrimitive(target)) {
            var copySource = fluid.copy(source);
            $.extend(true, source, target);
            $.extend(true, source, copySource);
        }
        return source;
    };

    function mergeImpl(policy, basePath, target, source, thisPolicy, rec) {
        if (fluid.isTracing) {
            fluid.tracing.pathCount.push(basePath);
        }
        if (fluid.mergePolicyIs(thisPolicy, "replace")) {
            fluid.clear(target);
        }
        fluid.guardCircularity(rec.seenIds, source, "merging", " when evaluating path " + basePath + " - please protect components from merging using the \"nomerge\" merge policy");
      
        for (var name in source) {
            var path = (basePath ? basePath + "." : "") + name;
            var newPolicy = policy && typeof (policy) !== "string" ? policy[path] : policy;
            var funcPolicy = typeof (newPolicy) === "function";
            var thisTarget = target[name];
            var thisSource = source[name];
            var primitiveTarget = fluid.isPrimitive(thisTarget);
    
            if (thisSource !== undefined) {
                if (!funcPolicy && thisSource !== null && typeof (thisSource) === "object" &&
                        !fluid.isDOMNode(thisSource) && !thisSource.jquery && thisSource !== fluid.VALUE &&
                        !fluid.mergePolicyIs(newPolicy, "preserve") && !fluid.mergePolicyIs(newPolicy, "nomerge")) {
                    if (primitiveTarget) {
                        target[name] = thisTarget = fluid.freshContainer(thisSource);
                    }
                    mergeImpl(policy, path, thisTarget, thisSource, newPolicy, rec);
                } else {
                    if (funcPolicy) {
                        target[name] = newPolicy.call(null, thisTarget, thisSource, name);
                    } else if (!fluid.isValue(thisTarget) || !fluid.mergePolicyIs(newPolicy, "reverse")) {
                        // TODO: When "grades" are implemented, grandfather in any paired applier to perform these operations
                        // NB: mergePolicy of "preserve" now creates dependency on DataBinding.js
                        target[name] = fluid.isValue(thisTarget) && fluid.mergePolicyIs(newPolicy, "preserve") ? fluid.model.mergeModel(thisTarget, thisSource) : thisSource;
                    }
                }
            }
        }
        return target;
    }

    // TODO: deprecate this method of detecting default value merge policies before 1.6 in favour of
    // explicit typed records a la ModelTransformations
    // unsupported, NON-API function
    fluid.isDefaultValueMergePolicy = function (policy) {
        return typeof(policy) === "string"
            && (policy.indexOf(",") === -1 && !/replace|preserve|nomerge|noexpand|reverse/.test(policy));
    };
    
    // unsupported, NON-API function
    fluid.applyDefaultValueMergePolicy = function (defaults, merged) {
        var policy = merged.mergePolicy;
        if (policy && typeof (policy) !== "string") {
            for (var key in policy) {
                var elrh = policy[key];
                if (fluid.isDefaultValueMergePolicy(elrh)) {
                    var defaultTarget = fluid.get(defaults, key);
                    var mergedTarget = fluid.get(merged, key);
                 // TODO: this implementation is faulty since it will trigger if a user modifies a source value to its default value
                 // - and also will still copy over a target if user modifies it to its default value
                 // probably needs FLUID-4392 for a proper fix since the algorithm will need a fundamental change to progress from
                 // R2L rather than L2R (is that even possible!)
                    if (defaultTarget === mergedTarget) {
                        var defaultSource = fluid.get(defaults, elrh);
                        var mergedSource = fluid.get(merged, elrh);
                        // NB: This line represents a change in policy - will not apply default value policy to defaults themselves
                        if (defaultSource !== mergedSource) {
                            fluid.set(merged, key, mergedSource);
                        }
                    }
                }
            }
        }
        return merged;
    };
    
    /** Merge a collection of options structures onto a target, following an optional policy.
     * This function is typically called automatically, as a result of an invocation of
     * <code>fluid.initLittleComponent</code>. The behaviour of this function is explained more fully on
     * the page http://wiki.fluidproject.org/display/fluid/Options+Merging+for+Fluid+Components .
     * @param policy {Object/String} A "policy object" specifiying the type of merge to be performed.
     * If policy is of type {String} it should take on the value "reverse" or "replace" representing
     * a static policy. If it is an
     * Object, it should contain a mapping of EL paths onto these String values, representing a
     * fine-grained policy. If it is an Object, the values may also themselves be EL paths
     * representing that a default value is to be taken from that path.
     * @param target {Object} The options structure which is to be modified by receiving the merge results.
     * @param options1, options2, .... {Object} an arbitrary list of options structure which are to
     * be merged "on top of" the <code>target</code>. These will not be modified.
     */
    
    fluid.merge = function (policy, target) {
        var path = "";
        
        for (var i = 2; i < arguments.length; ++i) {
            var source = arguments[i];
            if (source !== null && source !== undefined) {
                mergeImpl(policy, path, target, source, policy ? policy[""] : null, {seenIds: {}});
            }
        }
        return target;
    };

    // unsupported, NON-API function
    fluid.transformOptions = function (mergeArgs, transRec) {
        fluid.expect("Options transformation record", ["transformer", "config"], transRec);
        var transFunc = fluid.getGlobalValue(transRec.transformer);
        var togo = fluid.transform(mergeArgs, function (value, key) {
            return key === 0 ? value : transFunc.call(null, value, transRec.config);
        });
        return togo;
    };
    
    // unsupporter, NON-API function
    fluid.lastTransformationRecord = function (extraArgs) {
        for (var i = extraArgs.length - 1; i >= 0; --i) {
            if (extraArgs[i] && extraArgs[i].transformOptions) {
                return extraArgs[i].transformOptions;
            }
        }
    };

    /**
     * Merges the component's declared defaults, as obtained from fluid.defaults(),
     * with the user's specified overrides.
     *
     * @param {Object} that the instance to attach the options to
     * @param {String} componentName the unique "name" of the component, which will be used
     * to fetch the default options from store. By recommendation, this should be the global
     * name of the component's creator function.
     * @param {Object} userOptions the user-specified configuration options for this component
     */
    // unsupported, NON-API function
    fluid.mergeComponentOptions = function (that, componentName, userOptions, localOptions) {
        var defaults = fluid.defaults(componentName) || {};
        var mergePolicy = $.extend({}, fluid.rootMergePolicy, defaults.mergePolicy);
        var defaultGrades = defaults.gradeNames;

        localOptions = defaultGrades ? {} : fluid.copy(fluid.getGradedDefaults({}, "", localOptions.gradeNames));
        var mergeArgs = [mergePolicy, localOptions];
        
        var extraArgs;
        if (fluid.expandComponentOptions) {
            extraArgs = fluid.expandComponentOptions(defaults, userOptions, that);
        } else {
            extraArgs = [defaults, userOptions];
        }
        var transRec = fluid.lastTransformationRecord(extraArgs);
        if (transRec) {
            extraArgs = fluid.transformOptions(extraArgs, transRec);
        }
        mergeArgs = mergeArgs.concat(extraArgs);
        var merged = fluid.merge.apply(null, mergeArgs);
        merged = fluid.applyDefaultValueMergePolicy(defaults, merged);
        that.options = merged;
    };
    
    // The Fluid Component System proper
            
    /** A special "marker object" which is recognised as one of the arguments to
     * fluid.initSubcomponents. This object is recognised by reference equality -
     * where it is found, it is replaced in the actual argument position supplied
     * to the specific subcomponent instance, with the particular options block
     * for that instance attached to the overall "that" object.
     * NOTE: The use of this marker has been deprecated as of the Fluid 1.4 release in
     * favour of the contextual EL path "{options}" - it will be removed in a future
     * release of the framework.
     */
    fluid.COMPONENT_OPTIONS = {type: "fluid.marker", value: "COMPONENT_OPTIONS"};
    
    /** Construct a dummy or "placeholder" subcomponent, that optionally provides empty
     * implementations for a set of methods.
     */
    fluid.emptySubcomponent = function (options) {
        var that = {};
        options = $.makeArray(options);
        for (var i = 0; i < options.length; ++i) {
            that[options[i]] = fluid.identity;
        }
        return that;
    };
    
    /** Compute a "nickname" given a fully qualified typename, by returning the last path
     * segment.
     */
    
    fluid.computeNickName = function (typeName) {
        var segs = fluid.model.parseEL(typeName);
        return segs[segs.length - 1];
    };
        
    /** Create a "type tag" component with no state but simply a type name and id. The most
     *  minimal form of Fluid component */
       
    fluid.typeTag = function (name) {
        return name ? {
            typeName: name,
            id: fluid.allocateGuid()
        } : null;
    };
    
    /** A combined "component and grade name" which allows type tags to be declaratively constructed
     * from options material */
    
    fluid.typeFount = function (options) {
        var that = fluid.initLittleComponent("fluid.typeFount", options);
        return fluid.typeTag(that.options.targetTypeName);
    };
    
    /**
     * Creates a new "little component": a that-ist object with options merged into it by the framework.
     * This method is a convenience for creating small objects that have options but don't require full
     * View-like features such as the DOM Binder or events
     *
     * @param {Object} name the name of the little component to create
     * @param {Object} options user-supplied options to merge with the defaults
     */
    // NOTE: the 3rd argument localOptions is NOT to be advertised as part of the stable API, it is present
    // just to allow backward compatibility whilst grade specifications are not mandatory
    fluid.initLittleComponent = function (name, options, localOptions) {
        var that = fluid.typeTag(name);
        // TODO: nickName must be available earlier than other merged options so that component may resolve to itself
        that.nickName = options && options.nickName ? options.nickName : fluid.computeNickName(that.typeName);
        localOptions = localOptions || {gradeNames: "fluid.littleComponent"};
        
        fluid.mergeComponentOptions(that, name, options, localOptions);
        fluid.initLifecycleFunctions(that);
        fluid.fireEvent(that.options, "preInitFunction", that);

        if (fluid.hasGrade(that.options, "fluid.eventedComponent")) {
            fluid.instantiateFirers(that, that.options);
        }
        if (!fluid.hasGrade(that.options, "autoInit")) {
            fluid.clearLifecycleFunctions(that.options);
        }
        return that;
    };

    // unsupported, NON-API function    
    fluid.updateWithDefaultLifecycle = function (key, value, typeName) {
        var funcName = typeName + "." + key.substring(0, key.length - "function".length);
        var funcVal = fluid.getGlobalValue(funcName);
        if (typeof (funcVal) === "function") {
            value = fluid.makeArray(value);
            var existing = fluid.find(value, function (el) {
                var listener = el.listener || el;
                if (listener == funcVal || listener == funcName) {
                    return true;
                }
            });
            if (!existing) {
                value.push(funcVal);
            }
        }
        return value;
    };
    
    // unsupported, NON-API function
    fluid.initLifecycleFunctions = function (that) {
        var gradeNames = that.options.gradeNames;
        fluid.each(fluid.lifecycleFunctions, function (func, key) {
            var value = that.options[key];
            for (var i = gradeNames.length - 1; i >= 0; -- i) { // most specific grades are at front
                if (gradeNames[i] !== "autoInit") {  
                    value = fluid.updateWithDefaultLifecycle(key, value, gradeNames[i]);
                }
            }
            if (value) {
                that.options[key] = fluid.makeEventFirer(null, null, key);
                fluid.event.addListenerToFirer(that.options[key], value);
            }
        });
    };
    
    // unsupported, NON-API function
    fluid.clearLifecycleFunctions = function (options) {
        fluid.each(fluid.lifecycleFunctions, function (value, key) {
            delete options[key];
        });
        delete options.initFunction;
    };

    fluid.diagnoseFailedView = fluid.identity;
    
    fluid.makeRootDestroy = function (that) {
        return function () {
            fluid.fireEvent(that, "events.onClear", [that, "", null]);
            fluid.fireEvent(that, "events.onDestroy", [that, "", null]);
        };  
    };
    
    fluid.initComponent = function (componentName, initArgs) {
        var options = fluid.defaults(componentName);
        if (!options.gradeNames) {
            fluid.fail("Cannot initialise component " + componentName + " which has no gradeName registered");
        }
        var args = [componentName].concat(fluid.makeArray(initArgs)); // TODO: support different initFunction variants
        var that = fluid.invokeGlobalFunction(options.initFunction, args);
        fluid.diagnoseFailedView(componentName, that, options, args);
        fluid.fireEvent(that.options, "postInitFunction", that);
        if (fluid.initDependents) {
            fluid.initDependents(that);
        }
        fluid.fireEvent(that.options, "finalInitFunction", that);
        fluid.clearLifecycleFunctions(that.options);
        that.destroy = fluid.makeRootDestroy(that); // overwritten by FluidIoC for constructed subcomponents
        fluid.fireEvent(that, "events.onCreate", that);
        
        return that.options.returnedPath ? fluid.get(that, that.options.returnedPath) : that;
    };

    // unsupported, NON-API function
    fluid.initSubcomponentImpl = function (that, entry, args) {
        var togo;
        if (typeof (entry) !== "function") {
            var entryType = typeof (entry) === "string" ? entry : entry.type;
            var globDef = fluid.defaults(true, entryType);
            fluid.merge("reverse", that.options, globDef);
            togo = entryType === "fluid.emptySubcomponent" ?
                fluid.emptySubcomponent(entry.options) :
                fluid.invokeGlobalFunction(entryType, args);
        } else {
            togo = entry.apply(null, args);
        }

        // TODO: deprecate "returnedOptions" and incorporate into regular ginger world system
        var returnedOptions = togo ? togo.returnedOptions : null;
        if (returnedOptions) {
            fluid.merge(that.options.mergePolicy, that.options, returnedOptions);
            if (returnedOptions.listeners) {
                fluid.mergeListeners(that, that.events, returnedOptions.listeners);
            }
        }
        return togo;
    };
    
    /** Initialise all the "subcomponents" which are configured to be attached to
     * the supplied top-level component, which share a particular "class name".
     * @param {Component} that The top-level component for which sub-components are
     * to be instantiated. It contains specifications for these subcomponents in its
     * <code>options</code> structure.
     * @param {String} className The "class name" or "category" for the subcomponents to
     * be instantiated. A class name specifies an overall "function" for a class of
     * subcomponents and represents a category which accept the same signature of
     * instantiation arguments.
     * @param {Array of Object} args The instantiation arguments to be passed to each
     * constructed subcomponent. These will typically be members derived from the
     * top-level <code>that</code> or perhaps globally discovered from elsewhere. One
     * of these arguments may be <code>fluid.COMPONENT_OPTIONS</code> in which case this
     * placeholder argument will be replaced by instance-specific options configured
     * into the member of the top-level <code>options</code> structure named for the
     * <code>className</code>
     * @return {Array of Object} The instantiated subcomponents, one for each member
     * of <code>that.options[className]</code>.
     */
    
    fluid.initSubcomponents = function (that, className, args) {
        var entry = that.options[className];
        if (!entry) {
            return;
        }
        var entries = $.makeArray(entry);
        var optindex = -1;
        var togo = [];
        args = $.makeArray(args);
        for (var i = 0; i < args.length; ++i) {
            if (args[i] === fluid.COMPONENT_OPTIONS) {
                optindex = i;
            }
        }
        for (i = 0; i < entries.length; ++i) {
            entry = entries[i];
            if (optindex !== -1) {
                args[optindex] = entry.options;
            }
            togo[i] = fluid.initSubcomponentImpl(that, entry, args);
        }
        return togo;
    };
        
    fluid.initSubcomponent = function (that, className, args) {
        return fluid.initSubcomponents(that, className, args)[0];
    };


    // Message resolution and templating
   
   
   /**
    * Converts a string to a regexp with the specified flags given in parameters
    * @param {String} a string that has to be turned into a regular expression
    * @param {String} the flags to provide to the reg exp
    */
    fluid.stringToRegExp = function (str, flags) {
        return new RegExp(str.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&"), flags);
    };
    
    /**
     * Simple string template system.
     * Takes a template string containing tokens in the form of "%value".
     * Returns a new string with the tokens replaced by the specified values.
     * Keys and values can be of any data type that can be coerced into a string. Arrays will work here as well.
     *
     * @param {String}    template    a string (can be HTML) that contains tokens embedded into it
     * @param {object}    values      a collection of token keys and values
     */
    fluid.stringTemplate = function (template, values) {
        var keys = fluid.keys(values);
        keys = keys.sort(fluid.compareStringLength());
        for (var i = 0; i < keys.length; ++i) {
            var key = keys[i];
            var re = fluid.stringToRegExp("%" + key, "g");
            template = template.replace(re, values[key]);
        }
        return template;
    };
    

    fluid.messageResolver = function (options) {
        var that = fluid.initLittleComponent("fluid.messageResolver", options);
        that.messageBase = that.options.parseFunc(that.options.messageBase);
        
        that.lookup = function (messagecodes) {
            var resolved = fluid.messageResolver.resolveOne(that.messageBase, messagecodes);
            if (resolved === undefined) {
                return fluid.find(that.options.parents, function (parent) {
                    return parent.lookup(messagecodes);
                });
            } else {
                return {template: resolved, resolveFunc: that.options.resolveFunc};
            }
        };
        that.resolve = function (messagecodes, args) {
            if (!messagecodes) {
                return "[No messagecodes provided]";
            }
            messagecodes = fluid.makeArray(messagecodes);
            var looked = that.lookup(messagecodes);
            return looked ? looked.resolveFunc(looked.template, args) :
                "[Message string for key " + messagecodes[0] + " not found]";
        };
        
        return that;
    };
    
    fluid.defaults("fluid.messageResolver", {
        mergePolicy: {
            messageBase: "preserve",
            parents: "nomerge"
        },
        resolveFunc: fluid.stringTemplate,
        parseFunc: fluid.identity,
        messageBase: {},
        parents: []
    });
    
    fluid.messageResolver.resolveOne = function (messageBase, messagecodes) {
        for (var i = 0; i < messagecodes.length; ++i) {
            var code = messagecodes[i];
            var message = messageBase[code];
            if (message !== undefined) {
                return message;
            }
        }
    };
          
    /** Converts a data structure consisting of a mapping of keys to message strings,
     * into a "messageLocator" function which maps an array of message codes, to be
     * tried in sequence until a key is found, and an array of substitution arguments,
     * into a substituted message string.
     */
    fluid.messageLocator = function (messageBase, resolveFunc) {
        var resolver = fluid.messageResolver({messageBase: messageBase, resolveFunc: resolveFunc});
        return function (messagecodes, args) {
            return resolver.resolve(messagecodes, args);
        };
    };

})(jQuery, fluid_1_5);
