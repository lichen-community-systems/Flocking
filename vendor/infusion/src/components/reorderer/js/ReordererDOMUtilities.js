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
     * Returns the absolute position of a supplied DOM node in pixels.
     * Implementation taken from quirksmode http://www.quirksmode.org/js/findpos.html
     * At the original time of writing considerably quicker and more reliable than jQuery.offset()
     * - this should be reevaluated in time.
     */
    fluid.dom.computeAbsolutePosition = function (element) {
        var curleft = 0, curtop = 0;
        if (element.offsetParent) {
            do {
                curleft += element.offsetLeft;
                curtop += element.offsetTop;
                element = element.offsetParent;
            } while (element);
            return [curleft, curtop];
        }
    };

    /*
     * Cleanse the children of a DOM node by removing all <script> tags.
     * This is necessary to prevent the possibility that these blocks are
     * reevaluated if the node were reattached to the document.
     */
    fluid.dom.cleanseScripts = function (element) {
        var cleansed = $.data(element, fluid.dom.cleanseScripts.MARKER);
        if (!cleansed) {
            fluid.dom.iterateDom(element, function (node) {
                return node.tagName.toLowerCase() === "script" ? "delete" : null;
            });
            $.data(element, fluid.dom.cleanseScripts.MARKER, true);
        }
    };
    fluid.dom.cleanseScripts.MARKER = "fluid-scripts-cleansed";

    /**
     * Inserts newChild as the next sibling of refChild.
     * @param {Object} newChild - The new child element to insert.
     * @param {Object} refChild - The existing child element.
     */
    fluid.dom.insertAfter = function (newChild, refChild) {
        var nextSib = refChild.nextSibling;
        if (!nextSib) {
            refChild.parentNode.appendChild(newChild);
        } else {
            refChild.parentNode.insertBefore(newChild, nextSib);
        }
    };

    // The following two functions taken from http://developer.mozilla.org/En/Whitespace_in_the_DOM
    /**
     * Determine whether a node's text content is entirely whitespace.
     *
     * @param {Object} node - A node implementing the |CharacterData| interface (i.e., a |Text|, |Comment|, or |CDATASection| node).
     * @return {Boolean} - True if all of the text content of `node` is whitespace, otherwise false.
     */
    fluid.dom.isWhitespaceNode = function (node) {
        // Use ECMA-262 Edition 3 String and RegExp features
        return !(/[^\t\n\r ]/.test(node.data));
    };

    /**
     * Determine if a node should be ignored by the iterator functions.
     *
     * @param {Object} node - An object implementing the DOM1 |Node| interface.
     * @return {Boolean} - Returns `true` if the node is:
     *                     1) A |Text| node that is all whitespace
     *                     2) A |Comment| node
     *                     and otherwise `false`.
     */
    fluid.dom.isIgnorableNode = function (node) {
        return (node.nodeType === 8) || // A comment node
            ((node.nodeType === 3) && fluid.dom.isWhitespaceNode(node)); // a text node, all ws
    };

})(jQuery, fluid_3_0_0);
