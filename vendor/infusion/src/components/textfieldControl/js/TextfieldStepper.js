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

    /*********************
     * Textfield Stepper *
     *********************/

    fluid.defaults("fluid.textfieldStepper", {
        gradeNames: ["fluid.viewComponent"],
        strings: {
            // Specified by implementor
            // text of label to apply to both textfield and control
            // via aria-label attribute
            // "aria-label": "",
            increaseLabel: "increment",
            decreaseLabel: "decrement"
        },
        selectors: {
            textfield: ".flc-textfieldStepper-field",
            focusContainer: ".flc-textfieldStepper-focusContainer",
            increaseButton: ".flc-textfieldStepper-increase",
            decreaseButton: ".flc-textfieldStepper-decrease"
        },
        styles: {
            container: "fl-textfieldStepper",
            focus: "fl-textfieldStepper-focus"
        },
        components: {
            textfield: {
                type: "fluid.textfield.rangeController",
                container: "{that}.dom.textfield",
                options: {
                    components: {
                        controller: {
                            options: {
                                model: "{textfieldStepper}.model",
                                modelListeners: {
                                    "range.min": {
                                        "this": "{textfield}.container",
                                        method: "attr",
                                        args: ["min", "{change}.value"]
                                    },
                                    "range.max": {
                                        "this": "{textfield}.container",
                                        method: "attr",
                                        args: ["max", "{change}.value"]
                                    },
                                    "step": {
                                        "this": "{textfield}.container",
                                        method: "attr",
                                        args: ["step", "{change}.value"]
                                    }
                                }
                            }
                        }
                    },
                    attrs: "{textfieldStepper}.options.attrs",
                    strings: "{textfieldStepper}.options.strings"
                }
            },
            increaseButton: {
                type: "fluid.textfieldStepper.button",
                container: "{textfieldStepper}.dom.increaseButton",
                options: {
                    strings: {
                        label: "{textfieldStepper}.options.strings.increaseLabel"
                    },
                    listeners: {
                        "onClick.increase": "{textfieldStepper}.increase"
                    },
                    modelRelay: {
                        target: "disabled",
                        singleTransform: {
                            type: "fluid.transforms.binaryOp",
                            left: "{textfieldStepper}.model.value",
                            right: "{textfieldStepper}.model.range.max",
                            operator: ">="
                        }
                    }
                }
            },
            decreaseButton: {
                type: "fluid.textfieldStepper.button",
                container: "{textfieldStepper}.dom.decreaseButton",
                options: {
                    strings: {
                        label: "{textfieldStepper}.options.strings.decreaseLabel"
                    },
                    listeners: {
                        "onClick.decrease": "{textfieldStepper}.decrease"
                    },
                    modelRelay: {
                        target: "disabled",
                        singleTransform: {
                            type: "fluid.transforms.binaryOp",
                            left: "{textfieldStepper}.model.value",
                            right: "{textfieldStepper}.model.range.min",
                            operator: "<="
                        }
                    }
                }
            }
        },
        invokers: {
            increase: {
                funcName: "fluid.textfieldStepper.step",
                args: ["{that}"]
            },
            decrease: {
                funcName: "fluid.textfieldStepper.step",
                args: ["{that}", -1]
            },
            addFocus: {
                "this": "{that}.dom.focusContainer",
                method: "addClass",
                args: ["{that}.options.styles.focus"]
            },
            removeFocus: {
                "this": "{that}.dom.focusContainer",
                method: "removeClass",
                args: ["{that}.options.styles.focus"]
            }
        },
        listeners: {
            "onCreate.addContainerStyle": {
                "this": "{that}.container",
                method: "addClass",
                args: ["{that}.options.styles.container"]
            },
            "onCreate.bindFocusin": {
                "this": "{that}.container",
                method: "on",
                args: ["focusin", "{that}.addFocus"]
            },
            "onCreate.bindFocusout": {
                "this": "{that}.container",
                method: "on",
                args: ["focusout", "{that}.removeFocus"]
            }
        },
        model: {
            value: null,
            step: 1,
            range: {
                min: 0,
                max: 100
            }
        },
        attrs: {
            // Specified by implementor
            // ID of an element to use as a label for the stepper
            // attribute
            // "aria-labelledby": ""
            // Should specify either "aria-label" or "aria-labelledby"
            // aria-label: "{that}.options.strings.label",
            // ID of an element that is controlled by the textfield.
            // "aria-controls": ""
        },
        distributeOptions: [{
            // The scale option sets the number of decimal places to round
            // the number to. If no scale is specified, the number will not be rounded.
            // Scaling is useful to avoid long decimal places due to floating point imprecision.
            source: "{that}.options.scale",
            target: "{that > fluid.textfield > controller}.options.scale"
        }]
    });

    fluid.textfieldStepper.step = function (that, coefficient) {
        coefficient = coefficient || 1;
        var newValue = that.model.value + (coefficient * that.model.step);
        that.applier.change("value", newValue);
    };

    fluid.defaults("fluid.textfieldStepper.button", {
        gradeNames: ["fluid.viewComponent"],
        strings: {
            // to be specified by an implementor.
            // to provide a label for the button.
            // label: ""
        },
        styles: {
            container: "fl-textfieldStepper-button"
        },
        model: {
            disabled: false
        },
        events: {
            onClick: null
        },
        listeners: {
            "onCreate.bindClick": {
                "this": "{that}.container",
                "method": "on",
                "args": ["click", "{that}.events.onClick.fire"]
            },
            "onCreate.addLabel": {
                "this": "{that}.container",
                method: "attr",
                args: ["aria-label", "{that}.options.strings.label"]
            },
            "onCreate.addContainerStyle": {
                "this": "{that}.container",
                method: "addClass",
                args: ["{that}.options.styles.container"]
            },
            // removing from tab order as keyboard users will
            // increment and decrement the stepper using the up/down arrow keys.
            "onCreate.removeFromTabOrder": {
                "this": "{that}.container",
                method: "attr",
                args: ["tabindex", "-1"]
            }
        },
        modelListeners: {
            disabled: {
                "this": "{that}.container",
                method: "prop",
                args: ["disabled", "{change}.value"]
            }
        }
    });

})(jQuery, fluid_3_0_0);
