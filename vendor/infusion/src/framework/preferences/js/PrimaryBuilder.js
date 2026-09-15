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

    fluid.registerNamespace("fluid.prefs.schemas");

    /**
     * A custom merge policy that merges primary schema blocks and
     * places them in the right location (consistent with the JSON schema
     * format).
     * @param {JSON} target - A base for merging the options.
     * @param {JSON} source - Options being merged.
     * @return {JSON} - The updated target.
     */
    fluid.prefs.schemas.merge = function (target, source) {
        if (!target) {
            target = {
                type: "object",
                properties: {}
            };
        }
        // We can handle both schema blocks in options directly and also inside
        // the |properties| field.
        source = source.properties || source;
        $.extend(true, target.properties, source);
        return target;
    };

    /*******************************************************************************
     * Primary builder grade
     *******************************************************************************/

    fluid.defaults("fluid.prefs.primaryBuilder", {
        gradeNames: ["fluid.component", "{that}.buildPrimary"],
        // An index of all schema grades registered with the framework.
        schemaIndex: {
            expander: {
                func: "fluid.indexDefaults",
                args: ["schemaIndex", {
                    gradeNames: "fluid.prefs.schemas",
                    indexFunc: "fluid.prefs.primaryBuilder.defaultSchemaIndexer"
                }]
            }
        },
        primarySchema: {},
        // A list of all necessarry top level preference names.
        typeFilter: [],
        invokers: {
            // An invoker used to generate a set of grades that comprise a
            // final version of the primary schema to be used by the PrefsEditor
            // builder.
            buildPrimary: {
                funcName: "fluid.prefs.primaryBuilder.buildPrimary",
                args: [
                    "{that}.options.schemaIndex",
                    "{that}.options.typeFilter",
                    "{that}.options.primarySchema"
                ]
            }
        }
    });

    /**
     * An invoker method that builds a list of grades that comprise a final version of the primary schema.
     *
     * @param {JSON} schemaIndex - A global index of all schema grades registered with the framework.
     * @param {Array} typeFilter - A list of all necessarry top level preference names.
     * @param {JSON} primarySchema - Primary schema provided as an option to the primary builder.
     * @return {Array} - A list of schema grades.
     */
    fluid.prefs.primaryBuilder.buildPrimary = function (schemaIndex, typeFilter, primarySchema) {
        var suppliedPrimaryGradeName = "fluid.prefs.schemas.suppliedPrimary" + fluid.allocateGuid();
        // Create a grade that has a primary schema passed as an option inclosed.
        fluid.defaults(suppliedPrimaryGradeName, {
            gradeNames: ["fluid.prefs.schemas"],
            schema: fluid.filterKeys(primarySchema.properties || primarySchema,
                typeFilter, false)
        });
        var primary = [];
        // Lookup all available schema grades from the index that match the
        // top level preference name.
        fluid.each(typeFilter, function merge(type) {
            var schemaGrades = schemaIndex[type];
            if (schemaGrades) {
                primary.push.apply(primary, schemaGrades);
            }
        });
        primary.push(suppliedPrimaryGradeName);
        return primary;
    };

    /**
     * An index function that indexes all shcema grades based on their
     * preference name.
     * @param {JSON} defaults -  Registered defaults for a schema grade.
     * @return {String}          A preference name.
     */
    fluid.prefs.primaryBuilder.defaultSchemaIndexer = function (defaults) {
        if (defaults.schema) {
            return fluid.keys(defaults.schema.properties);
        }
    };

    /*******************************************************************************
     * Base primary schema grade
     *******************************************************************************/
    fluid.defaults("fluid.prefs.schemas", {
        gradeNames: ["fluid.component"],
        mergePolicy: {
            schema: fluid.prefs.schemas.merge
        }
    });

})(jQuery, fluid_3_0_0);
