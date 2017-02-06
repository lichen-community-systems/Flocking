/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2011-2014, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global require*/
/*jshint white: false, newcap: true, regexp: true, browser: true,
    forin: false, nomen: true, bitwise: false, maxerr: 100,
    indent: 4, plusplus: false, curly: true, eqeqeq: true,
    freeze: true, latedef: true, noarg: true, nonew: true, quotmark: double, undef: true,
    unused: true, strict: true, asi: false, boss: false, evil: false, expr: false,
    funcscope: false*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var $ = fluid.registerNamespace("jQuery");

    fluid.registerNamespace("flock.view");

    // TODO: Infusionize.
    flock.view.scope = function (canvas, model) {
        var that = {
            model: model || {
                values: []
            },
            canvas: $(canvas)[0]
        };

        that.refreshView = function () {
            var ctx = that.ctx,
                h = that.model.height,
                halfH = that.model.halfHeight,
                w = that.model.width,
                vals = that.model.values,
                len = vals.length,
                scaleX = that.model.scaleX * (w / len), // TODO: Doesn't support scale values < 1.0
                i,
                x,
                y;

            ctx.clearRect(0, 0, w, h);
            ctx.beginPath();
            for (i = 0; i < len; i++) {
                x = i * scaleX;
                y = vals[i] * that.model.scaleY * halfH + halfH;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        };

        that.init = function () {
            that.ctx = that.canvas.getContext("2d");
            that.ctx.fillStyle = that.model.fill || that.ctx.fillStyle;
            that.ctx.strokeStyle = that.model.strokeColor || that.ctx.strokeStyle;
            that.ctx.lineWidth = that.model.strokeWidth || that.ctx.lineWidth;

            that.model.min = that.model.min || -1.0;
            that.model.max = that.model.max || 1.0;
            that.model.height = that.canvas.height;
            that.model.halfHeight = that.model.height / 2;
            that.model.width = that.canvas.width;
            that.model.scaleX = that.model.scaleX || that.model.scale || 1.0;
            that.model.scaleY = that.model.scaleY || that.model.scale || 1.0;

            that.refreshView();
        };

        that.init();
        return that;
    };


    /**
     * Returns a Canvas element with the buffer drawn in it using
     * the flock.view.scope component.
     *
     * @param {Array-like} buffer the buffer to draw
     * @param {Object} options configuration options
     *                   - height the height of the canvas in pixels, defaults to 200px
     *                   - width the width of the canvas in pixels, defaults to 1000px
     */
    flock.view.drawBuffer = function (buffer, o) {
        o = o || {};
        o.height = o.height || 200;
        o.width = o.width || 1000;

        var markup = fluid.stringTemplate(flock.view.drawBuffer.markupTemplate, o);
        var canvas = $(markup);
        flock.view.scope(canvas[0], {
            values: buffer
        });

        return canvas;
    };

    flock.view.drawBuffer.markupTemplate = "<canvas height='%height' width='%width'></canvas>";


}());
