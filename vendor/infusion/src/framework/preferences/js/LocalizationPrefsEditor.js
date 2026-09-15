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

(function (fluid) {
    "use strict";

    /*******************************************************************************
    * Starter auxiliary schema grade
    *
    * Contains the settings for the localization preference
    *******************************************************************************/

    // Fine-tune the starter aux schema and add localization preference
    fluid.defaults("fluid.prefs.constructed.localizationPrefsEditorConfig", {
        gradeNames: ["fluid.contextAware"],
        contextAwareness: {
            localeChange: {
                checks: {
                    urlPath: {
                        contextValue: "{localizationPrefsEditorConfig}.options.localizationScheme",
                        equals: "urlPath",
                        gradeNames: "fluid.prefs.constructed.localizationPrefsEditorConfig.urlPathLocale"
                    }
                }
            }
        },
        distributeOptions: {
            "prefsEditor.localization.enactor.localizationScheme": {
                source: "{that}.options.localizationScheme",
                target: "{that uiEnhancer fluid.prefs.enactor.localization}.options.localizationScheme"
            },
            "prefsEditor.localization.panel.locales": {
                source: "{that}.options.locales",
                target: "{that prefsEditor fluid.prefs.panel.localization}.options.controlValues.localization"
            },
            "prefsEditor.localization.panel.localeNames": {
                source: "{that}.options.localeNames",
                target: "{that prefsEditor fluid.prefs.panel.localization}.options.stringArrayIndex.localization"
            }
        }
    });

    fluid.defaults("fluid.prefs.constructed.localizationPrefsEditorConfig.urlPathLocale", {
        distributeOptions: {
            "prefsEditor.localization.enactor.langMap": {
                source: "{that}.options.langMap",
                target: "{that uiEnhancer fluid.prefs.enactor.localization}.options.langMap"
            },
            "prefsEditor.localization.enactor.langSegIndex": {
                source: "{that}.options.langSegIndex",
                target: "{that uiEnhancer fluid.prefs.enactor.localization}.options.langSegIndex"
            }
        }
    });

})(fluid_3_0_0);
