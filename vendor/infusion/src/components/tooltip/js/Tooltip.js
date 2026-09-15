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

    fluid.registerNamespace("fluid.tooltip");

    fluid.tooltip.computeContentFunc = function (that) {
        that.contentFunc = that.options.contentFunc ? that.options.contentFunc : that.modelToContentFunc();
    };

    fluid.tooltip.updateContentImpl = function (that) {
        that.computeContentFunc();
        if (that.initialised) {
            that.container.tooltip("option", "content", that.contentFunc);
        }
    };

    fluid.tooltip.idSearchFunc = function (idToContentFunc) {
        return function (/* callback*/) {
            var target = this;
            if ($.contains( target.ownerDocument, target )) { // prevent widget from trying to open tooltip for element no longer in document (FLUID-5394)
                var idToContent = idToContentFunc();
                var ancestor = fluid.findAncestor(target, function (element) {
                    return idToContent[element.id];
                });
                return ancestor ? idToContent[ancestor.id] : null;
            } else {
                return null;
            }

        };
    };

    fluid.tooltip.modelToContentFunc = function (that) {
        var model = that.model;
        if (model.idToContent) {
            return fluid.tooltip.idSearchFunc(function () {
                return that.model.idToContent;
            });
        } else if (model.content) {
            return function () {
                return model.content;
            };
        }
    };

    // Resolve FLUID-5673 by resolving the event target upwards to the nearest match for "items" - this will
    // reproduce the natural effect operated by event bubbling in conjunction with the widget
    fluid.tooltip.resolveTooltipTarget = function (items, event) {
        var originalTarget = fluid.resolveEventTarget(event);
        var tooltipTarget = $(originalTarget).closest(items);
        return tooltipTarget[0];
    };

    // Note that fluid.resolveEventTarget is required
    // because of strange dispatching within tooltip widget's "_open" method
    // ->   this._trigger( "open", event, { tooltip: tooltip };
    // the target of the outer event will be incorrect


    fluid.tooltip.makeOpenHandler = function (that) {
        return function (event, tooltip) {
            fluid.tooltip.closeAll(that);
            var originalTarget = fluid.tooltip.resolveTooltipTarget(that.options.items, event);
            var key = fluid.allocateSimpleId(originalTarget);
            that.openIdMap[key] = true;
            if (that.initialised) {
                that.events.afterOpen.fire(that, originalTarget, tooltip.tooltip, event);
            }
        };
    };

    fluid.tooltip.makeCloseHandler = function (that) {
        return function (event, tooltip) {
            if (that.initialised) { // underlying jQuery UI component will fire various spurious close events after it has been destroyed
                var originalTarget = fluid.tooltip.resolveTooltipTarget(that.options.items, event);
                delete that.openIdMap[originalTarget.id];
                that.events.afterClose.fire(that, originalTarget, tooltip.tooltip, event);
            }
        };
    };

    fluid.tooltip.closeAll = function (that) {
        var dokkument = fluid.getDocument(that.container);
        fluid.each(that.openIdMap, function (value, key) {
            var target = fluid.byId(key, dokkument);
            // "white-box" behaviour - fabricating this fake event shell triggers the standard "close" sequence including notifying
            // our own handler. This will be very fragile to changes in jQuery UI and the underlying widget code
            that.container.tooltip("close", {
                type: "close",
                currentTarget: target,
                target: target
            });
        });
        fluid.clear(that.openIdMap);
    };

    fluid.tooltip.setup = function (that) {
        fluid.tooltip.updateContentImpl(that);
        var directOptions = {
            content: that.contentFunc,
            open: fluid.tooltip.makeOpenHandler(that),
            close: fluid.tooltip.makeCloseHandler(that)
        };
        var fullOptions = $.extend(true, directOptions, that.options.widgetOptions);
        that.container.tooltip(fullOptions);
        that.initialised = true;
    };


    fluid.tooltip.doDestroy = function (that) {
        if (that.initialised) {
            fluid.tooltip.closeAll(that, true);
            var dokkument = fluid.getDocument(that.container),
                container = that.container[0];
            // jQuery UI framework will throw a fit if we have instantiated a widget on a DOM element and then
            // removed it from the DOM. This apparently can't be detected via the jQuery UI API itself.
            if ($.contains(dokkument, container) || dokkument === container) {
                that.container.tooltip("destroy");
            }
            that.initialised = false; // TODO: proper framework facility for this coming with FLUID-4890
        }
    };

    fluid.defaults("fluid.tooltip", {
        gradeNames: ["fluid.viewComponent"],
        widgetOptions: {
            tooltipClass: "{that}.options.styles.tooltip",
            position: "{that}.options.position",
            items: "{that}.options.items",
            show: {
                duration: "{that}.options.duration",
                delay: "{that}.options.delay"
            },
            hide: {
                duration: "{that}.options.duration",
                delay: "{that}.options.delay"
            }
        },
        invokers: {
            /**
             * Manually displays the tooltip
             */
            open: {
                "this": "{that}.container",
                method: "tooltip",
                args: "open"
            },
            /**
             * Manually hides the tooltip
             */
            close: {
                funcName: "fluid.tooltip.closeAll",
                args: "{that}"
            },
            updateContent: {
                changePath: "content",
                value: "{arguments}.0"
            },
            computeContentFunc: {
                funcName: "fluid.tooltip.computeContentFunc",
                args: ["{that}"]
            },
            modelToContentFunc: {
                funcName: "fluid.tooltip.modelToContentFunc",
                args: "{that}"
            }
        },
        model: {
            // backward compatibility for pre-1.5 users of Tooltip
            content: "{that}.options.content"
            // content: String,
            // idToContent: Object {String -> String}
        },
        members: {
            openIdMap: {}
        },
        styles: {
            tooltip: ""
        },
        events: {
            afterOpen: null,  // arguments: that, event.target, tooltip, event
            afterClose: null  // arguments: that, event.target, tooltip, event
        },
        listeners: {
            "onCreate.setup": "fluid.tooltip.setup",
            "onDestroy.doDestroy": "fluid.tooltip.doDestroy"
        },
        modelListeners: {
            // TODO: We could consider a more fine-grained scheme for this,
            // listening to content and idToContent separately
            "": {
                funcName: "fluid.tooltip.updateContentImpl",
                excludeSource: "init",
                args: "{that}"
            }
        },
        position: {
            my: "left top",
            at: "left bottom"
        },
        items: "*",
        delay: 300
    });

})(jQuery, fluid_3_0_0);
