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

    fluid.registerNamespace("fluid.progress");

    fluid.progress.animateDisplay = function (elm, animation, defaultAnimation, callback) {
        animation = (animation) ? animation : defaultAnimation;
        elm.animate(animation.params, animation.duration, callback);
    };

    fluid.progress.animateProgress = function (elm, width, speed) {
        // de-queue any left over animations
        elm.queue("fx", []);
        elm.animate({
            width: width,
            queue: false
        }, speed);
    };

    /**
     * Shows the progress bar if is currently hidden.
     *
     * @param {fluid.progress} that - an instance of `fluid.progress`
     * @param {Object} animation - (optional) a custom animation used when showing the progress bar
     */
    fluid.progress.showProgress = function (that, animation) {
        var firer = that.events.onProgressBegin.fire;
        if (animation === false) {
            that.displayElement.show();
            firer();
        } else {
            fluid.progress.animateDisplay(that.displayElement, animation, that.options.showAnimation, firer);
        }
    };

    /**
     * Hides the progress bar if it is visible.
     *
     * @param {fluid.progress} that - an instance of `fluid.progress`
     * @param {Number} delay - the amount of time to wait before hiding
     * @param {Object} animation - (optional) a custom animation used when hiding the progress bar
     */
    fluid.progress.hideProgress = function (that, delay, animation) {
        if (delay) {
            // use a setTimeout to delay the hide for n millis, note use of recursion
            setTimeout(function () {
                fluid.progress.hideProgress(that, 0, animation);
            }, delay);
        } else {
            var firer = that.events.afterProgressHidden.fire;
            if (animation === false) {
                that.displayElement.hide();
                firer();
            } else {
                fluid.progress.animateDisplay(that.displayElement, animation, that.options.hideAnimation, firer);
            }
        }
    };

    fluid.progress.updateWidth = function (that, newWidth, dontAnimate) {
        var currWidth = that.indicator.width();
        var direction = that.options.animate;
        if ((newWidth > currWidth) && (direction === "both" || direction === "forward") && !dontAnimate) {
            fluid.progress.animateProgress(that.indicator, newWidth, that.options.speed);
        } else if ((newWidth < currWidth) && (direction === "both" || direction === "backward") && !dontAnimate) {
            fluid.progress.animateProgress(that.indicator, newWidth, that.options.speed);
        } else {
            that.indicator.width(newWidth);
        }
    };

    fluid.progress.percentToPixels = function (that, percent) {
        // progress does not support percents over 100, also all numbers are rounded to integers
        return Math.round((Math.min(percent, 100) * that.progressBar.innerWidth()) / 100);
    };

    fluid.progress.refreshRelativeWidth = function (that) {
        var pixels = Math.max(fluid.progress.percentToPixels(that, parseFloat(that.storedPercent)), that.options.minWidth);
        fluid.progress.updateWidth(that, pixels, true);
    };

    fluid.progress.initARIA = function (ariaElement, ariaBusyText) {
        ariaElement.attr("role", "progressbar");
        ariaElement.attr("aria-valuemin", "0");
        ariaElement.attr("aria-valuemax", "100");
        ariaElement.attr("aria-valuenow", "0");
        // Empty value for ariaBusyText will default to aria-valuenow.
        if (ariaBusyText) {
            ariaElement.attr("aria-valuetext", "");
        }
        ariaElement.attr("aria-busy", "false");
    };

    fluid.progress.updateARIA = function (that, percent) {
        var str = that.options.strings;
        var busy = percent < 100 && percent > 0;
        that.ariaElement.attr("aria-busy", busy);
        that.ariaElement.attr("aria-valuenow", percent);
        // Empty value for ariaBusyText will default to aria-valuenow.
        if (str.ariaBusyText) {
            if (busy) {
                var busyString = fluid.stringTemplate(str.ariaBusyText, {percentComplete : percent});
                that.ariaElement.attr("aria-valuetext", busyString);
            } else if (percent === 100) {
                // FLUID-2936: JAWS doesn't currently read the "Progress is complete" message to the user, even though we set it here.
                that.ariaElement.attr("aria-valuetext", str.ariaDoneText);
            }
        }
    };

    fluid.progress.updateText = function (label, value) {
        label.html(value);
    };

    fluid.progress.repositionIndicator = function (that) {
        that.indicator.css("top", that.progressBar.position().top)
            .css("left", 0)
            .height(that.progressBar.height());
        fluid.progress.refreshRelativeWidth(that);
    };

    /**
     * Updates the state of the progress bar.
     * This will automatically show the progress bar if it is currently hidden.
     * Percentage is specified as a decimal value, but will be automatically converted if needed.
     *
     * @param {fluid.progress} that - an instance of `fluid.progress`
     * @param {Number|String} percent - the current percentage, specified as a "float-ish" value
     * @param {String} labelText - the value to set for the label; this can be an HTML string
     * @param {Object} animationForShow - (optional) the animation to use when showing the progress bar if it is hidden
     */
    fluid.progress.updateProgress = function (that, percent, labelText, animationForShow) {
        // show progress before updating, jQuery will handle the case if the object is already displayed
        fluid.progress.showProgress(that, animationForShow);

        if (percent !== null) {
            that.storedPercent = percent;

            var pixels = Math.max(fluid.progress.percentToPixels(that, parseFloat(percent)), that.options.minWidth);
            fluid.progress.updateWidth(that, pixels);
        }

        if (fluid.isValue(labelText)) {
            var text = fluid.stringTemplate(labelText, {percentComplete: percent});
            fluid.progress.updateText(that.label, text);
        }

        // update ARIA
        if (that.ariaElement) {
            fluid.progress.updateARIA(that, percent);
        }
    };

    fluid.progress.hideElement = function (element, shouldHide) {
        element.toggle(!shouldHide);
    };

    /**
     * Instantiates a new Progress component.
     *
     * @param {jQuery|Selector|Element} container - the DOM element in which the Uploader lives
     * @param {Object} options - (optional) configuration options for the component.
     */
    fluid.defaults("fluid.progress", {
        gradeNames: ["fluid.viewComponent"],
        members: {
            displayElement: "{that}.dom.displayElement",
            progressBar: "{that}.dom.progressBar",
            label: "{that}.dom.label",
            indicator: "{that}.dom.indicator",
            ariaElement: "{that}.dom.ariaElement",
            storedPercent: 0
        },
        events: {
            onProgressBegin: null,
            afterProgressHidden: null
        },
        listeners: {
            onCreate: [ {
                "this": "{that}.dom.indicator",
                method: "width",
                args: "{that}.options.minWidth"
            }, {
                funcName: "fluid.progress.hideElement",
                args: ["{that}.dom.displayElement", "{that}.options.initiallyHidden"]
            }, {
                funcName: "fluid.progress.initARIA",
                args: ["{that}.ariaElement", "{that}.options.strings.ariaBusyText"]
            }],
            onProgressBegin: {
                func: "{that}.options.showAnimation.onProgressBegin"
            },
            afterProgressHidden: {
                func: "{that}.options.hideAnimation.afterProgressHidden"
            }
        },
        invokers: {
            // Shows the progress bar if is currently hidden.
            show: {
                funcName: "fluid.progress.showProgress",
                args: ["{that}", "{arguments}.0"]
            },
            // Hides the progress bar if it is visible.
            hide: {
                funcName: "fluid.progress.hideProgress",
                args: ["{that}", "{arguments}.0", "{arguments}.1"]
            },
            // Updates the state of the progress bar.
            update: {
                funcName: "fluid.progress.updateProgress",
                args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"]
            },
            refreshView: {
                funcName: "fluid.progress.repositionIndicator",
                args: "{that}"
            }
        },
        selectors: {
            displayElement: ".flc-progress", // required, the element that gets displayed when progress is displayed, could be the indicator or bar or some larger outer wrapper as in an overlay effect
            progressBar: ".flc-progress-bar", //required
            indicator: ".flc-progress-indicator", //required
            label: ".flc-progress-label", //optional
            ariaElement: ".flc-progress-bar" // usually required, except in cases where there are more than one progressor for the same data such as a total and a sub-total
        },

        strings: {
            //Empty value for ariaBusyText will default to aria-valuenow.
            ariaBusyText: "Progress is %percentComplete percent complete",
            ariaDoneText: "Progress is complete."
        },

        // progress display and hide animations, use the jQuery animation primatives, set to false to use no animation
        // animations must be symetrical (if you hide with width, you'd better show with width) or you get odd effects
        // see jQuery docs about animations to customize
        showAnimation: {
            params: {
                opacity: "show"
            },
            duration: "slow",
            onProgressBegin: fluid.identity
        }, // equivalent of $().fadeIn("slow")

        hideAnimation: {
            params: {
                opacity: "hide"
            },
            duration: "slow",
            afterProgressHidden: fluid.identity
        }, // equivalent of $().fadeOut("slow")

        minWidth: 5, // 0 length indicators can look broken if there is a long pause between updates
        delay: 0, // the amount to delay the fade out of the progress
        speed: 200, // default speed for animations, pretty fast
        animate: "forward", // suppport "forward", "backward", and "both", any other value is no animation either way
        initiallyHidden: true, // supports progress indicators which may always be present
        updatePosition: false
    });

})(jQuery, fluid_3_0_0);
