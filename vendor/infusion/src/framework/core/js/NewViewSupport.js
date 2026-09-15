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

/*
    The contents of this file were adapted from ViewComponentSupport.js and ComponentGraph.js in fluid-authoring
    See: https://github.com/fluid-project/fluid-authoring/blob/FLUID-4884/src/js/ViewComponentSupport.js
         https://github.com/fluid-project/fluid-authoring/blob/FLUID-4884/src/js/ComponentGraph.js
*/

(function ($, fluid) {
    "use strict";

    /**
     * A variant of fluid.viewComponent that bypasses the wacky "initView" and variant signature
     * workflow, sourcing instead its "container" from an option of that name, so that this argument
     * can participate in standard ginger resolution. This enables useful results such as a component
     * which can render its own container into the DOM on startup, whilst the container remains immutable.
     */
    fluid.defaults("fluid.newViewComponent", {
        gradeNames: ["fluid.modelComponent"],
        members: {
            // 3rd argument is throwaway to force evaluation of container
            dom: "@expand:fluid.initDomBinder({that}, {that}.options.selectors, {that}.container)",
            container: "@expand:fluid.container({that}.options.container)"
        }
    });

    /**
     * Used to add an element to a parent container. Internally it can use either of jQuery's prepend or append methods.
     *
     * @param {jQuery|DOMElement|Selector} parentContainer - any jQueryable selector representing the parent element to
     *                                                       inject the `elm` into.
     * @param {DOMElement|jQuery} elm - a DOM element or jQuery element to be added to the parent.
     * @param {String} method - (optional) a string representing the method to use to add the `elm` to the
     *                          `parentContainer`. The method can be "append" (default), "prepend", or "html" (will
     *                          replace the contents).
     */
    fluid.newViewComponent.addToParent = function (parentContainer, elm, method) {
        method = method || "append";
        $(parentContainer)[method](elm);
    };

    /**
     * Similar to fluid.newViewComponent; however, it will render its own markup including its container, into a
     * specified parent container.
     */
    fluid.defaults("fluid.containerRenderingView", {
        gradeNames: ["fluid.newViewComponent"],
        container: "@expand:{that}.renderContainer()",
        // The DOM element which this component should inject its markup into on startup
        parentContainer: "fluid.notImplemented", // must be overridden
        injectionType: "append",
        invokers: {
            renderMarkup: "fluid.identity({that}.options.markup.container)",
            renderContainer: "fluid.containerRenderingView.renderContainer({that}, {that}.renderMarkup, {that}.addToParent)",
            addToParent: {
                funcName: "fluid.newViewComponent.addToParent",
                args: ["{that}.options.parentContainer", "{arguments}.0", "{that}.options.injectionType"]
            }
        }
    });

    /**
     * Renders the components markup and inserts it into the parent container based on the addToParent method
     *
     * @param {Component} that - the component
     * @param {Function} renderMarkup - a function returning the components container markup to be inserted into the
     *                                  parentContainer element
     * @param {Function} addToParent - a function that inserts the container into the DOM
     * @return {DOMElement} - the container
     */
    fluid.containerRenderingView.renderContainer = function (that, renderMarkup, addToParent) {
        fluid.log("Rendering container for " + that.id);
        var containerMarkup = renderMarkup();
        var container = $(containerMarkup);
        addToParent(container);
        return container;
    };

    /**
     * Similar to fluid.newViewComponent; however, it will fetch a template and render it into the container.
     *
     * The template path must be supplied either via a top level `template` option or directly to the
     * `resources.template` option. The path may optionally include "terms" to use as tokens which will be resolved
     * from values specified in the `terms` option.
     *
     * The template is fetched on creation and rendered into the container after it has been fetched. After rendering
     * the `afterRender` event is fired.
     */
    fluid.defaults("fluid.templateRenderingView", {
        gradeNames: ["fluid.newViewComponent", "fluid.resourceLoader"],
        resources: {
            template: "fluid.notImplemented"
        },
        injectionType: "append",
        events: {
            afterRender: null
        },
        listeners: {
            "onResourcesLoaded.render": "{that}.render",
            "onResourcesLoaded.afterRender": {
                listener: "{that}.events.afterRender",
                args: ["{that}"],
                priority: "after:render"
            }
        },
        invokers: {
            render: {
                funcName: "fluid.newViewComponent.addToParent",
                args: ["{that}.container", "{that}.resources.template.resourceText", "{that}.options.injectionType"]
            }
        },
        distributeOptions: {
            "mapTemplateSource": {
                source: "{that}.options.template",
                removeSource: true,
                target: "{that}.options.resources.template"
            }
        }
    });

})(jQuery, fluid_3_0_0);
