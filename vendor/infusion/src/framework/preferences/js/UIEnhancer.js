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
     * Root Model                                                                  *
     *                                                                             *
     * Holds the default values for enactors and panel model values                *
     *******************************************************************************/

    fluid.defaults("fluid.prefs.initialModel", {
        gradeNames: ["fluid.component"],
        members: {
            // TODO: This information is supposed to be generated from the JSON
            // schema describing various preferences. For now it's kept in top
            // level prefsEditor to avoid further duplication.
            initialModel: {
                preferences: {}  // To keep initial preferences
            }
        }
    });

    /***********************************************
     * UI Enhancer                                 *
     *                                             *
     * Transforms the page based on user settings. *
     ***********************************************/

    fluid.defaults("fluid.uiEnhancer", {
        gradeNames: ["fluid.viewComponent"],
        defaultLocale: "en",
        invokers: {
            updateModel: {
                func: "{that}.applier.change",
                args: ["", "{arguments}.0"]
            }
        },
        userGrades: "@expand:fluid.prefs.filterEnhancerGrades({that}.options.gradeNames)",

        distributeOptions: {
            "uiEnhancer.messageLoader.defaultLocale": {
                source: "{that}.options.defaultLocale",
                target: "{that messageLoader}.options.defaultLocale"
            },
            // TODO: This needs to be improved as it is static and should be dynamic. Unfortunately the resource loader
            //       accepts the locale as an option instead of a model value.
            "uiEnhancer.messageLoader.locale": {
                source: "{that}.options.locale",
                target: "{that messageLoader}.model.locale"
            }
        }
    });

    // Make this a standalone grade since options merging can't see 2 levels deep into merging
    // trees and will currently trash "gradeNames" for 2nd level nested components!
    fluid.defaults("fluid.uiEnhancer.root", {
        gradeNames: ["fluid.uiEnhancer", "fluid.resolveRootSingle"],
        singleRootType: "fluid.uiEnhancer"
    });

    fluid.uiEnhancer.ignorableGrades = ["fluid.uiEnhancer", "fluid.uiEnhancer.root", "fluid.resolveRoot", "fluid.resolveRootSingle"];

    // These function is necessary so that we can "clone" a UIEnhancer (e.g. one in an iframe) from another.
    // This reflects a long-standing mistake in UIEnhancer design - we should separate the logic in an enhancer
    // from a particular binding onto a container.
    fluid.prefs.filterEnhancerGrades = function (gradeNames) {
        return fluid.remove_if(fluid.makeArray(gradeNames), function (gradeName) {
            return fluid.frameworkGrades.indexOf(gradeName) !== -1 || fluid.uiEnhancer.ignorableGrades.indexOf(gradeName) !== -1;
        });
    };

    // This just the options that we are clear safely represent user options - naturally this all has
    // to go when we refactor UIEnhancer
    fluid.prefs.filterEnhancerOptions = function (options) {
        return fluid.filterKeys(options, ["classnameMap", "fontSizeMap", "tocTemplate", "tocMessage", "components"]);
    };

    /********************************************************************************
     * PageEnhancer                                                                 *
     *                                                                              *
     * A UIEnhancer wrapper that concerns itself with the entire page.              *
     *                                                                              *
     * "originalEnhancerOptions" is a grade component to keep track of the original *
     * uiEnhancer user options                                                      *
     ********************************************************************************/

    // TODO: Both the pageEnhancer and the uiEnhancer need to be available separately - some
    // references to "{uiEnhancer}" are present in prefsEditorConnections, whilst other
    // sites refer to "{pageEnhancer}". The fact that uiEnhancer requires "body" prevents it
    // being top-level until we have the options flattening revolution. Also one day we want
    // to make good of advertising an unmerged instance of the "originalEnhancerOptions"
    fluid.defaults("fluid.pageEnhancer", {
        gradeNames: ["fluid.component", "fluid.originalEnhancerOptions",
            "fluid.prefs.initialModel", "fluid.prefs.settingsGetter",
            "fluid.resolveRootSingle"],
        distributeOptions: {
            "pageEnhancer.uiEnhancer": {
                source: "{that}.options.uiEnhancer",
                target: "{that > uiEnhancer}.options"
            }
        },
        singleRootType: "fluid.pageEnhancer",
        components: {
            uiEnhancer: {
                type: "fluid.uiEnhancer.root",
                container: "body"
            }
        },
        originalUserOptions: "@expand:fluid.prefs.filterEnhancerOptions({uiEnhancer}.options)",
        listeners: {
            "onCreate.initModel": "fluid.pageEnhancer.init"
        }
    });

    fluid.pageEnhancer.init = function (that) {
        var fetchPromise = that.getSettings();
        fetchPromise.then(function (fetchedSettings) {
            that.uiEnhancer.updateModel(fluid.get(fetchedSettings, "preferences"));
        });
    };

})(jQuery, fluid_3_0_0);
