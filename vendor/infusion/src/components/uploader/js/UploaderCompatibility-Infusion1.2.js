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
 * This file must be included before UploaderCompatibility-Infusion1.3.js             *
 **************************************************************************************/

(function (fluid) {
    "use strict";

    fluid.registerNamespace("fluid.compat.fluid_1_2.uploader");

    fluid.contextAware.makeChecks({"fluid.uploader.requiredApi": {
        value: "fluid_1_2"
    }});

    fluid.compat.fluid_1_2.uploader.optionsRules = {
        components: {
            transform: [
                {
                    type: "fluid.transforms.value",
                    inputPath: "components",
                    outputPath: "",
                    merge: true
                },
                {
                    type: "fluid.transforms.value",
                    outputPath: "",
                    merge: true,
                    input: {
                        transform: [{
                            // TODO: We could recover the old compact form of this with some dedicated form of transform
                            // TODO: This part of the transform is untested
                            type: "fluid.transforms.value",
                            outputPath: "strategy.options.styles",
                            inputPath: "decorators.0.options.styles"
                        }, {
                            type: "fluid.transforms.value",
                            inputPath: "fileQueueView",
                            outputPath: "fileQueueView"
                        }, {
                            type: "fluid.transforms.value",
                            inputPath: "totalProgressBar",
                            outputPath: "totalProgressBar"
                        }]
                    }
                }
            ]
        },
        queueSettings: {
            transform: {
                type: "fluid.transforms.firstValue",
                values: ["queueSettings", "uploadManager.options"]
            }
        },
        invokers: "invokers",
        demo: "demo",
        selectors: "selectors",
        focusWithEvent: "focusWithEvent",
        styles: "styles",
        listeners: "listeners",
        strings: "strings",
        mergePolicy: "mergePolicy"
    };

    fluid.defaults("fluid.uploader.compatibility.1_2", {
        transformOptions: {
            transformer: "fluid.model.transformWithRules",
            config: fluid.compat.fluid_1_2.uploader.optionsRules
        }
    });

    fluid.defaults("fluid.uploader.compatibility.distributor.1_3", {
        distributeOptions: {
            record: {
                "1_2": {
                    contextValue: "{fluid.uploader.requiredApi}.options.value",
                    equals: "fluid_1_2",
                    gradeNames: "fluid.uploader.compatibility.1_2"
                }
            },
            target: "{/ fluid.uploader}.options.contextAwareness.apiCompatibility.checks"
        }
    });

    fluid.constructSingle([], {
        singleRootType: "fluid.uploader.compatibility.distributor",
        type: "fluid.uploader.compatibility.distributor.1_3"
    });

})(fluid_3_0_0);
