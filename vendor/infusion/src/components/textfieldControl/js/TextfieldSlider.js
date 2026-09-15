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

    /********************
     * Textfield Slider *
     ********************/

    fluid.defaults("fluid.textfieldSlider", {
        gradeNames: ["fluid.viewComponent"],
        components: {
            textfield: {
                type: "fluid.textfield.rangeController",
                container: "{that}.dom.textfield",
                options: {
                    components: {
                        controller: {
                            options: {
                                model: "{textfieldSlider}.model"
                            }
                        }
                    },
                    attrs: "{textfieldSlider}.options.attrs",
                    strings: "{textfieldSlider}.options.strings"
                }
            },
            slider: {
                type: "fluid.slider",
                container: "{textfieldSlider}.dom.slider",
                options: {
                    model: "{textfieldSlider}.model",
                    attrs: "{textfieldSlider}.options.attrs",
                    strings: "{textfieldSlider}.options.strings"
                }
            }
        },
        selectors: {
            textfield: ".flc-textfieldSlider-field",
            slider: ".flc-textfieldSlider-slider"
        },
        styles: {
            container: "fl-textfieldSlider fl-focus"
        },
        model: {
            value: null,
            step: 1.0,
            range: {
                min: 0,
                max: 100
            }
        },
        modelRelay: {
            target: "value",
            singleTransform: {
                type: "fluid.transforms.limitRange",
                input: "{that}.model.value",
                min: "{that}.options.range.min",
                max: "{that}.options.range.max"
            }
        },

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
        listeners: {
            "onCreate.addContainerStyle": {
                "this": "{that}.container",
                method: "addClass",
                args: ["{that}.options.styles.container"]
            }
        },
        distributeOptions: [{
            // The scale option sets the number of decimal places to round
            // the number to. If no scale is specified, the number will not be rounded.
            // Scaling is useful to avoid long decimal places due to floating point imprecision.
            source: "{that}.options.scale",
            target: "{that > fluid.textfield > controller}.options.scale"
        }]
    });

    fluid.defaults("fluid.slider", {
        gradeNames: ["fluid.viewComponent"],
        modelRelay: {
            target: "value",
            singleTransform: {
                type: "fluid.transforms.stringToNumber",
                input: "{that}.model.stringValue"
            }
        },
        invokers: {
            setModel: {
                changePath: "stringValue",
                value: {
                    expander: {
                        "this": "{that}.container",
                        "method": "val"
                    }
                }
            },
            updateSliderAttributes: {
                "this": "{that}.container",
                method: "attr",
                args: [{
                    "min": "{that}.model.range.min",
                    "max": "{that}.model.range.max",
                    "step": "{that}.model.step",
                    "type": "range",
                    "value": "{that}.model.value",
                    "aria-labelledby": "{that}.options.attrs.aria-labelledby",
                    "aria-label": "{that}.options.attrs.aria-label"
                }]
            }
        },
        listeners: {
            "onCreate.initSliderAttributes": "{that}.updateSliderAttributes",
            "onCreate.bindSlideEvt": {
                "this": "{that}.container",
                "method": "on",
                "args": ["input", "{that}.setModel"]
            },
            "onCreate.bindRangeChangeEvt": {
                "this": "{that}.container",
                "method": "on",
                "args": ["change", "{that}.setModel"]
            }
        },
        modelListeners: {
            // If we don't exclude init, the value can get
            // set before onCreate.initSliderAttributes
            // sets min / max / step, which messes up the
            // initial slider rendering
            "value": [{
                "this": "{that}.container",
                "method": "val",
                args: ["{change}.value"],
                excludeSource: "init"
            }],
            "range": {
                listener: "{that}.updateSliderAttributes",
                excludeSource: "init"
            },
            "step": {
                listener: "{that}.updateSliderAttributes",
                excludeSource: "init"
            }
        }
    });

})(jQuery, fluid_3_0_0);
