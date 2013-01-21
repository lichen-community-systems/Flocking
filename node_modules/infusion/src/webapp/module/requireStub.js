/*
Copyright 2012 OCAD University

Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.

You may obtain a copy of the ECL 2.0 License and BSD License at
https://github.com/fluid-project/infusion/raw/master/Infusion-LICENSE.txt
*/

/*global window, require*/
/*jslint white: true, funcinvoke: true, undef: true, newcap: true, regexp: true, bitwise: true, browser: true, forin: true, maxerr: 100, indent: 4 */

var fluid_1_5 = fluid_1_5 || {};

(function (fluid) {

    var requireStub = function (moduleName) {
        if (moduleName !== "infusion") {
            throw new Error("requireStub.js cannot be used to test modules other than Infusion, " +
                "which is capable of running in both Node.js and a browser.");
        }
        return fluid;
    };

    window.require = requireStub;
    if (typeof (fluid) === "undefined") {
        throw new Error("Please include requireStub.js after Fluid Infusion in the document's <head>");
    }
    fluid.require = requireStub;

}(fluid_1_5));
