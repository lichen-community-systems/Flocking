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

    /*************
     * Textfield *
     *************/

    /*
     * A component for controlling a textfield and handling data binding.
     * Typically this will be used in conjunction with a UI control widget such as
     * button steppers or slider.
     */
    fluid.defaults("fluid.textfield", {
        gradeNames: ["fluid.viewComponent"],
        attrs: {
            // Specified by implementor
            // ID of an external label to refer to with aria-labelledby
            // attribute
            // "aria-labelledby": "",
            // Should specify either "aria-label" or "aria-labelledby"
            // aria-label: "{that}.options.strings.label",
            // ID of an element that is controlled by the textfield.
            // "aria-controls": ""
        },
        strings: {
            // Specified by implementor
            // text of label to apply to both textfield and slider input
            // via aria-label attribute
            // "label": ""
        },
        modelListeners: {
            value: {
                "this": "{that}.container",
                "method": "val",
                args: ["{change}.value"]
            }
        },
        listeners: {
            "onCreate.bindChangeEvt": {
                "this": "{that}.container",
                "method": "on",
                "args": ["change", "{that}.setModel"]
            },
            "onCreate.initTextfieldAttributes": {
                "this": "{that}.container",
                method: "attr",
                args: ["{that}.options.attrs"]
            }
        },
        invokers: {
            setModel: {
                changePath: "value",
                value: "{arguments}.0.target.value"
            }
        }
    });

    /**
     * Sets the model value only if the new value is a valid number, and will reset the textfield to the current model
     * value otherwise.
     *
     * @param {Object} that - The component.
     * @param {Number} value - The new numerical entry.
     * @param {String} path - The path into the model for which the value should be set.
     */
    fluid.textfield.setModelRestrictToNumbers = function (that, value, path) {
        var isNumber = !isNaN(Number(value));
        if (isNumber) {
            that.applier.change(path, value);
        }

        // Set the textfield to the latest valid entry.
        // This handles both the cases where an invalid entry was provided, as well as cases where a valid number is
        // rounded. In the case of rounded numbers this ensures that entering a number that rounds to the current
        // set value, doesn't leave the textfield with the unrounded number present.
        that.container.val(that.model.value);
    };

    /******************************
     * TextField Range Controller *
     ******************************/

    /*
     * Range Controller is intended to be used as a grade on a fluid.textfield component. It will limit the input
     * to be constrained within a given numerical range. This should be paired with configuring the textfield.setModel
     * invoker to use fluid.textfield.setModelRestrictToNumbers.
     * The Range Controller is useful when combining the textfield with a UI control element such as stepper buttons
     * or a slider to enter numerical values.
     */
    fluid.defaults("fluid.textfield.rangeController", {
        gradeNames: ["fluid.textfield"],
        components: {
            controller: {
                type: "fluid.modelComponent",
                options: {
                    model: {
                        value: null
                    },
                    modelRelay: [{
                        source: "value",
                        target: "{fluid.textfield}.model.value",
                        singleTransform: {
                            type: "fluid.transforms.numberToString",
                            // The scale option sets the number of decimal places to round
                            // the number to. If no scale is specified, the number will not be rounded.
                            // Scaling is useful to avoid long decimal places due to floating point imprecision.
                            scale: "{that}.options.scale"
                        }
                    }, {
                        target: "value",
                        singleTransform: {
                            type: "fluid.transforms.limitRange",
                            input: "{that}.model.value",
                            min: "{that}.model.range.min",
                            max: "{that}.model.range.max"
                        }
                    }]
                }
            }
        },
        invokers: {
            setModel: {
                funcName: "fluid.textfield.setModelRestrictToNumbers",
                args: ["{that}", "{arguments}.0.target.value", "value"]
            }
        }
    });

})(jQuery, fluid_3_0_0);
