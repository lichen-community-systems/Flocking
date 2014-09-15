/*
Copyright 2007-2010 University of Cambridge
Copyright 2007-2009 University of Toronto
Copyright 2010-2011 Lucendo Development Ltd.
Copyright 2010 OCAD University
Copyright 2005-2013 jQuery Foundation, Inc. and other contributors

Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.

You may obtain a copy of the ECL 2.0 License and BSD License at
https://github.com/fluid-project/infusion/raw/master/Infusion-LICENSE.txt
*/

/** This file contains functions which depend on the presence of a DOM document
 * but which do not depend on the contents of Fluid.js **/

var fluid_2_0 = fluid_2_0 || {};

(function ($, fluid) {
    "use strict";

    // polyfill for $.browser which was removed in jQuery 1.9 and later
    // Taken from jquery-migrate-1.2.1.js,
    // jQuery Migrate - v1.2.1 - 2013-05-08
    // https://github.com/jquery/jquery-migrate
    // Copyright 2005, 2013 jQuery Foundation, Inc. and other contributors; Licensed MIT

    fluid.uaMatch = function (ua) {
        ua = ua.toLowerCase();

        var match = /(chrome)[ \/]([\w.]+)/.exec( ua ) ||
            /(webkit)[ \/]([\w.]+)/.exec( ua ) ||
            /(opera)(?:.*version|)[ \/]([\w.]+)/.exec( ua ) ||
            /(msie) ([\w.]+)/.exec( ua ) ||
        ua.indexOf("compatible") < 0 && /(mozilla)(?:.*? rv:([\w.]+)|)/.exec( ua ) || [];

        return {
            browser: match[ 1 ] || "",
            version: match[ 2 ] || "0"
        };
    };

    var matched, browser;

    // Don't clobber any existing jQuery.browser in case it's different
    if (!$.browser) {
        if (!!navigator.userAgent.match(/Trident\/7\./)) {
            browser = { // From http://stackoverflow.com/questions/18684099/jquery-fail-to-detect-ie-11
                msie: true,
                version: 11
            };
        } else {
            matched = fluid.uaMatch(navigator.userAgent);
            browser = {};

            if (matched.browser) {
                browser[matched.browser] = true;
                browser.version = matched.version;
            }
            // Chrome is Webkit, but Webkit is also Safari.
            if (browser.chrome) {
                browser.webkit = true;
            } else if (browser.webkit) {
                browser.safari = true;
            }
        }
        $.browser = browser;
    }

    // Private constants.
    var NAMESPACE_KEY = "fluid-scoped-data";

    /**
     * Gets stored state from the jQuery instance's data map.
     * This function is unsupported: It is not really intended for use by implementors.
     */
    fluid.getScopedData = function(target, key) {
        var data = $(target).data(NAMESPACE_KEY);
        return data ? data[key] : undefined;
    };

    /**
     * Stores state in the jQuery instance's data map. Unlike jQuery's version,
     * accepts multiple-element jQueries.
     * This function is unsupported: It is not really intended for use by implementors.
     */
    fluid.setScopedData = function(target, key, value) {
        $(target).each(function() {
            var data = $.data(this, NAMESPACE_KEY) || {};
            data[key] = value;

            $.data(this, NAMESPACE_KEY, data);
        });
    };

    /** Global focus manager - makes use of "focusin" event supported in jquery 1.4.2 or later.
     */

    var lastFocusedElement = null;

    $(document).bind("focusin", function (event){
        lastFocusedElement = event.target;
    });

    fluid.getLastFocusedElement = function () {
        return lastFocusedElement;
    };


    var ENABLEMENT_KEY = "enablement";

    /** Queries or sets the enabled status of a control. An activatable node
     * may be "disabled" in which case its keyboard bindings will be inoperable
     * (but still stored) until it is reenabled again.
     * This function is unsupported: It is not really intended for use by implementors.
     */

    fluid.enabled = function(target, state) {
        target = $(target);
        if (state === undefined) {
            return fluid.getScopedData(target, ENABLEMENT_KEY) !== false;
        }
        else {
            $("*", target).add(target).each(function() {
                if (fluid.getScopedData(this, ENABLEMENT_KEY) !== undefined) {
                    fluid.setScopedData(this, ENABLEMENT_KEY, state);
                }
                else if (/select|textarea|input/i.test(this.nodeName)) {
                    $(this).prop("disabled", !state);
                }
            });
            fluid.setScopedData(target, ENABLEMENT_KEY, state);
        }
    };

    fluid.initEnablement = function(target) {
        fluid.setScopedData(target, ENABLEMENT_KEY, true);
    };

    // This utility is required through the use of newer versions of jQuery which will obscure the original
    // event responsible for interaction with a target. This is currently use in Tooltip.js and FluidView.js
    // "dead man's blur" but would be of general utility

    fluid.resolveEventTarget = function (event) {
        while (event.originalEvent && event.originalEvent.target) {
            event = event.originalEvent;
        }
        return event.target;
    };

    // These function (fluid.focus() and fluid.blur()) serve several functions. They should be used by
    // all implementation both in test cases and component implementation which require to trigger a focus
    // event. Firstly, they restore the old behaviour in jQuery versions prior to 1.10 in which a focus
    // trigger synchronously relays to a focus handler. In newer jQueries this defers to the real browser
    // relay with numerous platform and timing-dependent effects.
    // Secondly, they are necessary since simulation of focus events by jQuery under IE
    // is not sufficiently good to intercept the "focusin" binding. Any code which triggers
    // focus or blur synthetically throughout the framework and client code must use this function,
    // especially if correct cross-platform interaction is required with the "deadMansBlur" function.

    function applyOp(node, func) {
        node = $(node);
        node.trigger("fluid-"+func);
        node.triggerHandler(func);
        node[func]();
        return node;
    }

    $.each(["focus", "blur"], function(i, name) {
        fluid[name] = function(elem) {
            return applyOp(elem, name);
        };
    });

})(jQuery, fluid_2_0);
