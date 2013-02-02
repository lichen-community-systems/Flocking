/*
Copyright 2012 OCAD University, Antranig Basman

Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.

You may obtain a copy of the ECL 2.0 License and BSD License at
https://github.com/fluid-project/infusion/raw/master/Infusion-LICENSE.txt
*/
/*global require, module, console, __dirname*/

// JSLint options 
/*jslint white: true, funcinvoke: true, undef: true, newcap: true, regexp: true, bitwise: true, browser: true, forin: true, maxerr: 100, indent: 4 */


(function () {
    var fs = require("fs"),
        path = require("path"),
        vm = require("vm");

    var getBaseDir = function () {
        return __dirname;
    };

    var buildPath = function (pathSeg) {
        return path.join(getBaseDir(), pathSeg);
    };

    var context = vm.createContext({
        console: console,
        setTimeout: setTimeout
    });
    
    context.window = context;

    /** Load a standard, non-require-aware Fluid framework file into the Fluid context **/

    var loadInContext = function (path) {
        var fullpath = buildPath(path);
        var data = fs.readFileSync(fullpath);
        vm.runInContext(data, context, fullpath);
    };

    var includes = fs.readFileSync(buildPath("includes.json"));

    includes = JSON.parse(includes);

    for (var i = 0; i < includes.length; ++i) {
        loadInContext(includes[i]);
    }
    
    var fluid = context.fluid;
    
    fluid.loadInContext = loadInContext;
    
    /** Load a node-aware JavaScript file using either a supplied or the native
      * Fluid require function (the difference relates primarily to the base
      * directory used for loading - although the file will need to make use of
      * a registerNamespace or similar call to get access to the required global namespace */

    fluid.require = function (moduleName, foreignRequire, namespace) {
        foreignRequire = foreignRequire || require;
        var module = foreignRequire(moduleName);
        if (namespace) {
            fluid.set(context, namespace, module);
        }
        return module;
    };
    
    /** Produce a loader object exposing a "require" object which will automatically
     * prefix the supplied directory name to any requested modules before forwarding
     * the operation to fluid.require 
     */
    
    fluid.getLoader = function (dirName, foreignRequire) {
        return {
            require: function (moduleName, namespace) {
                if (moduleName.indexOf("/") > -1) {
                    moduleName = dirName + "/" + moduleName;
                }
                return fluid.require(moduleName, foreignRequire, namespace);
            }
        }
    };

    module.exports = fluid;

})();