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

    /**************************************
     * Full No Preview Preferences Editor *
     **************************************/

    fluid.defaults("fluid.prefs.fullNoPreview", {
        gradeNames: ["fluid.prefs.prefsEditorLoader"],
        components: {
            prefsEditor: {
                container: "{that}.container",
                options: {
                    listeners: {
                        "afterReset.applyChanges": {
                            listener: "{that}.applyChanges"
                        },
                        "afterReset.save": {
                            listener: "{that}.save",
                            priority: "after:applyChanges"
                        }
                    }
                }
            }
        },
        events: {
            onReady: null
        }
    });

})(jQuery, fluid_3_0_0);
