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
     * Localization
     *
     * The enactor to change the locale shown according to the value
     *
     * This grade is resolvable from the root to allow for setting up of model relays
     * from other components on a page that may want to be notified of a language
     * change and update their own UI automatically.
     *******************************************************************************/

    fluid.defaults("fluid.prefs.enactor.localization", {
        gradeNames: ["fluid.prefs.enactor", "fluid.contextAware", "fluid.resolveRoot"],
        preferenceMap: {
            "fluid.prefs.localization": {
                "model.lang": "value"
            }
        },
        contextAwareness: {
            localeChange: {
                checks: {
                    // This check determines if the enactor is being run inside of the separated panel's iframe.
                    // At the moment, all enactors are copied into the iframe to apply settings to the panel as well.
                    // However, the strings for the panel will be localized through the prefsEditorLoader and do not
                    // require the iframe URL to change. When in the panel, we do not run the urlPathLocale changes.
                    inPanel: {
                        contextValue: "{iframeRenderer}.id",
                        // The following undefined grade is needed to prevent the `urlPath` check from supplying its
                        // grade even when the `inPanel` check passes.
                        gradeNames: "fluid.prefs.enactor.localization.inPanel"
                    },
                    urlPath: {
                        contextValue: "{localization}.options.localizationScheme",
                        equals: "urlPath",
                        gradeNames: "fluid.prefs.enactor.localization.urlPathLocale",
                        priority: "after:inPanel"
                    }
                }
            }
        }
    });

    /*******************************************************************************
     * URL Path
     *
     * Changes the URL path to specify which language should be displayed. Useful
     * if languages are served at different URLs based on a language resource.
     * E.g. www.example.com/about/ -> www.example.com/fr/about/
     *******************************************************************************/
    fluid.defaults("fluid.prefs.enactor.localization.urlPathLocale", {
        langMap: {}, // must be supplied by integrator
        langSegValues: {
            expander: {
                funcName: "fluid.values",
                args: ["{that}.options.langMap"]
            }
        },
        // langSegIndex: 1, should be supplied by the integrator. Will default to 1 in `fluid.prefs.enactor.localization.urlPathLocale.updatePathname`
        modelRelay: [{
            target: "urlLangSeg",
            singleTransform: {
                type: "fluid.transforms.valueMapper",
                defaultInput: "{that}.model.lang",
                match: "{that}.options.langMap"
            }
        }],
        modelListeners: {
            urlLangSeg: {
                funcName: "{that}.updatePathname",
                args: ["{change}.value"],
                namespace: "updateURLPathname"
            }
        },
        invokers: {
            updatePathname: {
                funcName: "fluid.prefs.enactor.localization.urlPathLocale.updatePathname",
                args: ["{that}", "{arguments}.0", "{that}.options.langSegValues", "{that}.options.langSegIndex"]
            },
            getPathname: "fluid.prefs.enactor.localization.urlPathLocale.getPathname",
            setPathname: "fluid.prefs.enactor.localization.urlPathLocale.setPathname"
        }
    });

    /**
     * A simple wrapper around the location.pathname getter.
     *
     * @return {String} - If the `pathname` argument is not provided, the current pathname is returned
     */
    fluid.prefs.enactor.localization.urlPathLocale.getPathname = function () {
        return location.pathname;
    };

    /**
     * A simple wrapper around the location.pathname setter.
     *
     * @param {String} pathname - The pathname to set.
     */
    fluid.prefs.enactor.localization.urlPathLocale.setPathname = function (pathname) {
        location.pathname = pathname;
    };

    /**
     * Modifies the URL Path to navigate to the specified localized version of the page. If the "default" language is
     * selected. The function exits without modifying the URL. This allows for the server to automatically, or the user
     * to manually, navigate to a localized page when a language preference hasn't been set.
     *
     * @param {Component} that - an instance of `fluid.prefs.enactor.localization.urlPathLocale`
     * @param {String} urlLangSeg - a language value used in the URL pathname
     * @param {Object} langSegValues - An array of the potential `urlLangSeg` values that can be set.
     * @param {Integer} langSegIndex - (Optional) An index into the path where the language resource identifier is held.
     *                                 By default this value is 1, which represents the first path segment.
     */
    fluid.prefs.enactor.localization.urlPathLocale.updatePathname = function (that, urlLangSeg, langSegValues, langSegIndex) {

        if (fluid.isValue(urlLangSeg)) {
            langSegIndex = langSegIndex || 1;
            var pathname = that.getPathname();
            var pathSegs = pathname.split("/");

            var currentLang = pathSegs[langSegIndex];
            var hasLang = !!currentLang && langSegValues.indexOf(currentLang) >= 0;

            if (hasLang) {
                if (urlLangSeg) {
                    pathSegs[langSegIndex] = urlLangSeg;
                } else {
                    if (langSegIndex === pathSegs.length - 1) {
                        pathSegs.pop();
                    } else {
                        pathSegs.splice(langSegIndex, 1);
                    }
                }
            } else if (urlLangSeg) {
                pathSegs.splice(langSegIndex, 0, urlLangSeg);
            }

            var newPathname = pathSegs.join("/");

            if (newPathname !== pathname) {
                that.setPathname(newPathname);
            }
        }
    };

})(jQuery, fluid_3_0_0);
