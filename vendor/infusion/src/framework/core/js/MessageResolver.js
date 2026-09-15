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

    fluid.defaults("fluid.messageResolver", {
        gradeNames: ["fluid.component"],
        mergePolicy: {
            messageBase: "nomerge",
            parents: "nomerge"
        },
        resolveFunc: fluid.stringTemplate,
        parseFunc: fluid.identity,
        messageBase: {},
        members: {
            messageBase: "@expand:{that}.options.parseFunc({that}.options.messageBase)"
        },
        invokers: {
            lookup: "fluid.messageResolver.lookup({that}, {arguments}.0)", // messagecodes
            resolve: "fluid.messageResolver.resolve({that}, {arguments}.0, {arguments}.1)" // messagecodes, args
        },
        parents: []
    });

    /**
     * Look up the first matching message template, starting with the current grade and working up through its parents.
     * Returns both the template for the message and the function used to resolve the localised value.  By default
     * the resolve function is `fluid.stringTemplate`, and the template returned uses its syntax.
     *
     * @param {Object} that - The component itself.
     * @param {Array} messagecodes - One or more message codes to look up templates for.
     * @return {Object} - An object that contains`template` and `resolveFunc` members (see above).
     */
    fluid.messageResolver.lookup = function (that, messagecodes) {
        var resolved = fluid.messageResolver.resolveOne(that.messageBase, messagecodes);
        if (resolved === undefined) {
            return fluid.find(that.options.parents, function (parent) {
                return parent ? parent.lookup(messagecodes) : undefined;
            });
        } else {
            return {template: resolved, resolveFunc: that.options.resolveFunc};
        }
    };

    /**
     * Look up the first message that corresponds to a message code found in `messageCodes`.  Then, resolve its
     * localised value.  By default, supports variable substitutions using `fluid.stringTemplate`.
     *
     * @param {Object} that - The component itself.
     * @param {Array} messagecodes - A list of message codes to look for.
     * @param {Object} args - A map of variables that may potentially be used as part of the final output.
     * @return {String} - The final message, localised, with any variables found in `args`.
     */
    fluid.messageResolver.resolve = function (that, messagecodes, args) {
        if (!messagecodes) {
            return "[No messagecodes provided]";
        }
        messagecodes = fluid.makeArray(messagecodes);
        var looked = that.lookup(messagecodes);
        return looked ? looked.resolveFunc(looked.template, args) :
            "[Message string for key " + messagecodes[0] + " not found]";
    };


    // unsupported, NON-API function
    fluid.messageResolver.resolveOne = function (messageBase, messagecodes) {
        for (var i = 0; i < messagecodes.length; ++i) {
            var code = messagecodes[i];
            var message = messageBase[code];
            if (message !== undefined) {
                return message;
            }
        }
    };

    /**
     * Converts a data structure consisting of a mapping of keys to message strings, into a "messageLocator" function
     * which maps an array of message codes, to be tried in sequence until a key is found, and an array of substitution
     * arguments, into a substituted message string.
     *
     * @param {Object} messageBase - A body of messages to wrap in a resolver function.
     * @param {Function} [resolveFunc] - (optional) A "resolver" function to use instead of the default `fluid.stringTemplate`.
     * @return {Function} - A "messageLocator" function (see above).
     */
    fluid.messageLocator = function (messageBase, resolveFunc) {
        var resolver = fluid.messageResolver({messageBase: messageBase, resolveFunc: resolveFunc});
        return function (messagecodes, args) {
            return resolver.resolve(messagecodes, args);
        };
    };

    /**
     * Resolve a "message source", which is either itself a resolver, or an object representing a bundle of messages
     * and the associated resolution function.
     *
     * When passing a "data" object, it is expected to have a `type` element that is set to `data`, and to have a
     * `messages` array and a `resolveFunc` function that can be used to resolve messages.
     *
     * A "resolver" is expected to be an object with a `type` element that is set to `resolver` that exposes a `resolve`
     * function.
     *
     * @param {Object} messageSource - See above.
     * @return {Function|String} - A resolve function or a `String` representing the final resolved output.
     */
    fluid.resolveMessageSource = function (messageSource) {
        if (messageSource.type === "data") {
            if (messageSource.url === undefined) {
                return fluid.messageLocator(messageSource.messages, messageSource.resolveFunc);
            }
            else {
                // TODO: fetch via AJAX, and convert format if necessary
            }
        }
        else if (messageSource.type === "resolver") {
            return messageSource.resolver.resolve;
        }
    };
})(jQuery, fluid_3_0_0);
