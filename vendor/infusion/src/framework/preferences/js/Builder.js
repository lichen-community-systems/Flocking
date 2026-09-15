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

    fluid.registerNamespace("fluid.prefs");

    fluid.defaults("fluid.prefs.builder", {
        gradeNames: ["fluid.component", "fluid.prefs.auxBuilder"],
        mergePolicy: {
            auxSchema: "expandedAuxSchema"
        },
        assembledPrefsEditorGrade: {
            expander: {
                func: "fluid.prefs.builder.generateGrade",
                args: ["prefsEditor", "{that}.options.auxSchema.namespace", {
                    gradeNames: ["fluid.prefs.assembler.prefsEd", "fluid.viewComponent"],
                    componentGrades: "{that}.options.constructedGrades",
                    loaderGrades: "{that}.options.auxSchema.loaderGrades",
                    defaultLocale: "{that}.options.auxSchema.defaultLocale",
                    enhancer: {
                        defaultLocale: "{that}.options.auxSchema.defaultLocale"
                    }
                }]
            }
        },
        assembledUIEGrade: {
            expander: {
                func: "fluid.prefs.builder.generateGrade",
                args: ["uie", "{that}.options.auxSchema.namespace", {
                    gradeNames: ["fluid.viewComponent", "fluid.prefs.assembler.uie"],
                    componentGrades: "{that}.options.constructedGrades"
                }]
            }
        },
        constructedGrades: {
            expander: {
                func: "fluid.prefs.builder.constructGrades",
                args: [
                    "{that}.options.auxSchema",
                    [
                        "enactors",
                        "messages",
                        "panels",
                        "initialModel",
                        "templateLoader",
                        "messageLoader",
                        "terms",
                        "aliases_prefsEditor",
                        "aliases_enhancer"
                    ]
                ]
            }
        },
        mappedDefaults: "{primaryBuilder}.options.schema.properties",
        components: {
            primaryBuilder: {
                type: "fluid.prefs.primaryBuilder",
                options: {
                    typeFilter: {
                        expander: {
                            func: "fluid.prefs.builder.parseAuxSchema",
                            args: "{builder}.options.auxiliarySchema"
                        }
                    }
                }
            }
        },
        distributeOptions: {
            "builder.primaryBuilder.primarySchema": {
                source: "{that}.options.primarySchema",
                removeSource: true,
                target: "{that > primaryBuilder}.options.primarySchema"
            }
        }
    });

    fluid.defaults("fluid.prefs.assembler.uie", {
        gradeNames: ["fluid.viewComponent"],
        components: {
            // These two components become global
            store: {
                type: "fluid.prefs.globalSettingsStore",
                options: {
                    distributeOptions: {
                        "uie.store.context.checkUser": {
                            target: "{that fluid.prefs.store}.options.contextAwareness.strategy.checks.user",
                            record: {
                                contextValue: "{fluid.prefs.assembler.uie}.options.storeType",
                                gradeNames: "{fluid.prefs.assembler.uie}.options.storeType"
                            }
                        }
                    }
                }
            },
            enhancer: {
                type: "fluid.component",
                options: {
                    gradeNames: "{that}.options.enhancerType",
                    enhancerType: "fluid.pageEnhancer",
                    components: {
                        uiEnhancer: {
                            options: {
                                gradeNames: [
                                    "{fluid.prefs.assembler.uie}.options.componentGrades.enactors",
                                    "{fluid.prefs.assembler.prefsEd}.options.componentGrades.aliases_enhancer"
                                ]
                            }
                        }
                    }
                }
            }
        },
        distributeOptions: {
            "uie.enhancer": {
                source: "{that}.options.enhancer",
                target: "{that uiEnhancer}.options",
                removeSource: true
            },
            "uie.enhancer.enhancerType": {
                source: "{that}.options.enhancerType",
                target: "{that > enhancer}.options.enhancerType"
            },
            "uie.store": { // TODO: not clear that this hits anything since settings store is not a subcomponent
                source: "{that}.options.store",
                target: "{that fluid.prefs.store}.options"
            }
        }
    });

    fluid.defaults("fluid.prefs.assembler.prefsEd", {
        gradeNames: ["fluid.viewComponent", "fluid.prefs.assembler.uie"],
        components: {
            prefsEditorLoader: {
                type: "fluid.viewComponent",
                container: "{fluid.prefs.assembler.prefsEd}.container",
                priority: "last",
                options: {
                    gradeNames: [
                        "{fluid.prefs.assembler.prefsEd}.options.componentGrades.terms",
                        "{fluid.prefs.assembler.prefsEd}.options.componentGrades.messages",
                        "{fluid.prefs.assembler.prefsEd}.options.componentGrades.initialModel",
                        "{that}.options.loaderGrades"
                    ],
                    templateLoader: {
                        gradeNames: ["{fluid.prefs.assembler.prefsEd}.options.componentGrades.templateLoader"]
                    },
                    messageLoader: {
                        gradeNames: ["{fluid.prefs.assembler.prefsEd}.options.componentGrades.messageLoader"]
                    },
                    prefsEditor: {
                        gradeNames: [
                            "{fluid.prefs.assembler.prefsEd}.options.componentGrades.panels",
                            "{fluid.prefs.assembler.prefsEd}.options.componentGrades.aliases_prefsEditor",
                            "fluid.prefs.uiEnhancerRelay"
                        ]
                    },
                    events: {
                        onReady: "{fluid.prefs.assembler.prefsEd}.events.onPrefsEditorReady"
                    }
                }
            }
        },
        events: {
            onPrefsEditorReady: null,
            onReady: {
                events: {
                    onPrefsEditorReady: "onPrefsEditorReady",
                    onCreate: "onCreate"
                },
                args: ["{that}"]
            }
        },
        distributeOptions: {
            "prefsEdAssembler.prefsEditorLoader.loaderGrades": {
                source: "{that}.options.loaderGrades",
                removeSource: true,
                target: "{that > prefsEditorLoader}.options.loaderGrades"
            },
            "prefsEdAssembler.prefsEditorLoader.terms": {
                source: "{that}.options.terms",
                removeSource: true,
                target: "{that prefsEditorLoader}.options.terms"
            },
            "prefsEdAssembler.prefsEditorLoader.defaultLocale": {
                source: "{that}.options.defaultLocale",
                target: "{that prefsEditorLoader}.options.defaultLocale"
            },
            "prefsEdAssembler.uiEnhancer.defaultLocale": {
                source: "{that}.options.defaultLocale",
                target: "{that uiEnhancer}.options.defaultLocale"
            },
            "prefsEdAssembler.prefsEditor": {
                source: "{that}.options.prefsEditor",
                removeSource: true,
                target: "{that prefsEditor}.options"
            }
        }
    });

    fluid.prefs.builder.generateGrade = function (name, namespace, options) {
        var gradeNameTemplate = "%namespace.%name";
        var gradeName = fluid.stringTemplate(gradeNameTemplate, {name: name, namespace: namespace});
        fluid.defaults(gradeName, options);
        return gradeName;
    };

    fluid.prefs.builder.constructGrades = function (auxSchema, gradeCategories) {
        var constructedGrades = {};
        fluid.each(gradeCategories, function (category) {
            var gradeOpts = auxSchema[category];
            if (fluid.get(gradeOpts, "gradeNames")) {
                constructedGrades[category] = fluid.prefs.builder.generateGrade(category, auxSchema.namespace, gradeOpts);
            }
        });
        return constructedGrades;
    };

    fluid.prefs.builder.parseAuxSchema = function (auxSchema) {
        var auxTypes = [];
        fluid.each(auxSchema, function parse(field) {
            var type = field.type;
            if (type) {
                auxTypes.push(type);
            }
        });
        return auxTypes;
    };

    /*
     * A one-stop-shop function to build and instantiate a prefsEditor from a schema.
     */
    fluid.prefs.create = function (container, options) {
        options = options || {};
        var builder = fluid.prefs.builder(options.build);
        return fluid.invokeGlobalFunction(builder.options.assembledPrefsEditorGrade, [container, options.prefsEditor]);
    };

})(jQuery, fluid_3_0_0);
