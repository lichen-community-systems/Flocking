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
/* eslint-env node */

"use strict";

var fs = require("fs"),
    path = require("path"),
    vm = require("vm"),
    resolve = require("fluid-resolve");

var moduleBaseDir = path.resolve(__dirname, "../..");

var getBaseDir = function () {
    return __dirname;
};

var buildPath = function (pathSeg) {
    return path.join(getBaseDir(), pathSeg);
};

// Report of experiments performed with node.js globals done on 1/9/14 - what we might like to write at this point is
// fluid: {global: GLOBAL}; - this "nearly" works but unfortunately the process of transporting the "pan-global" object
// across the sandbox initialization boundary ends up shredding it. We end up with a situation where in this file,
// fluid.global.fluid === fluid - but from within Fluid.js, fluid.global.fluid === undefined. node.js docs on sandboxing
// do report that the results can be fragile and version unstable. However, we need to continue with sandboxing because of
// the delicate expectations, for example, on visible globals caused by QUnit's sniffing code.
// Experiment performed with node.js 0.8.6 on Windows.
// We achieve a lot of what we might want via "global.fluid = fluid" below. However, other top-level names constructed
// via fluid.registerNamespace will not be exported up to the pan-global.

var context = vm.createContext({
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    __dirname: __dirname,
    path: path,
    require: require
});

context.window = context;

/** Load a standard, non-require-aware Fluid framework file into the Fluid context, given a filename
 * relative to this directory (src/module) **/

var loadInContext = function (path) {
    var fullpath = buildPath(path);
    var data = fs.readFileSync(fullpath);
    vm.runInContext(data, context, fullpath);
};

var loadIncludes = function (path) {
    var includes = require(buildPath(path));
    for (var i = 0; i < includes.length; ++i) {
        loadInContext(includes[i]);
    }
};

loadIncludes("includes.json");

var fluid = context.fluid;
// FLUID-4913: QUnit calls window.addEventListener on load. We need to add
// it to the context it will be loaded in.
context.addEventListener = fluid.identity;

// As well as for efficiency, it's useful to customise this because an uncaught
// exception fired from a a setTimeout handler in node.js will prevent any
// further from being serviced, which impedes testing these handlers
fluid.invokeLater = function (func) {
    process.nextTick(func);
};

fluid.logObjectRenderChars = 1024;

// Convert an argument intended for console.log in the node environment to a readable form (the
// default action of util.inspect censors at depth 1)
fluid.renderLoggingArg = function (arg) {
    var togo = arg && fluid.isPrimitive(arg) ? arg : fluid.prettyPrintJSON(arg, {maxRenderChars: fluid.logObjectRenderChars});
    if (typeof(togo) === "string" && togo.length > fluid.logObjectRenderChars) {
        togo = togo.substring(0, fluid.logObjectRenderChars) + " .... [output suppressed at " + fluid.logObjectRenderChars + " chars - for more output, increase fluid.logObjectRenderChars]";
    }
    return togo;
};

// Improve the rendering of logged arguments within node.js - see FLUID-5475
fluid.renderNodeLoggingArgs = function (args) {
    fluid.each(args, function (arg, i) {
        args[i] = fluid.renderLoggingArg(arg);
    });
};

fluid.doNodeLog = function (args) {
    console.log(args.join("")); // eslint-disable-line no-console
};

fluid.loggingEvent.addListener(fluid.doNodeLog, "log");
fluid.loggingEvent.addListener(fluid.renderNodeLoggingArgs, "renderNodeLoggingArgs", "before:log");

fluid.prepareV8StackTrace = function (err, stack) {
    return stack;
};

// Monkey-patch the fluid.getCallerInfo utility from FluidDebugging.js for the V8 API - see https://github.com/v8/v8/wiki/Stack-Trace-API

fluid.getCallerInfo = function (atDepth) {
    var origPrepare = Error.prepareStackTrace;
    try {
        Error.prepareStackTrace = fluid.prepareV8StackTrace;
        var err = new Error();
        var element = err.stack[atDepth];
        var filename = element.getFileName();
        return {
            path: path.dirname(filename),
            filename: path.basename(filename),
            index: element.getLineNumber() + ":" + element.getColumnNumber()
        };
    } catch (e) {
    } finally {
        Error.prepareStackTrace = origPrepare;
    }
};

fluid.loadInContext = loadInContext;
fluid.loadIncludes = loadIncludes;

fluid.testingSupportLoaded = false;

/**
 * Set up testing environment with jqUnit and IoC Test Utils in node.
 * This function will load the Infusion internal dependencies (QUnit, jqUnit and the IoC Testing Framework) necessary
 * for running node-jqUnit - the node-jqunit module itself must still be loaded by the user via their own devDependencies.
 */
