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

    /***********************************
     * Preferences Editor Localization *
     ***********************************/

    /*
     * A sub-component of fluid.prefs that renders the "localization" panel of the user preferences interface.
     */
    fluid.defaults("fluid.prefs.panel.localization", {
        gradeNames: ["fluid.prefs.panel"],
        preferenceMap: {
            "fluid.prefs.localization": {
                "model.value": "value",
                "controlValues.localization": "enum",
                "stringArrayIndex.localization": "enumLabels"
            }
        },
        mergePolicy: {
            "controlValues.localization": "replace",
            "stringArrayIndex.localization": "replace"
        },
        selectors: {
            header: ".flc-prefsEditor-localization-header",
            localization: ".flc-prefsEditor-localization",
            label: ".flc-prefsEditor-localization-label",
            localizationDescr: ".flc-prefsEditor-localization-descr"
        },
        selectorsToIgnore: ["header"],
        protoTree: {
            label: {messagekey: "label"},
            localizationDescr: {messagekey: "description"},
            localization: {
                optionnames: "${{that}.msgLookup.localization}",
                optionlist: "${{that}.options.controlValues.localization}",
                selection: "${value}"
            }
        }
    });

})(jQuery, fluid_3_0_0);
