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

    // Gradename to invoke "fluid.uiOptions.prefsEditor"
    fluid.prefs.builder({
        gradeNames: ["fluid.prefs.auxSchema.starter"]
    });

    fluid.defaults("fluid.uiOptions.prefsEditor", {
        gradeNames: ["fluid.prefs.constructed.prefsEditor"],
        lazyLoad: false,
        distributeOptions: {
            "uio.separatedPanel.lazyLoad": {
                record: "{that}.options.lazyLoad",
                target: "{that separatedPanel}.options.lazyLoad"
            },
            "uio.uiEnhancer.tocTemplate": {
                source: "{that}.options.tocTemplate",
                target: "{that uiEnhancer > tableOfContents}.options.tocTemplate"
            },
            "uio.uiEnhancer.tocMessage": {
                source: "{that}.options.tocMessage",
                target: "{that uiEnhancer > tableOfContents}.options.tocMessage"
            },
            "uio.uiEnhancer.ignoreForToC": {
                source: "{that}.options.ignoreForToC",
                target: "{that uiEnhancer > tableOfContents}.options.ignoreForToC"
            }
        }
    });

})(jQuery, fluid_3_0_0);
