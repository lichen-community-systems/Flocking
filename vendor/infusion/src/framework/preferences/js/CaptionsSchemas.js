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
    * Contains the settings for captions
    *******************************************************************************/

    // Fine-tune the starter aux schema and add captions panel
    fluid.defaults("fluid.prefs.auxSchema.captions", {
        gradeNames: ["fluid.prefs.auxSchema"],
        auxiliarySchema: {
            "namespace": "fluid.prefs.constructed",
            "terms": {
                "templatePrefix": "../../framework/preferences/html",
                "messagePrefix": "../../framework/preferences/messages"
            },
            "template": "%templatePrefix/SeparatedPanelPrefsEditor.html",
            "message": "%messagePrefix/prefsEditor.json",

            captions: {
                type: "fluid.prefs.captions",
                enactor: {
                    type: "fluid.prefs.enactor.captions",
                    container: "body"
                },
                panel: {
                    type: "fluid.prefs.panel.captions",
                    container: ".flc-prefsEditor-captions",
                    template: "%templatePrefix/PrefsEditorTemplate-captions.html",
                    message: "%messagePrefix/captions.json"
                }
            }
        }
    });


    /*******************************************************************************
    * Primary Schema
    *******************************************************************************/

    // add extra prefs to the starter primary schemas

    fluid.defaults("fluid.prefs.schemas.captions", {
        gradeNames: ["fluid.prefs.schemas"],
        schema: {
            "fluid.prefs.captions": {
                "type": "boolean",
                "default": false
            }
        }
    });

})(fluid_3_0_0);
