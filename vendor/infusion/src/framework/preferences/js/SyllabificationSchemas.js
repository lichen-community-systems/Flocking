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
    * Contains the settings for syllabification
    *******************************************************************************/

    // Fine-tune the starter aux schema and add syllabification panel
    fluid.defaults("fluid.prefs.auxSchema.syllabification", {
        gradeNames: ["fluid.prefs.auxSchema"],
        auxiliarySchema: {
            "namespace": "fluid.prefs.constructed",
            "terms": {
                "templatePrefix": "../../framework/preferences/html",
                "messagePrefix": "../../framework/preferences/messages"
            },
            "template": "%templatePrefix/SeparatedPanelPrefsEditor.html",
            "message": "%messagePrefix/prefsEditor.json",
            syllabification: {
                type: "fluid.prefs.syllabification",
                enactor: {
                    type: "fluid.prefs.enactor.syllabification",
                    container: "body"
                },
                panel: {
                    type: "fluid.prefs.panel.syllabification",
                    container: ".flc-prefsEditor-syllabification",
                    template: "%templatePrefix/PrefsEditorTemplate-syllabification.html",
                    message: "%messagePrefix/syllabification.json"
                }
            }
        }
    });


    /*******************************************************************************
    * Primary Schema
    *******************************************************************************/

    // add extra prefs to the starter primary schemas

    fluid.defaults("fluid.prefs.schemas.syllabification", {
        gradeNames: ["fluid.prefs.schemas"],
        schema: {
            "fluid.prefs.syllabification": {
                "type": "boolean",
                "default": false
            }
        }
    });

})(fluid_3_0_0);