fluid.loadTestingSupport = function () {
    // Guard against multiple inclusion of QUnit - FLUID-6188
    if (!fluid.testingSupportLoaded) {
        fluid.loadIncludes("devIncludes.json");
        fluid.testingSupportLoaded = true;
    }
};

/** Implementation of self-deduplication algorithm for FLUID-5822 **/

// Version of resolve.sync which does not throw when module is not found
fluid.module.resolveSync = function (moduleId, fromPath) {
    try {
        return resolve.sync(moduleId, {
            basedir: fromPath
        });
    } catch (e) {
        return null;
    }
};

// Method 1: Resolve to the highest infusion which is observable through the "pre-inspection" method of looking
// literally into the filesystem for package.json files which can be successfully loaded

var moduleInfo = fluid.module.modulesToRoot(__dirname);

var highestInfusionIndex = fluid.find(moduleInfo.names, function (name, index) {
    return name === "infusion" ? index : undefined;
});

if (highestInfusionIndex !== undefined) {
    // If this require throws, there is some other undesirable problem with the thing appearing to be an Infusion at
    // this path which should be reported as an uncaught exception
    var highestInfusionPath = moduleInfo.paths[highestInfusionIndex];
    var infusionModule = require(highestInfusionPath);
    if ("module" in infusionModule && infusionModule.module.modules.infusion.baseDir !== moduleBaseDir) {
        // eslint-disable-next-line no-console
        console.log("Pre-inspection from path " + __dirname + " resolved to infusion at higher path " + highestInfusionPath);
        module.exports = infusionModule;
        return;
    }
}

// Method 2: Resolve to any infusion which is observable to the standard node loader at a path strictly higher than ours
// TODO: Is this completely subsumed by Method 1?

var upInfusion;

var upPath = path.resolve(__dirname, "../../../../..");
var upInfusionPath = fluid.module.resolveSync("infusion", upPath);
if (upInfusionPath) {
    upInfusion = require(upInfusionPath);
}

// Fix for FLUID-5940, when Infusion is a dependency of a Node.js project that is located in the
// root of a filesystem we were resolving to the current version of Infusion. Doing a 'require'
// on the same version of Infusion results in an empty object since we have not completed our own assignment to
// module.exports yet
if (upInfusion && upInfusion.module) {
    // eslint-disable-next-line no-console
    console.log("Resolved infusion from path " + __dirname + " to " + upInfusion.module.modules.infusion.baseDir);
    module.exports = upInfusion;
    return;
} else {
    // eslint-disable-next-line no-console
    console.log("Infusion at path " + moduleBaseDir + " is at top level ");
}

// If we reach here without hitting the "return" statements above, we believe ourselves to be the highest resolvable
// Infusion in the filesystem. If we are wrong, some other Infusion has already registered itself in node's
// pan-module global registry - if we find it there, we should bail out with a fatal error since corruption will
// shortly soon result in the grade registry and component tree.

if (global.fluid) {
    var oldPath = global.fluid.module.modules.infusion.baseDir;
    fluid.fail("Error loading infusion - infusion has already been loaded from the path \n\t" + path.resolve(oldPath) +
        "\n - please delete the duplicate copy which is found at \n\t" + path.resolve(__dirname));
}

// Pre-inspect any other module (there should be at most one) which is loading at top level so that it is self-resolvable
// via fluid.require("%other-module") for whatever it is

fluid.module.preInspect();

fluid.module.register("infusion", moduleBaseDir, require);

// Export the fluid object into the pan-module node.js global object
global.fluid = fluid;


/** Registering and instrumenting uncaught exception handler:
 * Do this after determining that we are top-level Infusion to avoid FLUID-6225
 */
process.on("uncaughtException", function onUncaughtException(err) {
    fluid.onUncaughtException.fire(err);
});

fluid.onUncaughtException = fluid.makeEventFirer({
    name: "Global uncaught exception handler"
});

// This registry of priorities will be removed once the implementation of FLUID-5506 is complete
fluid.handlerPriorities = {
    uncaughtException: {
        log: 100, // high priority - do all logging first
        logActivity: "after:log",
        fail: "last"
    }
};

fluid.logUncaughtException = function (err) {
    var message = "FATAL ERROR: Uncaught exception: " + err.message;
    fluid.log(fluid.logLevel.FATAL, message);
    console.log(err.stack); // eslint-disable-line no-console
};

fluid.onUncaughtException.addListener(fluid.logUncaughtException, "log",
    fluid.handlerPriorities.uncaughtException.log);

fluid.onUncaughtException.addListener(function () {fluid.logActivity();}, "logActivity",
    fluid.handlerPriorities.uncaughtException.logActivity);


// Make sure process exits with error (see FLUID-5920)
fluid.handleUncaughtException = function () {
    process.exit(1);
};

fluid.onUncaughtException.addListener(fluid.handleUncaughtException, "fail",
    fluid.handlerPriorities.uncaughtException.fail);


module.exports = fluid;
