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

    fluid.defaults("fluid.prefs.enactor", {
        gradeNames: ["fluid.modelComponent"]
    });

    /**********************************************************************************
     * styleElements
     *
     * Adds or removes the classname to/from the elements based upon the model value.
     * This component is used as a grade by enhanceInputs
     **********************************************************************************/
    fluid.defaults("fluid.prefs.enactor.styleElements", {
        gradeNames: ["fluid.prefs.enactor"],
        cssClass: null,  // Must be supplied by implementors
        elementsToStyle: null,  // Must be supplied by implementors
        invokers: {
            applyStyle: {
                funcName: "fluid.prefs.enactor.styleElements.applyStyle",
                args: ["{arguments}.0", "{arguments}.1"]
            },
            resetStyle: {
                funcName: "fluid.prefs.enactor.styleElements.resetStyle",
                args: ["{arguments}.0", "{arguments}.1"]
            },
            handleStyle: {
                funcName: "fluid.prefs.enactor.styleElements.handleStyle",
                args: ["{arguments}.0", "{that}.options.elementsToStyle", "{that}.options.cssClass", "{that}.applyStyle", "{that}.resetStyle"]
            }
        },
        modelListeners: {
            value: {
                listener: "{that}.handleStyle",
                args: ["{change}.value"],
                namespace: "handleStyle"
            }
        }
    });

    fluid.prefs.enactor.styleElements.applyStyle = function (elements, cssClass) {
        elements.addClass(cssClass);
    };

    fluid.prefs.enactor.styleElements.resetStyle = function (elements, cssClass) {
        $(elements, "." + cssClass).addBack().removeClass(cssClass);
    };

    fluid.prefs.enactor.styleElements.handleStyle = function (value, elements, cssClass, applyStyleFunc, resetStyleFunc) {
        var func = value ? applyStyleFunc : resetStyleFunc;
        func(elements, cssClass);
    };

    /*******************************************************************************
     * ClassSwapper
     *
     * Has a hash of classes it cares about and will remove all those classes from
     * its container before setting the new class.
     * This component tends to be used as a grade by textFont and contrast
     *******************************************************************************/

    fluid.defaults("fluid.prefs.enactor.classSwapper", {
        gradeNames: ["fluid.prefs.enactor", "fluid.viewComponent"],
        classes: {},  // Must be supplied by implementors
        invokers: {
            clearClasses: {
                funcName: "fluid.prefs.enactor.classSwapper.clearClasses",
                args: ["{that}.container", "{that}.classStr"]
            },
            swap: {
                funcName: "fluid.prefs.enactor.classSwapper.swap",
                args: ["{arguments}.0", "{that}", "{that}.clearClasses"]
            }
        },
        modelListeners: {
            value: {
                listener: "{that}.swap",
                args: ["{change}.value"],
                namespace: "swapClass"
            }
        },
        members: {
            classStr: {
                expander: {
                    func: "fluid.prefs.enactor.classSwapper.joinClassStr",
                    args: "{that}.options.classes"
                }
            }
        }
    });

    fluid.prefs.enactor.classSwapper.clearClasses = function (container, classStr) {
        container.removeClass(classStr);
    };

    fluid.prefs.enactor.classSwapper.swap = function (value, that, clearClassesFunc) {
        clearClassesFunc();
        that.container.addClass(that.options.classes[value]);
    };

    fluid.prefs.enactor.classSwapper.joinClassStr = function (classes) {
        var classStr = "";

        fluid.each(classes, function (oneClassName) {
            if (oneClassName) {
                classStr += classStr ? " " + oneClassName : oneClassName;
            }
        });
        return classStr;
    };

    /*******************************************************************************
     * enhanceInputs
     *
     * The enactor to enhance inputs in the container according to the value
     *******************************************************************************/

    // Note that the implementors need to provide the container for this view component
    fluid.defaults("fluid.prefs.enactor.enhanceInputs", {
        gradeNames: ["fluid.prefs.enactor.styleElements", "fluid.viewComponent"],
        preferenceMap: {
            "fluid.prefs.enhanceInputs": {
                "model.value": "value"
            }
        },
        cssClass: null,  // Must be supplied by implementors
        elementsToStyle: "{that}.container"
    });

    /*******************************************************************************
     * textFont
     *
     * The enactor to change the font face used according to the value
     *******************************************************************************/
    // Note that the implementors need to provide the container for this view component
    fluid.defaults("fluid.prefs.enactor.textFont", {
        gradeNames: ["fluid.prefs.enactor.classSwapper"],
        preferenceMap: {
            "fluid.prefs.textFont": {
                "model.value": "value"
            }
        }
    });

    /*******************************************************************************
     * contrast
     *
     * The enactor to change the contrast theme according to the value
     *******************************************************************************/
    // Note that the implementors need to provide the container for this view component
    fluid.defaults("fluid.prefs.enactor.contrast", {
        gradeNames: ["fluid.prefs.enactor.classSwapper"],
        preferenceMap: {
            "fluid.prefs.contrast": {
                "model.value": "value"
            }
        }
    });



    /*******************************************************************************
     * Functions shared by textSize and lineSpace
     *******************************************************************************/

    /**
     * return "font-size" in px
     * @param {Object} container - The container to evaluate.
     * @param {Object} fontSizeMap - The mapping between the font size string values ("small", "medium" etc) to px values.
     * @return {Number} - The size of the container, in px units.
     */
    fluid.prefs.enactor.getTextSizeInPx = function (container, fontSizeMap) {
        var fontSize = container.css("font-size");

        if (fontSizeMap[fontSize]) {
            fontSize = fontSizeMap[fontSize];
        }

        // return fontSize in px
        return parseFloat(fontSize);
    };

    /*******************************************************************************
     * textRelatedSizer
     *
     * Provides an abstraction for enactors that need to adjust sizes based on
     * a text size value from the DOM. This could include things such as:
     * font-size, line-height, letter-spacing, and etc.
     *******************************************************************************/

    fluid.defaults("fluid.prefs.enactor.textRelatedSizer", {
        gradeNames: ["fluid.prefs.enactor", "fluid.viewComponent"],
        fontSizeMap: {},  // must be supplied by implementors
        invokers: {
            set: "fluid.notImplemented", // must be supplied by a concrete implementation
            getTextSizeInPx: {
                funcName: "fluid.prefs.enactor.getTextSizeInPx",
                args: ["{that}.container", "{that}.options.fontSizeMap"]
            }
        },
        modelListeners: {
            value: {
                listener: "{that}.set",
                args: ["{change}.value"],
                namespace: "setAdaptation"
            }
        }
    });

    /*******************************************************************************
     * spacingSetter
     *
     * Sets the css spacing value on the container to the number of units to
     * increase the space by. If a negative number is provided, the space between
     * will decrease. Setting the value to 1 or unit to 0 will use the default.
     *******************************************************************************/

    fluid.defaults("fluid.prefs.enactor.spacingSetter", {
        gradeNames: ["fluid.prefs.enactor.textRelatedSizer"],
        members: {
            originalSpacing: {
                expander: {
                    func: "{that}.getSpacing"
                }
            }
        },
        cssProp: "",
        invokers: {
            set: {
                funcName: "fluid.prefs.enactor.spacingSetter.set",
                args: ["{that}", "{that}.options.cssProp", "{arguments}.0"]
            },
            getSpacing: {
                funcName: "fluid.prefs.enactor.spacingSetter.getSpacing",
                args: ["{that}", "{that}.options.cssProp", "{that}.getTextSizeInPx"]
            }
        },
        modelListeners: {
            unit: {
                listener: "{that}.set",
                args: ["{change}.value"],
                namespace: "setAdaptation"
            },
            // Replace default model listener, because `value` needs be transformed before being applied.
            // The `unit` model value should be used for setting the adaptation.
            value: {
                listener: "fluid.identity",
                namespace: "setAdaptation"
            }
        },
        modelRelay: {
            target: "unit",
            namespace: "toUnit",
            singleTransform: {
                type: "fluid.transforms.round",
                scale: 1,
                input: {
                    transform: {
                        "type": "fluid.transforms.linearScale",
                        "offset": -1,
                        "input": "{that}.model.value"
                    }
                }
            }
        }
    });

    fluid.prefs.enactor.spacingSetter.getSpacing = function (that, cssProp, getTextSizeFn) {
        var current = parseFloat(that.container.css(cssProp));
        var textSize = getTextSizeFn();
        return fluid.roundToDecimal(current / textSize, 2);
    };

    fluid.prefs.enactor.spacingSetter.set = function (that, cssProp, units) {
        var targetSize = that.originalSpacing;

        if (units) {
            targetSize = targetSize + units;
        }

        // setting the style value to "" will remove it.
        var spacingSetter = targetSize ?  fluid.roundToDecimal(targetSize, 2) + "em" : "";
        that.container.css(cssProp, spacingSetter);
    };

    /*******************************************************************************
     * textSize
     *
     * Sets the text size on the root element to the multiple provided.
     *******************************************************************************/

    // Note that the implementors need to provide the container for this view component
    fluid.defaults("fluid.prefs.enactor.textSize", {
        gradeNames: ["fluid.prefs.enactor.textRelatedSizer"],
        preferenceMap: {
            "fluid.prefs.textSize": {
                "model.value": "value"
            }
        },
        members: {
            root: {
                expander: {
                    "this": "{that}.container",
                    "method": "closest", // ensure that the correct document is being used. i.e. in an iframe
                    "args": ["html"]
                }
            }
        },
        invokers: {
            set: {
                funcName: "fluid.prefs.enactor.textSize.set",
                args: ["{arguments}.0", "{that}", "{that}.getTextSizeInPx"]
            },
            getTextSizeInPx: {
                args: ["{that}.root", "{that}.options.fontSizeMap"]
            }
        }
    });

    fluid.prefs.enactor.textSize.set = function (times, that, getTextSizeInPxFunc) {
        times = times || 1;
        // Calculating the initial size here rather than using a members expand because the "font-size"
        // cannot be detected on hidden containers such as separated paenl iframe.
        if (!that.initialSize) {
            that.initialSize = getTextSizeInPxFunc();
        }

        if (that.initialSize) {
            var targetSize = times * that.initialSize;
            that.root.css("font-size", targetSize + "px");
        }
    };

    /*******************************************************************************
     * lineSpace
     *
     * Sets the line space on the container to the multiple provided.
     *******************************************************************************/

    // Note that the implementors need to provide the container for this view component
    fluid.defaults("fluid.prefs.enactor.lineSpace", {
        gradeNames: ["fluid.prefs.enactor.textRelatedSizer"],
        preferenceMap: {
            "fluid.prefs.lineSpace": {
                "model.value": "value"
            }
        },
        invokers: {
            set: {
                funcName: "fluid.prefs.enactor.lineSpace.set",
                args: ["{that}", "{arguments}.0"]
            },
            getLineHeight: {
                funcName: "fluid.prefs.enactor.lineSpace.getLineHeight",
                args: "{that}.container"
            },
            getLineHeightMultiplier: {
                funcName: "fluid.prefs.enactor.lineSpace.getLineHeightMultiplier",
                args: [{expander: {func: "{that}.getLineHeight"}}, {expander: {func: "{that}.getTextSizeInPx"}}]
            }
        }
    });

    // Get the line-height of an element
    // In IE8 and IE9 this will return the line-height multiplier
    // In other browsers it will return the pixel value of the line height.
    fluid.prefs.enactor.lineSpace.getLineHeight = function (container) {
        return container.css("line-height");
    };

    // Interprets browser returned "line-height" value, either a string "normal", a number with "px" suffix or "undefined"
    // into a numeric value in em.
    // Return 0 when the given "lineHeight" argument is "undefined" (http://issues.fluidproject.org/browse/FLUID-4500).
    fluid.prefs.enactor.lineSpace.getLineHeightMultiplier = function (lineHeight, fontSize) {
        // Handle the given "lineHeight" argument is "undefined", which occurs when firefox detects
        // "line-height" css value on a hidden container. (http://issues.fluidproject.org/browse/FLUID-4500)
        if (!lineHeight) {
            return 0;
        }

        // Needs a better solution. For now, "line-height" value "normal" is defaulted to 1.2em
        // according to https://developer.mozilla.org/en/CSS/line-height
        if (lineHeight === "normal") {
            return 1.2;
        }

        // Continuing the work-around of jQuery + IE bug - http://bugs.jquery.com/ticket/2671
        if (lineHeight.match(/[0-9]$/)) {
            return Number(lineHeight);
        }

        return fluid.roundToDecimal(parseFloat(lineHeight) / fontSize, 2);
    };

    fluid.prefs.enactor.lineSpace.set = function (that, times) {
        // Calculating the initial size here rather than using a members expand because the "line-height"
        // cannot be detected on hidden containers such as separated panel iframe.
        if (!that.initialSize) {
            that.initialSize = that.getLineHeight();
            that.lineHeightMultiplier = that.getLineHeightMultiplier();
        }

        // that.initialSize === 0 when the browser returned "lineHeight" css value is undefined,
        // which occurs when firefox detects "line-height" value on a hidden container.
        // @ See getLineHeightMultiplier() & http://issues.fluidproject.org/browse/FLUID-4500
        if (that.lineHeightMultiplier) {
            var targetLineSpace = that.initialSize === "normal" && times === 1 ? that.initialSize : times * that.lineHeightMultiplier;
            that.container.css("line-height", targetLineSpace);
        }
    };

    /*******************************************************************************
     * tableOfContents
     *
     * To create and show/hide table of contents
     *******************************************************************************/

    // Note that the implementors need to provide the container for this view component
    fluid.defaults("fluid.prefs.enactor.tableOfContents", {
        gradeNames: ["fluid.prefs.enactor", "fluid.viewComponent"],
        preferenceMap: {
            "fluid.prefs.tableOfContents": {
                "model.toc": "value"
            }
        },
        tocTemplate: null,  // must be supplied by implementors
        tocMessage: null,  // must be supplied by implementors
        components: {
            // TODO: When FLUID-6312 and FLUID-6300 are addressed, make sure that this message loader is updated when
            //       the locale is changed. It should also trigger the table of contents to re-render with the
            //       correct message bundle applied.
            messageLoader: {
                type: "fluid.resourceLoader",
                options: {
                    resourceOptions: {
                        dataType: "json"
                    },
                    events: {
                        onResourcesLoaded: "{fluid.prefs.enactor.tableOfContents}.events.onMessagesLoaded"
                    }
                }
            },
            tableOfContents: {
                type: "fluid.tableOfContents",
                container: "{fluid.prefs.enactor.tableOfContents}.container",
                createOnEvent: "onCreateTOCReady",
                options: {
                    listeners: {
                        "afterRender.boilAfterTocRender": "{fluid.prefs.enactor.tableOfContents}.events.afterTocRender"
                    },
                    strings: {
                        tocHeader: "{messageLoader}.resources.tocMessage.resourceText.tocHeader"
                    }
                }
            }
        },
        invokers: {
            applyToc: {
                funcName: "fluid.prefs.enactor.tableOfContents.applyToc",
                args: ["{arguments}.0", "{that}"]
            }
        },
        events: {
            afterTocRender: null,
            onCreateTOC: null,
            onMessagesLoaded: null,
            onCreateTOCReady: {
                events: {
                    onCreateTOC: "onCreateTOC",
                    onMessagesLoaded: "onMessagesLoaded"
                }
            }
        },
        modelListeners: {
            toc: {
                listener: "{that}.applyToc",
                args: ["{change}.value"],
                namespace: "toggleToc"
            }
        },
        distributeOptions: {
            "tocEnactor.tableOfContents.ignoreForToC": {
                source: "{that}.options.ignoreForToC",
                target: "{that tableOfContents}.options.ignoreForToC"
            },
            "tocEnactor.tableOfContents.tocTemplate": {
                source: "{that}.options.tocTemplate",
                target: "{that > tableOfContents > levels}.options.resources.template.url"
            },
            "tocEnactor.messageLoader.tocMessage": {
                source: "{that}.options.tocMessage",
                target: "{that messageLoader}.options.resources.tocMessage"
            }
        }
    });

    fluid.prefs.enactor.tableOfContents.applyToc = function (value, that) {
        if (value) {
            if (that.tableOfContents) {
                that.tableOfContents.show();
            } else {
                that.events.onCreateTOC.fire();
            }
        } else if (that.tableOfContents) {
            that.tableOfContents.hide();
        }
    };

})(jQuery, fluid_3_0_0);
