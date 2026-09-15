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
    * Contains the settings for the letter space preference
    *******************************************************************************/

    // Fine-tune the starter aux schema and add letter space preference
    fluid.defaults("fluid.prefs.auxSchema.letterSpace", {
        gradeNames: ["fluid.prefs.auxSchema"],
        auxiliarySchema: {
            "namespace": "fluid.prefs.constructed",
            "terms": {
                "templatePrefix": "../../framework/preferences/html/",
                "messagePrefix": "../../framework/preferences/messages/"
            },
            "template": "%templatePrefix/SeparatedPanelPrefsEditor.html",
            "message": "%messagePrefix/prefsEditor.json",

            letterSpace: {
                type: "fluid.prefs.letterSpace",
                enactor: {
                    type: "fluid.prefs.enactor.letterSpace",
                    fontSizeMap: {
                        "xx-small": "9px",
                        "x-small": "11px",
                        "small": "13px",
                        "medium": "15px",
                        "large": "18px",
                        "x-large": "23px",
                        "xx-large": "30px"
                    }
                },
                panel: {
                    type: "fluid.prefs.panel.letterSpace",
                    container: ".flc-prefsEditor-letter-space",
                    template: "%templatePrefix/PrefsEditorTemplate-letterSpace.html",
                    message: "%messagePrefix/letterSpace.json"
                }
            }
        }
    });


    /*******************************************************************************
    * Primary Schema
    *******************************************************************************/

    // add extra prefs to the starter primary schemas

    fluid.defaults("fluid.prefs.schemas.letterSpace", {
        gradeNames: ["fluid.prefs.schemas"],
        schema: {
            "fluid.prefs.letterSpace": {
                "type": "number",
                "default": 1,
                "minimum": 0.9,
                "maximum": 2,
                "multipleOf": 0.1
            }
        }
    });

})(fluid_3_0_0);
