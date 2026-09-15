/*
 * jsPlumb
 *
 * Title:jsPlumb 1.7.4
 *
 * Provides a way to visually connect elements on an HTML page, using SVG or VML.
 *
 * This file contains the adapter when running outside of the browser.
 *
 * Copyright (c) 2010 - 2015 jsPlumb (hello@jsplumbtoolkit.com)
 *
 * http://jsplumbtoolkit.com
 * http://github.com/sporritt/jsplumb
 *
 * Dual licensed under the MIT and GPL2 licenses.
 */

;(function() {

    var root = this;

    var _loc = function(e) { return [0,0]; };

    root.jsPlumbUtil.sizeElement = function(el, x, y, w, h) {
        el.pos = [x,y];
        el.dim = [ w,h ];
    };

    //tag, atts, id, parent
    var Node = function(params) {
        this.id = params.id || jsPlumbUtil.uuid();
        this.tag = params.tag;
        this.atts = params.atts || {};
        this.pos = params || [0,0];
        this.dim = params || [0,0];
        this.style = params.style || {};
        this.setAttribute = function(a, v) {
            this.atts[a] = v;
        };
        this.getAttribute = function(a) {
            return this.atts[a];
        };
        this.children = [];
        this.appendChild = function(n) {
            this.children.push(n);
        };
        this.parentNode = null;
        this.removeChild = function(child) {
            throw new TypeError("TODO! Node.removeChild");
        };

        params.dom.register(this);
    };

    /**
     * a very lightweight implementation of the "DOM"
     * @constructor
     */
    var MurkyDOM = function() {
        Node.apply(this);
        this.tag = "document";
        var nodes = {};

        this.register = function(node) {
            nodes[_getId(node)] = node;
        };

        this.remove = function(node) {
            delete nodes[_getId(node)];
        };
    };

    var _getId = function(el) {
        return typeof el === "string" ? el : el.id;
    };

    var _getOrCreate = function(instance, id) {
        var el = instance.murkyDOM[id];
        if (el == null) {
            el = new Node("div", null, id);
            instance.murkyDOM[id] = el;
        }
        return el;
    };

    var _getMurkyDOM = function(instance) {
        if (instance.murkyDOM == null) {
            instance.murkyDOM = MurkyDOM();
        }
        return instance.murkyDOM;
    };

    jsPlumb.extend(jsPlumbInstance.prototype, {
        headless: true,
        animationSupported:false,

        pageLocation: _loc,
        screenLocation: _loc,
        clientLocation: _loc,


        getElement: function (el) {
            if (el == null) return null;
            el = typeof el === "string" ? el : el.length != null && el.enctype == null ? el[0] : el;
            return typeof el === "string" ? _getOrCreate(this, el) : el;
        },
        getElementObject: function (el) { return el; },
        removeElement: function (el) { this.murkyDOM.remove(el); },

        createElement:function(tag, style, clazz, atts) {
            return this.createElementNS(null, tag, style, clazz, atts);
        },

        createElementNS:function(ns, tag, style, clazz, atts) {
            var e = new Node(tag);
            if (clazz)
                e.className = clazz;
            e.atts = atts || {};
            if (ns) e.ns = ns;

            return e;
        },

        getAttribute: function (el, attName) {
            return el.atts ? el.atts[attName] : null;
        },

        setAttribute: function (el, a, v) {
            el.atts = el.atts || {};
            el.atts[a] = v;
        },

        setAttributes: function (el, atts) {
            for (var i in atts)
                this.setAttribute(el, i, atts[i])
        },

        appendToRoot: function (node) {
            //document.body.appendChild(node);
        },
        getRenderModes: function () {
            return [ "svg" ];
        },
        isRenderModeAvailable: function (m) {
            return m === "svg";
        },
        getDragManager: function (_jsPlumb) {
            //return new DragManager(_jsPlumb);
        },
        trySetRenderMode: function (mode) {
            return "svg";
        },
        addClass: function (el, clazz) { },
        hasClass: function (el, clazz) { return false; },
        removeClass: function (el, clazz) { },
        updateClasses: function (el, toAdd, toRemove) { },
        setClass: function (el, clazz) { },

        setPosition: function (el, p) {
            el.pos = [ p.left, p.top ];
        },
        getPosition: function (el) {
            return {
                left: el.pos[0],
                top: el.pos[1]
            };
        },
        getStyle:function(el, prop) {

        },
        getOffset:function(el, _instance, relativeToRoot) {
            return {
                left:el.pos[0],
                top:el.pos[1]
            };
        },
        //
        // return x+y proportion of the given element's size corresponding to the location of the given event.
        //
        getPositionOnElement: function (evt, el, zoom) { },

        getAbsolutePosition: function (el) {
            var _one = function (idx) {
                var ss = el.pos[idx];
                if (ss) return parseFloat(ss.substring(0, ss.length - 2));
            };
            return [ _one(0), _one(1) ];
        },

        setAbsolutePosition: function (el, xy) {
            el.pos = xy;
        },

        /**
         * gets the size for the element, in an array : [ width, height ].
         */
        getSize: function (el) {
            return el.dim || [0,0];
        },
        getWidth: function (el) {
            return el.dim ? el.dim[0] : 0;
        },
        getHeight: function (el) {
            return el.dim ? el.dim[1] : 0;
        }
    });

}).call(this);