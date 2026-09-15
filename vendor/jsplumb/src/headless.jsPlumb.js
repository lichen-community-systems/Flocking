/*
 * jsPlumb
 *
 * Title:jsPlumb 1.7.9
 *
 * Provides a way to visually connect elements on an HTML page, using SVG or VML.
 *
 * This file contains the 'headless' adapter - functionality to support running jsPlumb outside of the browser.
 *
 * Copyright (c) 2010 - 2015 jsPlumb (hello@jsplumbtoolkit.com)
 *
 * http://jsplumbtoolkit.com
 * http://github.com/sporritt/jsplumb
 *
 * Dual licensed under the MIT and GPL2 licenses.
 */
;(function() {

    var root = this, _jp = root.jsPlumb;

    _jp.extend(root.jsPlumbInstance.prototype, {
        scopeChange: function (el, elId, endpoints, scope, types) { },
        getSelector: function (ctx, spec) {
            var sel = null;
            if (arguments.length == 1) {
                sel = ctx.nodeType != null ? ctx : document.querySelectorAll(ctx);
            }
            else
                sel = ctx.querySelectorAll(spec);

            return sel;
        },
        // DRAG/DROP
        isDragSupported: function () { return false; },
        isDropSupported: function () { return false; },
        getOriginalEvent: function (e) { return e; },
        trigger: function (el, event, originalEvent) { },
        on:function() { },
        off:function() { }
    });


}).call(this);