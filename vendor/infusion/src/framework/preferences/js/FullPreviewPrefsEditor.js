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
     * Full Preview Preferences Editor *
     ***********************************/

    fluid.defaults("fluid.prefs.fullPreview", {
        gradeNames: ["fluid.prefs.prefsEditorLoader"],
        outerUiEnhancerOptions: "{originalEnhancerOptions}.options.originalUserOptions",
        outerUiEnhancerGrades: "{originalEnhancerOptions}.uiEnhancer.options.userGrades",
        components: {
            prefsEditor: {
                container: "{that}.container",
                options: {
                    components: {
                        preview: {
                            type: "fluid.prefs.preview",
                            createOnEvent: "onReady",
                            container: "{prefsEditor}.dom.previewFrame",
                            options: {
                                listeners: {
                                    "onReady.boilOnPreviewReady": "{fullPreview}.events.onPreviewReady"
                                }
                            }
                        }
                    },
                    listeners: {
                        "onReady.boil": {
                            listener: "{prefsEditorLoader}.events.onPrefsEditorReady"
                        }
                    },
                    distributeOptions: {
                        "fullPreview.prefsEditor.preview": {
                            source: "{that}.options.preview",
                            removeSource: true,
                            target: "{that > preview}.options"
                        }
                    }
                }
            }
        },
        events: {
            onPrefsEditorReady: null,
            onPreviewReady: null,
            onReady: {
                events: {
                    onPrefsEditorReady: "onPrefsEditorReady",
                    onPreviewReady: "onPreviewReady"
                },
                args: "{that}"
            }
        },
        distributeOptions: {
            "fullPreview.enhancer.outerUiEnhancerOptions": {
                source: "{that}.options.outerUiEnhancerOptions",
                target: "{that enhancer}.options"
            },
            "fullPreview.enhancer.previewEnhancer": {
                source: "{that}.options.previewEnhancer",
                target: "{that enhancer}.options"
            },
            "fullPreviw.preview": {
                source: "{that}.options.preview",
                target: "{that preview}.options"
            },
            "fullPreview.enhancer.outerUiEnhancerGrades": {
                source: "{that}.options.outerUiEnhancerGrades",
                target: "{that enhancer}.options.gradeNames"
            }
        }
    });

})(jQuery, fluid_3_0_0);
