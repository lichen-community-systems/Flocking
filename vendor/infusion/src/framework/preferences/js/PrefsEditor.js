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

    /*****************************
     * Preferences Editor Loader *
     *****************************/

    /*
     * An Preferences Editor top-level component that reflects the collaboration between prefsEditor, templateLoader and messageLoader.
     * This component is the only Preferences Editor component that is intended to be called by the outside world.
     */
    fluid.defaults("fluid.prefs.prefsEditorLoader", {
        gradeNames: ["fluid.prefs.settingsGetter", "fluid.prefs.initialModel", "fluid.viewComponent"],
        defaultLocale: "en",
        components: {
            prefsEditor: {
                priority: "last",
                type: "fluid.prefs.prefsEditor",
                createOnEvent: "onCreatePrefsEditorReady",
                options: {
                    members: {
                        initialModel: "{prefsEditorLoader}.initialModel"
                    },
                    invokers: {
                        getSettings: "{prefsEditorLoader}.getSettings"
                    },
                    listeners: {
                        "onReady.boil": {
                            listener: "{prefsEditorLoader}.events.onReady",
                            args: ["{prefsEditorLoader}"]
                        }
                    }
                }
            },
            templateLoader: {
                type: "fluid.resourceLoader",
                options: {
                    events: {
                        onResourcesLoaded: "{prefsEditorLoader}.events.onPrefsEditorTemplatesLoaded"
                    }
                }
            },
            messageLoader: {
                type: "fluid.resourceLoader",
                createOnEvent: "afterInitialSettingsFetched",
                options: {
                    defaultLocale: "{prefsEditorLoader}.options.defaultLocale",
                    locale: "{prefsEditorLoader}.settings.preferences.locale",
                    resourceOptions: {
                        dataType: "json"
                    },
                    events: {
                        onResourcesLoaded: "{prefsEditorLoader}.events.onPrefsEditorMessagesLoaded"
                    }
                }
            }
        },
        listeners: {
            "onCreate.getInitialSettings": {
                listener: "fluid.prefs.prefsEditorLoader.getInitialSettings",
                args: ["{that}"]
            }
        },
        events: {
            afterInitialSettingsFetched: null,
            onPrefsEditorTemplatesLoaded: null,
            onPrefsEditorMessagesLoaded: null,
            onCreatePrefsEditorReady: {
                events: {
                    templateLoaded: "onPrefsEditorTemplatesLoaded",
                    prefsEditorMessagesLoaded: "onPrefsEditorMessagesLoaded"
                }
            },
            onReady: null
        },
        distributeOptions: {
            "prefsEditorLoader.templateLoader": {
                source: "{that}.options.templateLoader",
                removeSource: true,
                target: "{that > templateLoader}.options"
            },
            "prefsEditorLoader.templateLoader.terms": {
                source: "{that}.options.terms",
                target: "{that > templateLoader}.options.terms"
            },
            "prefsEditorLoader.messageLoader": {
                source: "{that}.options.messageLoader",
                removeSource: true,
                target: "{that > messageLoader}.options"
            },
            "prefsEditorLoader.messageLoader.terms": {
                source: "{that}.options.terms",
                target: "{that > messageLoader}.options.terms"
            },
            "prefsEditorLoader.prefsEditor": {
                source: "{that}.options.prefsEditor",
                removeSource: true,
                target: "{that > prefsEditor}.options"
            }
        }
    });

    fluid.prefs.prefsEditorLoader.getInitialSettings = function (that) {
        var promise = fluid.promise();
        var fetchPromise = that.getSettings();
        fetchPromise.then(function (savedSettings) {
            that.settings = $.extend(true, {}, that.initialModel, savedSettings);
            that.events.afterInitialSettingsFetched.fire(that.settings);
        }, function (error) {
            fluid.log(fluid.logLevel.WARN, error);
            that.settings = that.initialModel;
            that.events.afterInitialSettingsFetched.fire(that.settings);
        });
        fluid.promise.follow(fetchPromise, promise);
        return promise;
    };

    // TODO: This mixin grade appears to be supplied manually by various test cases but no longer appears in
    // the main configuration. We should remove the need for users to supply this - also the use of "defaultPanels" in fact
    // refers to "starter panels"
    fluid.defaults("fluid.prefs.transformDefaultPanelsOptions", {
        // Do not supply "fluid.prefs.inline" here, since when this is used as a mixin for separatedPanel, it ends up displacing the
        // more refined type of the prefsEditorLoader
        gradeNames: ["fluid.viewComponent"],
        distributeOptions: {
            "transformDefaultPanelsOptions.textSize": {
                source: "{that}.options.textSize",
                removeSource: true,
                target: "{that textSize}.options"
            },
            "transformDefaultPanelsOptions.lineSpace": {
                source: "{that}.options.lineSpace",
                removeSource: true,
                target: "{that lineSpace}.options"
            },
            "transformDefaultPanelsOptions.textFont": {
                source: "{that}.options.textFont",
                removeSource: true,
                target: "{that textFont}.options"
            },
            "transformDefaultPanelsOptions.contrast": {
                source: "{that}.options.contrast",
                removeSource: true,
                target: "{that contrast}.options"
            },
            "transformDefaultPanelsOptions.layoutControls": {
                source: "{that}.options.layoutControls",
                removeSource: true,
                target: "{that layoutControls}.options"
            },
            "transformDefaultPanelsOptions.enhanceInputs": {
                source: "{that}.options.enhanceInputs",
                removeSource: true,
                target: "{that enhanceInputs}.options"
            }
        }
    });

    /**********************
     * Preferences Editor *
     **********************/

    fluid.defaults("fluid.prefs.settingsGetter", {
        gradeNames: ["fluid.component"],
        members: {
            getSettings: "{fluid.prefs.store}.get"
        }
    });

    fluid.defaults("fluid.prefs.settingsSetter", {
        gradeNames: ["fluid.component"],
        invokers: {
            setSettings: {
                funcName: "fluid.prefs.settingsSetter.setSettings",
                args: ["{arguments}.0", "{arguments}.1", "{fluid.prefs.store}.set"]
            }
        }
    });

    fluid.prefs.settingsSetter.setSettings = function (model, directModel, set) {
        var userSettings = fluid.copy(model);
        return set(directModel, userSettings);
    };

    fluid.defaults("fluid.prefs.uiEnhancerRelay", {
        gradeNames: ["fluid.modelComponent"],
        listeners: {
            "onCreate.addListener": "{that}.addListener",
            "onDestroy.removeListener": "{that}.removeListener"
        },
        events: {
            updateEnhancerModel: "{fluid.prefs.prefsEditor}.events.onUpdateEnhancerModel"
        },
        invokers: {
            addListener: {
                funcName: "fluid.prefs.uiEnhancerRelay.addListener",
                args: ["{that}.events.updateEnhancerModel", "{that}.updateEnhancerModel"]
            },
            removeListener: {
                funcName: "fluid.prefs.uiEnhancerRelay.removeListener",
                args: ["{that}.events.updateEnhancerModel", "{that}.updateEnhancerModel"]
            },
            updateEnhancerModel: {
                funcName: "fluid.prefs.uiEnhancerRelay.updateEnhancerModel",
                args: ["{uiEnhancer}", "{fluid.prefs.prefsEditor}.model.preferences"]
            }
        }
    });

    fluid.prefs.uiEnhancerRelay.addListener = function (modelChanged, listener) {
        modelChanged.addListener(listener);
    };

    fluid.prefs.uiEnhancerRelay.removeListener = function (modelChanged, listener) {
        modelChanged.removeListener(listener);
    };

    fluid.prefs.uiEnhancerRelay.updateEnhancerModel = function (uiEnhancer, newModel) {
        uiEnhancer.updateModel(newModel);
    };

    /*
     * A component that works in conjunction with the UI Enhancer component
     * to allow users to set personal user interface preferences. The Preferences Editor component provides a user
     * interface for setting and saving personal preferences, and the UI Enhancer component carries out the
     * work of applying those preferences to the user interface.
     */
    fluid.defaults("fluid.prefs.prefsEditor", {
        gradeNames: ["fluid.prefs.settingsGetter", "fluid.prefs.settingsSetter", "fluid.prefs.initialModel", "fluid.remoteModelComponent", "fluid.viewComponent"],
        invokers: {
            // Updates the change applier and fires modelChanged on subcomponent fluid.prefs.controls
            fetchImpl: {
                funcName: "fluid.prefs.prefsEditor.fetchImpl",
                args: ["{that}"]
            },
            writeImpl: {
                funcName: "fluid.prefs.prefsEditor.writeImpl",
                args: ["{that}", "{arguments}.0"]
            },
            applyChanges: {
                funcName: "fluid.prefs.prefsEditor.applyChanges",
                args: ["{that}"]
            },
            save: {
                funcName: "fluid.prefs.prefsEditor.save",
                args: ["{that}"]
            },
            saveAndApply: {
                funcName: "fluid.prefs.prefsEditor.saveAndApply",
                args: ["{that}"]
            },
            reset: {
                funcName: "fluid.prefs.prefsEditor.reset",
                args: ["{that}"]
            },
            cancel: {
                funcName: "fluid.prefs.prefsEditor.cancel",
                args: ["{that}"]
            }
        },
        selectors: {
            panels: ".flc-prefsEditor-panel",
            cancel: ".flc-prefsEditor-cancel",
            reset: ".flc-prefsEditor-reset",
            save: ".flc-prefsEditor-save",
            previewFrame : ".flc-prefsEditor-preview-frame"
        },
        events: {
            onSave: null,
            onCancel: null,
            beforeReset: null,
            afterReset: null,
            onAutoSave: null,
            modelChanged: null,
            onPrefsEditorRefresh: null,
            onUpdateEnhancerModel: null,
            onPrefsEditorMarkupReady: null,
            onReady: null
        },
        listeners: {
            "onCreate.init": "fluid.prefs.prefsEditor.init",
            "onAutoSave.save": "{that}.save"
        },
        model: {
            local: {
                preferences: "{that}.model.preferences"
            }
        },
        modelListeners: {
            "preferences": [{
                listener: "fluid.prefs.prefsEditor.handleAutoSave",
                args: ["{that}"],
                namespace: "autoSave",
                excludeSource: ["init"]
            }, {
                listener: "{that}.events.modelChanged.fire",
                args: ["{change}.value"],
                namespace: "modelChange"
            }]
        },
        resources: {
            template: "{templateLoader}.resources.prefsEditor"
        },
        autoSave: false
    });

    /*
     * Refresh PrefsEditor
     */
    fluid.prefs.prefsEditor.applyChanges = function (that) {
        that.events.onUpdateEnhancerModel.fire();
    };

    fluid.prefs.prefsEditor.fetchImpl = function (that) {
        var promise = fluid.promise(),
            fetchPromise = that.getSettings();

        fetchPromise.then(function (savedModel) {
            var completeModel = $.extend(true, {}, that.initialModel, savedModel);
            promise.resolve(completeModel);
        }, promise.reject);

        return promise;
    };

    fluid.prefs.prefsEditor.writeImpl = function (that, modelToSave) {
        var promise = fluid.promise(),
            stats = {changes: 0, unchanged: 0, changeMap: {}},
            changedPrefs = {};

        modelToSave = fluid.copy(modelToSave);

        // To address https://issues.fluidproject.org/browse/FLUID-4686
        fluid.model.diff(modelToSave.preferences, fluid.get(that.initialModel, ["preferences"]), stats);

        if (stats.changes === 0) {
            delete modelToSave.preferences;
        } else {
            fluid.each(stats.changeMap, function (state, pref) {
                fluid.set(changedPrefs, pref, modelToSave.preferences[pref]);
            });
            modelToSave.preferences = changedPrefs;
        }

        that.events.onSave.fire(modelToSave);
        var setPromise = that.setSettings(modelToSave);

        fluid.promise.follow(setPromise, promise);
        return promise;
    };

    /**
     * Sends the prefsEditor.model to the store and fires onSave
     *
     * @param {fluid.prefs.prefsEditor} that - A `fluid.prefs.prefsEditor` instance
     * @return {Promise} A promise that will be resolved with the saved model or rejected on error.
     */
    fluid.prefs.prefsEditor.save = function (that) {
        var promise = fluid.promise();
        if (!that.model || $.isEmptyObject(that.model)) {  // Don't save a reset model
            promise.resolve({});
        } else {
            var writePromise = that.write();
            fluid.promise.follow(writePromise, promise);
        }

        return promise;
    };

    fluid.prefs.prefsEditor.saveAndApply = function (that) {
        var promise = fluid.promise();
        var prevSettingsPromise = that.getSettings(),
            savePromise = that.save();

        prevSettingsPromise.then(function (prevSettings) {
            savePromise.then(function (changedSelections) {
                // Only when preferences are changed, re-render panels and trigger enactors to apply changes
                if (!fluid.model.diff(fluid.get(changedSelections, "preferences"), fluid.get(prevSettings, "preferences"))) {
                    that.events.onPrefsEditorRefresh.fire();
                    that.applyChanges();
                }
            });
            fluid.promise.follow(savePromise, promise);
        });

        return promise;
    };

    /*
     * Resets the selections to the integrator's defaults and fires afterReset
     */
    fluid.prefs.prefsEditor.reset = function (that) {
        var transaction = that.applier.initiate();
        that.events.beforeReset.fire(that);
        transaction.fireChangeRequest({path: "preferences", type: "DELETE"});
        transaction.change("", fluid.copy(that.initialModel));
        transaction.commit();
        that.events.onPrefsEditorRefresh.fire();
        that.events.afterReset.fire(that);
    };

    /*
     * Resets the selections to the last saved selections and fires onCancel
     */
    fluid.prefs.prefsEditor.cancel = function (that) {
        that.events.onCancel.fire();
        var fetchPromise = that.fetch();
        fetchPromise.then(function () {
            var transaction = that.applier.initiate();
            transaction.fireChangeRequest({path: "preferences", type: "DELETE"});
            transaction.change("", that.model.remote);
            transaction.commit();
            that.events.onPrefsEditorRefresh.fire();
        });
    };

    // called once markup is applied to the document containing tab component roots
    fluid.prefs.prefsEditor.finishInit = function (that) {
        var bindHandlers = function (that) {
            var saveButton = that.locate("save");
            if (saveButton.length > 0) {
                saveButton.on("click", that.saveAndApply);
                var form = fluid.findForm(saveButton);
                $(form).on("submit", function () {
                    that.saveAndApply();
                });
            }
            that.locate("reset").on("click", that.reset);
            that.locate("cancel").on("click", that.cancel);
        };

        that.container.append(that.options.resources.template.resourceText);
        bindHandlers(that);

        var fetchPromise = that.fetch();
        fetchPromise.then(function () {
            that.events.onPrefsEditorMarkupReady.fire();
            that.events.onPrefsEditorRefresh.fire();
            that.applyChanges();
            that.events.onReady.fire(that);

        });
    };

    fluid.prefs.prefsEditor.handleAutoSave = function (that) {
        if (that.options.autoSave) {
            that.events.onAutoSave.fire();
        }
    };

    fluid.prefs.prefsEditor.init = function (that) {
        // This setTimeout is to ensure that fetching of resources is asynchronous,
        // and so that component construction does not run ahead of subcomponents for SeparatedPanel
        // (FLUID-4453 - this may be a replacement for a branch removed for a FLUID-2248 fix)
        setTimeout(function () {
            if (!fluid.isDestroyed(that)) {
                fluid.prefs.prefsEditor.finishInit(that);
            }
        }, 1);
    };

    /******************************
     * Preferences Editor Preview *
     ******************************/

    fluid.defaults("fluid.prefs.preview", {
        gradeNames: ["fluid.viewComponent"],
        components: {
            enhancer: {
                type: "fluid.uiEnhancer",
                container: "{preview}.enhancerContainer",
                createOnEvent: "onReady"
            },
            templateLoader: "{templateLoader}"
        },
        invokers: {
            updateModel: {
                funcName: "fluid.prefs.preview.updateModel",
                args: [
                    "{preview}",
                    "{prefsEditor}.model.preferences"
                ]
            }
        },
        events: {
            onReady: null
        },
        listeners: {
            "onCreate.startLoadingContainer": "fluid.prefs.preview.startLoadingContainer",
            "{prefsEditor}.events.modelChanged": {
                listener: "{that}.updateModel",
                namespace: "updateModel"
            },
            "onReady.updateModel": "{that}.updateModel"
        },
        templateUrl: "%prefix/PrefsEditorPreview.html"
    });

    fluid.prefs.preview.updateModel = function (that, preferences) {
        /**
         * SetTimeout is temp fix for http://issues.fluidproject.org/browse/FLUID-2248
         */
        setTimeout(function () {
            if (that.enhancer) {
                that.enhancer.updateModel(preferences);
            }
        }, 0);
    };

    fluid.prefs.preview.startLoadingContainer = function (that) {
        var templateUrl = that.templateLoader.transformURL(that.options.templateUrl);
        that.container.on("load", function () {
            that.enhancerContainer = $("body", that.container.contents());
            that.events.onReady.fire();
        });
        that.container.attr("src", templateUrl);
    };

})(jQuery, fluid_3_0_0);
