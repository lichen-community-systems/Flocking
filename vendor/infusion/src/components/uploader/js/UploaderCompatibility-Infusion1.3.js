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

/**************************************************************************************
 * Note: this file should not be included in the InfusionAll build.                   *
 * Instead, users should add this file manually if backwards compatibility is needed. *
 **************************************************************************************/

(function (fluid) {
    "use strict";

    fluid.registerNamespace("fluid.compat.fluid_1_3.uploader");

    fluid.contextAware.makeChecks({"fluid.uploader.requiredApi": {
        value: "fluid_1_3"
    }});

    // fluid.contextAware.makeContext({"fluid.uploader.requiredApi": {
    //     contextName: "fluid.uploader.requiredApi.fluid_1_3" // check: true is assumed
    // });
    // fluid.contextAware.forgetContext("fluid.uploader.requiredApi");

    fluid.compat.fluid_1_3.uploader.fileTypeTransformer = function (val) {
        var mimeTypeMap = fluid.uploader.mimeTypeRegistry;
        if (fluid.isArrayable(val) || typeof(val) !== "string") {
            return val;
        }

        var exts = val.split(";");
        if (exts.length === 0) {
            return undefined;
        }

        var mimeTypes = [];
        fluid.each(exts, function (ext) {
            ext = ext.substring(2);
            var mimeType = mimeTypeMap[ext];
            if (mimeType) {
                mimeTypes.push(mimeType);
            }
        });

        return mimeTypes;
    };

    fluid.compat.fluid_1_3.uploader.optionsRules = {
        // TODO: Remove these when model transformation can handle additive transformations.
        gradeNames: "gradeNames",
        components: "components",
        invokers: "invokers",
        queueSettings: "queueSettings",
        demo: "demo",
        selectors: "selectors",
        focusWithEvent: "focusWithEvent",
        styles: "styles",
        events: "events",
        listeners: "listeners",
        strings: "strings",
        mergePolicy: "mergePolicy",

        "queueSettings.fileTypes": {
            transform: {
                type: "fluid.compat.fluid_1_3.uploader.fileTypeTransformer",
                inputPath: "queueSettings.fileTypes"
            }
        }
    };

    // This grade, applied to a fluid.uploader, will adapt its accepted API from the Infusion 1.2 form to the Infusion 1.4-2.0 form
    fluid.defaults("fluid.uploader.compatibility.1_2-1_3", {
        transformOptions: {
            transformer: "fluid.model.transform.sequence",
            config: [fluid.compat.fluid_1_2.uploader.optionsRules, fluid.compat.fluid_1_3.uploader.optionsRules]
        }
    });

    fluid.defaults("fluid.uploader.compatibility.1_3", {
        transformOptions: {
            transformer: "fluid.model.transformWithRules",
            config: fluid.compat.fluid_1_3.uploader.optionsRules
        }
    });


    fluid.defaults("fluid.uploader.compatibility.distributor.1_4", {
        distributeOptions: {
            record: {
                "1_2": {
                    contextValue: "{fluid.uploader.requiredApi}.options.value",
                    equals: "fluid_1_2",
                    gradeNames: "fluid.uploader.compatibility.1_2-1_3"
                },
                "1_3": {
                    contextValue: "{fluid.uploader.requiredApi}.options.value",
                    equals: "fluid_1_3",
                    gradeNames: "fluid.uploader.compatibility.1_3"
                }
            },
            target: "{/ fluid.uploader}.options.contextAwareness.apiCompatibility.checks"
        }
    });

    fluid.constructSingle([], {
        singleRootType: "fluid.uploader.compatibility.distributor",
        type: "fluid.uploader.compatibility.distributor.1_4"
    });

})(fluid_3_0_0);
