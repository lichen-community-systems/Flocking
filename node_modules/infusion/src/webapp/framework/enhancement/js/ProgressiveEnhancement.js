/*
Copyright 2008-2009 University of Toronto
Copyright 2010-2011 OCAD University
Copyright 2011 Lucendo Development Ltd.

Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.

You may obtain a copy of the ECL 2.0 License and BSD License at
https://github.com/fluid-project/infusion/raw/master/Infusion-LICENSE.txt
*/

// Declare dependencies
/*global window, fluid_1_5:true, jQuery, swfobject*/

// JSLint options 
/*jslint white: true, funcinvoke: true, undef: true, newcap: true, nomen: true, regexp: true, bitwise: true, browser: true, forin: true, maxerr: 100, indent: 4 */

var fluid_1_5 = fluid_1_5 || {};

(function ($, fluid) {
    
    fluid.registerNamespace("fluid.enhance");
    
    // Feature Detection Functions
    fluid.enhance.isBrowser = function () {
        return typeof(window) !== "undefined" && window.document;
    };
    fluid.enhance.supportsBinaryXHR = function () {
        return window.FormData || (window.XMLHttpRequest && window.XMLHttpRequest.prototype && window.XMLHttpRequest.prototype.sendAsBinary);
    };
    fluid.enhance.supportsFormData = function () {
        return !!window.FormData;
    };
    fluid.enhance.supportsFlash = function () {
        return (typeof(swfobject) !== "undefined") && (swfobject.getFlashPlayerVersion().major > 8);
    };
    
    /*
     * An object to hold the results of the progressive enhancement checks.
     * Keys represent the key into the static environment
     * Values represent the result of the check
     */
    fluid.enhance.checked = {};
    
    /*
     * The segment separator used by fluid.enhance.typeToKey
     */
    fluid.enhance.sep = "--";
    
    /*
     * Converts a type tag name to one that is safe to use as a key in an object, by replacing all of the "."
     * with the separator specified at fluid.enhance.sep
     */
    fluid.enhance.typeToKey = function (typeName) {
        return typeName.replace(/[.]/gi, fluid.enhance.sep);
    };
    
    /*
     * Takes an object of key/value pairs where the key will be the key in the static enivronment and the value is a function or function name to run.
     * {staticEnvKey: "progressiveCheckFunc"}
     * Note that the function will not be run if it's result is already recorded.
     */
    fluid.enhance.check = function (stuffToCheck) {
        fluid.each(stuffToCheck, function (val, key) {
            var staticKey = fluid.enhance.typeToKey(key);
            
            if (fluid.enhance.checked[staticKey] === undefined) {
                var results = typeof(val) === "string" ? fluid.invokeGlobalFunction(val) : val();
                
                fluid.enhance.checked[staticKey] = results;
                
                if (results) {
                    fluid.staticEnvironment[staticKey] = fluid.typeTag(key);
                }
            }
        });
    };
    
    /*
     * forgets a single item based on the typeName
     */
    fluid.enhance.forget = function (typeName) {
        var key = fluid.enhance.typeToKey(typeName);
        
        if (fluid.enhance.checked[key] !== undefined) {
            delete fluid.staticEnvironment[key];
            delete fluid.enhance.checked[key];
        }
    };
    
    /*
     * forgets all of the keys added by fluid.enhance.check
     */
    fluid.enhance.forgetAll = function () {
        fluid.each(fluid.enhance.checked, function (val, key) {
            fluid.enhance.forget(key);
        });
    };
    
    fluid.progressiveChecker = function (options) {
        var that = fluid.initLittleComponent("fluid.progressiveChecker", options);
        return fluid.typeTag(fluid.find(that.options.checks, function(check) {
            if (check.feature) {
                return check.contextName;
            }}, that.options.defaultContextName
        ));
    };
    
    fluid.defaults("fluid.progressiveChecker", {
        gradeNames: "fluid.typeFount",
        checks: [], // [{"feature": "{IoC Expression}", "contextName": "context.name"}]
        defaultContextName: undefined
    });
    
    fluid.progressiveCheckerForComponent = function (options) {
        var that = fluid.initLittleComponent("fluid.progressiveCheckerForComponent", options);
        var defaults = fluid.defaults(that.options.componentName);
        return fluid.progressiveChecker(fluid.expandOptions(fluid.copy(defaults.progressiveCheckerOptions), that));  
    };

    fluid.defaults("fluid.progressiveCheckerForComponent", {
        gradeNames: "fluid.typeFount"
    });
    
    /**********************************************************
     * This code runs immediately upon inclusion of this file *
     **********************************************************/
    
    // Use JavaScript to hide any markup that is specifically in place for cases when JavaScript is off.
    // Note: the use of fl-ProgEnhance-basic is deprecated, and replaced by fl-progEnhance-basic.
    // It is included here for backward compatibility only.
    if (fluid.enhance.isBrowser()) {
        $("head").append("<style type='text/css'>.fl-progEnhance-basic, .fl-ProgEnhance-basic { display: none; } .fl-progEnhance-enhanced, .fl-ProgEnhance-enhanced { display: block; }</style>");
    }
    
})(jQuery, fluid_1_5);
