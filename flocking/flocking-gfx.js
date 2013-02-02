/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2011, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*global window*/
/*jslint browser: true, white: true, vars: true, undef: true, newcap: true, regexp: true, browser: true,
    forin: true, continue: true, nomen: true, bitwise: true, maxerr: 100, indent: 4 */

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";
    
    fluid.registerNamespace("flock.gfx");
    
    /**
     * Sets various stroke and fill styles for the specified 2d context.
     */
    flock.gfx.strokeAndFill = function (ctx, shape) {
        ctx.fillStyle = shape.fill || ctx.fillStyle;
        ctx.strokeStyle = shape.strokeColor || ctx.strokeStyle;
        ctx.lineWidth = shape.strokeWidth || ctx.lineWidth;
    };
    
    flock.gfx.scope = function (canvas, scope) {        
        var ctx = canvas.getContext("2d"),
            h = scope.height,
            w = scope.width,
            vals = scope.values,
            len = vals.length,
            min = scope.min || -1.0,
            max = scope.max || 1.0,
            magX = scope.scaleX || scope.scale || 1.0,
            magY = scope.scaleY || scope.scale || 1.0,
            scaleX = (w / len) * magX,
            centerY = h / (max - min),
            scaleY = centerY * magY,
            i;
        
        // Clear the canvas before drawing on it.
        canvas.width = w; 
        
        // Transform the canvas to shift 0 to the centre point of the canvas and flip the coordinate system.
        ctx.translate(0, h + min * centerY);
        ctx.scale(1, -1);
        flock.gfx.strokeAndFill(ctx, scope);
        for (i = 0; i < len; i++) {
            ctx.lineTo(i * scaleX, vals[i] * scaleY);
        }
        ctx.stroke();
    };
    
    flock.gfx.scopeView = function (canvas, model) {
        var that = {
            model: model || {
                values: []
            },
            canvas: typeof (canvas) === "string" ? document.querySelector(canvas) : canvas
        };
        that.model.min = that.model.min || -1.0;
        that.model.max = that.model.max || 1.0;
        that.model.height = that.canvas.height;
        that.model.width = that.canvas.width;
        
        that.refreshView = function () {
            flock.gfx.scope(that.canvas, that.model);
        };
        
        that.refreshView();        
        return that;
    };
    
    // Polyfill for requestAnimationFrame.
    window.requestAnimationFrame = window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame;
}());