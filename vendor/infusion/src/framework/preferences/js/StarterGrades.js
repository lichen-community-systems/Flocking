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

    /*******************************************************************************
     * Starter prefsEditor Model
     *
     * Provides the default values for the starter prefsEditor model
     *******************************************************************************/

    fluid.defaults("fluid.prefs.initialModel.starter", {
        gradeNames: ["fluid.prefs.initialModel"],
        members: {
            // TODO: This information is supposed to be generated from the JSON
            // schema describing various preferences. For now it's kept in top
            // level prefsEditor to avoid further duplication.
            initialModel: {
                preferences: {
                    textFont: "default",          // key from classname map
                    theme: "default",             // key from classname map
                    textSize: 1,                  // in points
                    lineSpace: 1,                 // in ems
                    toc: false,                   // boolean
                    inputs: false                 // boolean
                }
            }
        }
    });

    /*******************************************************************************
     * CSSClassEnhancerBase
     *
     * Provides the map between the settings and css classes to be applied.
     * Used as a UIEnhancer base grade that can be pulled in as requestd.
     *******************************************************************************/

    fluid.defaults("fluid.uiEnhancer.cssClassEnhancerBase", {
        gradeNames: ["fluid.component"],
        classnameMap: {
            "textFont": {
                "default": "",
                "times": "fl-font-times",
                "comic": "fl-font-comic-sans",
                "arial": "fl-font-arial",
                "verdana": "fl-font-verdana",
                "open-dyslexic": "fl-font-open-dyslexic"
            },
            "theme": {
                "default": "fl-theme-prefsEditor-default",
                "bw": "fl-theme-bw",
                "wb": "fl-theme-wb",
                "by": "fl-theme-by",
                "yb": "fl-theme-yb",
                "lgdg": "fl-theme-lgdg",
                "gd": "fl-theme-gd",
                "gw": "fl-theme-gw",
                "bbr": "fl-theme-bbr"
            },
            "inputs": "fl-input-enhanced"
        }
    });

    /*******************************************************************************
     * BrowserTextEnhancerBase
     *
     * Provides the default font size translation between the strings and actual pixels.
     * Used as a UIEnhancer base grade that can be pulled in as requestd.
     *******************************************************************************/

    fluid.defaults("fluid.uiEnhancer.browserTextEnhancerBase", {
        gradeNames: ["fluid.component"],
        fontSizeMap: {
            "xx-small": "9px",
            "x-small":  "11px",
            "small":    "13px",
            "medium":   "15px",
            "large":    "18px",
            "x-large":  "23px",
            "xx-large": "30px"
        }
    });

    /*******************************************************************************
     * UI Enhancer Starter Enactors
     *
     * A grade component for UIEnhancer. It is a collection of default UI Enhancer
     * action ants.
     *******************************************************************************/

    fluid.defaults("fluid.uiEnhancer.starterEnactors", {
        gradeNames: ["fluid.uiEnhancer", "fluid.uiEnhancer.cssClassEnhancerBase", "fluid.uiEnhancer.browserTextEnhancerBase"],
        model: "{fluid.prefs.initialModel}.initialModel.preferences",
        components: {
            textSize: {
                type: "fluid.prefs.enactor.textSize",
                container: "{uiEnhancer}.container",
                options: {
                    fontSizeMap: "{uiEnhancer}.options.fontSizeMap",
                    model: {
                        value: "{uiEnhancer}.model.textSize"
                    }
                }
            },
            textFont: {
                type: "fluid.prefs.enactor.textFont",
                container: "{uiEnhancer}.container",
                options: {
                    classes: "{uiEnhancer}.options.classnameMap.textFont",
                    model: {
                        value: "{uiEnhancer}.model.textFont"
                    }
                }
            },
            lineSpace: {
                type: "fluid.prefs.enactor.lineSpace",
                container: "{uiEnhancer}.container",
                options: {
                    fontSizeMap: "{uiEnhancer}.options.fontSizeMap",
                    model: {
                        value: "{uiEnhancer}.model.lineSpace"
                    }
                }
            },
            contrast: {
                type: "fluid.prefs.enactor.contrast",
                container: "{uiEnhancer}.container",
                options: {
                    classes: "{uiEnhancer}.options.classnameMap.theme",
                    model: {
                        value: "{uiEnhancer}.model.theme"
                    }
                }
            },
            enhanceInputs: {
                type: "fluid.prefs.enactor.enhanceInputs",
                container: "{uiEnhancer}.container",
                options: {
                    cssClass: "{uiEnhancer}.options.classnameMap.inputs",
                    model: {
                        value: "{uiEnhancer}.model.inputs"
                    }
                }
            },
            tableOfContents: {
                type: "fluid.prefs.enactor.tableOfContents",
                container: "{uiEnhancer}.container",
                options: {
                    tocTemplate: "{uiEnhancer}.options.tocTemplate",
                    tocMessage: "{uiEnhancer}.options.tocMessage",
                    model: {
                        toc: "{uiEnhancer}.model.toc"
                    }
                }
            }
        }
    });

    /*********************************************************************************************************
     * Starter Settings Panels
     *
     * A collection of all the default Preferences Editorsetting panels.
     *********************************************************************************************************/
    fluid.defaults("fluid.prefs.starterPanels", {
        gradeNames: ["fluid.prefs.prefsEditor"],
        selectors: {
            textSize: ".flc-prefsEditor-text-size",
            textFont: ".flc-prefsEditor-text-font",
            lineSpace: ".flc-prefsEditor-line-space",
            contrast: ".flc-prefsEditor-contrast",
            layoutControls: ".flc-prefsEditor-layout-controls",
            enhanceInputs: ".flc-prefsEditor-enhanceInputs"
        },
        components: {
            textSize: {
                type: "fluid.prefs.panel.textSize",
                container: "{prefsEditor}.dom.textSize",
                createOnEvent: "onPrefsEditorMarkupReady",
                options: {
                    gradeNames: "fluid.prefs.prefsEditorConnections",
                    model: {
                        value: "{prefsEditor}.model.preferences.textSize"
                    },
                    messageBase: "{messageLoader}.resources.textSize.resourceText",
                    resources: {
                        template: "{templateLoader}.resources.textSize"
                    },
                    step: 0.1,
                    range: {
                        min: 1,
                        max: 2
                    }
                }
            },
            lineSpace: {
                type: "fluid.prefs.panel.lineSpace",
                container: "{prefsEditor}.dom.lineSpace",
                createOnEvent: "onPrefsEditorMarkupReady",
                options: {
                    gradeNames: "fluid.prefs.prefsEditorConnections",
                    model: {
                        value: "{prefsEditor}.model.preferences.lineSpace"
                    },
                    messageBase: "{messageLoader}.resources.lineSpace.resourceText",
                    resources: {
                        template: "{templateLoader}.resources.lineSpace"
                    },
                    step: 0.1,
                    range: {
                        min: 1,
                        max: 2
                    }
                }
            },
            textFont: {
                type: "fluid.prefs.panel.textFont",
                container: "{prefsEditor}.dom.textFont",
                createOnEvent: "onPrefsEditorMarkupReady",
                options: {
                    gradeNames: "fluid.prefs.prefsEditorConnections",
                    classnameMap: "{uiEnhancer}.options.classnameMap",
                    model: {
                        value: "{prefsEditor}.model.preferences.textFont"
                    },
                    messageBase: "{messageLoader}.resources.textFont.resourceText",
                    resources: {
                        template: "{templateLoader}.resources.textFont"
                    },
                    stringArrayIndex: {
                        textFont: [
                            "textFont-default",
                            "textFont-times",
                            "textFont-comic",
                            "textFont-arial",
                            "textFont-verdana",
                            "textFont-open-dyslexic"
                        ]
                    },
                    controlValues: {
                        textFont: ["default", "times", "comic", "arial", "verdana", "open-dyslexic"]
                    }
                }
            },
            contrast: {
                type: "fluid.prefs.panel.contrast",
                container: "{prefsEditor}.dom.contrast",
                createOnEvent: "onPrefsEditorMarkupReady",
                options: {
                    gradeNames: "fluid.prefs.prefsEditorConnections",
                    classnameMap: "{uiEnhancer}.options.classnameMap",
                    model: {
                        value: "{prefsEditor}.model.preferences.theme"
                    },
                    messageBase: "{messageLoader}.resources.contrast.resourceText",
                    resources: {
                        template: "{templateLoader}.resources.contrast"
                    },
                    stringArrayIndex: {
                        theme: [
                            "contrast-default",
                            "contrast-bw",
                            "contrast-wb",
                            "contrast-by",
                            "contrast-yb",
                            "contrast-lgdg",
                            "contrast-gw",
                            "contrast-gd",
                            "contrast-bbr"
                        ]
                    },
                    controlValues: {
                        theme: ["default", "bw", "wb", "by", "yb", "lgdg", "gw", "gd", "bbr"]
                    }
                }
            },
            layoutControls: {
                type: "fluid.prefs.panel.layoutControls",
                container: "{prefsEditor}.dom.layoutControls",
                createOnEvent: "onPrefsEditorMarkupReady",
                options: {
                    gradeNames: "fluid.prefs.prefsEditorConnections",
                    model: {
                        value: "{prefsEditor}.model.preferences.toc"
                    },
                    messageBase: "{messageLoader}.resources.layoutControls.resourceText",
                    resources: {
                        template: "{templateLoader}.resources.layoutControls"
                    }
                }
            },
            enhanceInputs: {
                type: "fluid.prefs.panel.enhanceInputs",
                container: "{prefsEditor}.dom.enhanceInputs",
                createOnEvent: "onPrefsEditorMarkupReady",
                options: {
                    gradeNames: "fluid.prefs.prefsEditorConnections",
                    model: {
                        value: "{prefsEditor}.model.preferences.inputs"
                    },
                    messageBase: "{messageLoader}.resources.enhanceInputs.resourceText",
                    resources: {
                        template: "{templateLoader}.resources.enhanceInputs"
                    }
                }
            }
        }
    });

    /******************************
     * Starter Template Loader
     ******************************/

    /*
     * A template loader component that expands the resources blocks for loading resources used by starterPanels
     */
    fluid.defaults("fluid.prefs.starterTemplateLoader", {
        gradeNames: ["fluid.resourceLoader"],
        resources: {
            textSize: "%templatePrefix/PrefsEditorTemplate-textSize.html",
            lineSpace: "%templatePrefix/PrefsEditorTemplate-lineSpace.html",
            textFont: "%templatePrefix/PrefsEditorTemplate-textFont.html",
            contrast: "%templatePrefix/PrefsEditorTemplate-contrast.html",
            layoutControls: "%templatePrefix/PrefsEditorTemplate-layout.html",
            enhanceInputs: "%templatePrefix/PrefsEditorTemplate-enhanceInputs.html"
        }
    });

    fluid.defaults("fluid.prefs.starterSeparatedPanelTemplateLoader", {
        gradeNames: ["fluid.prefs.starterTemplateLoader"],
        resources: {
            prefsEditor: "%templatePrefix/SeparatedPanelPrefsEditor.html"
        }
    });

    fluid.defaults("fluid.prefs.starterFullPreviewTemplateLoader", {
        gradeNames: ["fluid.prefs.starterTemplateLoader"],
        resources: {
            prefsEditor: "%templatePrefix/FullPreviewPrefsEditor.html"
        }
    });

    fluid.defaults("fluid.prefs.starterFullNoPreviewTemplateLoader", {
        gradeNames: ["fluid.prefs.starterTemplateLoader"],
        resources: {
            prefsEditor: "%templatePrefix/FullNoPreviewPrefsEditor.html"
        }
    });

    /******************************
     * Starter Message Loader
     ******************************/

    /**
     * A message loader component that expands the resources blocks for loading messages for starter panels
     */
    fluid.defaults("fluid.prefs.starterMessageLoader", {
        gradeNames: ["fluid.resourceLoader"],
        resources: {
            prefsEditor: "%messagePrefix/prefsEditor.json",
            textSize: "%messagePrefix/textSize.json",
            textFont: "%messagePrefix/textFont.json",
            lineSpace: "%messagePrefix/lineSpace.json",
            contrast: "%messagePrefix/contrast.json",
            layoutControls: "%messagePrefix/tableOfContents.json",
            enhanceInputs: "%messagePrefix/enhanceInputs.json"
        }
    });

})(jQuery, fluid_3_0_0);
