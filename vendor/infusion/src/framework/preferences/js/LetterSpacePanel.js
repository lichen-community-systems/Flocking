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

    /*************************************
     * Preferences Editor Letter Spacing *
     *************************************/

    /**
     * A sub-component of fluid.prefs that renders the "letter spacing" panel of the user preferences interface.
     */
    fluid.defaults("fluid.prefs.panel.letterSpace", {
        gradeNames: ["fluid.prefs.panel.stepperAdjuster"],
        preferenceMap: {
            "fluid.prefs.letterSpace": {
                "model.value": "value",
                "range.min": "minimum",
                "range.max": "maximum",
                "step": "multipleOf"
            }
        },
        panelOptions: {
            labelIdTemplate: "letterSpace-label-%guid"
        }
    });

})(jQuery, fluid_3_0_0);
