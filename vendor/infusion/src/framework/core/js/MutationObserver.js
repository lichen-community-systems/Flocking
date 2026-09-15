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

    /*
     * Provides a grade for creating and interacting with a Mutation Observer to listen/respond to DOM changes.
     */
    fluid.defaults("fluid.mutationObserver", {
        gradeNames: ["fluid.viewComponent"],
        events: {
            onNodeAdded: null,
            onNodeRemoved: null,
            onAttributeChanged: null
        },
        listeners: {
            "onDestroy.disconnect": "{that}.disconnect"
        },
        members: {
            observer: {
                expander: {
                    func: "{that}.createObserver"
                }
            }
        },
        defaultObserveConfig: {
            attributes: true,
            childList: true,
            subtree: true
        },
        invokers: {
            observe: {
                funcName: "fluid.mutationObserver.observe",
                args: ["{that}", "{arguments}.0", "{arguments}.1"]
            },
            disconnect: {
                "this": "{that}.observer",
                method: "disconnect"
            },
            takeRecords: {
                "this": "{that}.observer",
                method: "takeRecords"
            },
            createObserver: {
                funcName: "fluid.mutationObserver.createObserver",
                args: ["{that}"]
            }
        }
    });

    /**
     * A Mutation Observer; allows for tracking changes to the DOM.
     * A mutation observer is created with a callback function, configured through its `observe` method.
     * See: https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
     *
     * @typedef {Object} MutationObserver
     */

    /**
     * Instantiates a mutation observer, defining the callback function which relays the observations to component
     * events. The configuration passed to the observe function will determine what mutations are observed and what
     * information is returned. See `fluid.mutationObserver.observe` about configuring the mutation observer.
     *
     * Event Mapping:
     * onNodeAdded - fired for each added node, includes the node and mutation record
     * onNodeRemoved - fired for each removed node, includes the node and mutation record
     * onAttributeChanged - fired for each attribute change, includes the node and mutation record
     *
     * @param {Component} that - an instance of `fluid.mutationObserver`
     *
     * @return {MutationObserver} - the created mutation observer`
     */
    fluid.mutationObserver.createObserver = function (that) {
        var observer = new MutationObserver(function (mutationRecords) {
            fluid.each(mutationRecords, function (mutationRecord) {
                // IE11 doesn't support forEach on NodeLists and NodeLists aren't real arrays so using fluid.each
                // will iterate over the object properties. Therefore we use a for loop to iterate over the nodes.
                for (var i = 0; i < mutationRecord.addedNodes.length; i++) {
                    that.events.onNodeAdded.fire(mutationRecord.addedNodes[i], mutationRecord);
                }
                for (var j = 0; j < mutationRecord.removedNodes.length; j++) {
                    that.events.onNodeRemoved.fire(mutationRecord.removedNodes[j], mutationRecord);
                }
                if (mutationRecord.type === "attributes") {
                    that.events.onAttributeChanged.fire(mutationRecord.target, mutationRecord);
                }
            });
        });

        return observer;
    };

    /**
     * Starts observing the DOM changes. Optionally takes in a target and configuration for setting up the specific
     * observation. The observe method may be called multiple times; however, if the same observer is set on the same
     * node, the old one will be replaced. If an observation is disconnected, the observe method will need to be called
     * again to re-instate the mutation observation.
     * See: https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/observe
     *
     * @param {Component} that - an instance of `fluid.mutationObserver`
     * @param {DOMElement|jQuery} target - a DOM element or jQuery element to be observed. By default the component's
     *                                     container element is used.
     * @param {Object} options - config options to pass to the observations. This specifies which mutations should be
     *                           reported. See: https://developer.mozilla.org/en-US/docs/Web/API/MutationObserverInit
     *                           By default the config specified at `that.options.defaultObserveConfig` is used.
     */
    fluid.mutationObserver.observe = function (that, target, options) {
        target = fluid.unwrap(target || that.container);
        that.observer.observe(target, options || that.options.defaultObserveConfig);
    };


})(jQuery, fluid_3_0_0);
