/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Copyright 2011, Colin Clark
* Dual licensed under the MIT or GPL Version 2 licenses.
*/

/*jslint white: true, vars: true, plusplus: true, undef: true, newcap: true, regexp: true, browser: true, 
    forin: true, continue: true, nomen: true, bitwise: true, maxerr: 100, indent: 4 */

var flock = flock || {};
flock.gfx = flock.gfx || {};

(function () {
    "use strict";

    /**
     * Sets various stroke and fill styles for the specified 2d context.
     */
    flock.gfx.strokeAndFill = function (ctx, shape) {
        ctx.fillStyle = shape.fill || ctx.fillStyle;
        ctx.strokeStyle = shape.strokeColor || ctx.strokeStyle;
        ctx.lineWidth = shape.strokeWidth || ctx.lineWidth;
    };
   
    /**
     * Draws a pie chart in the specified 2d context. Based on a demo by Paul Rouget.
     * Example:
     *    pieChart(ctx, {
     *        x: 25,
     *        y: 25,
     *        radius: 10,
     *        percent: 75,
     *        fill: "#FBB829",
     *        strokeColor: "gray",
     *    });
     */
    flock.gfx.pieChart = function (ctx, pieChart) {
        flock.gfx.strokeAndFill(ctx, pieChart);
        ctx.beginPath();
        ctx.moveTo(pieChart.x, pieChart.y);
        ctx.arc(pieChart.x, pieChart.y, pieChart.radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pieChart.percent / 100, false);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    };
    

    /**
     * Draws a rectangle in the specified 2d context.
     * Example:
     *    circle(ctx, {
     *        fill: "#FBB829",
     *        x: canvas.getAttribute("width") / 2,
     *        y: canvas.getAttribute("height") / 2,
     *       radius: 20,
     *        strokeColor: "gray",
     *        strokeWidth: 3
     *    });
     */
    flock.gfx.circle = function (ctx, circle) {
        flock.gfx.strokeAndFill(ctx, circle);
        ctx.beginPath();
        ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2, false);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    };

    /**
     * Draws a rectangle in the specified 2d context.
     * Example:
     *   rect(ctx, {
     *       fill: "rgba(200, 0, 0, 0.75)",
     *       x: 0,
     *       y: 0,
     *       height: 15,
     *       width: 15
     *   });
     */
    flock.gfx.rect = function (ctx, rect) {
        flock.gfx.strokeAndFill(ctx, rect);
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    };
    
    /**
     * Yep, it draws a line.
     * Example:
     *    flock.gfx.line(ctx, {
     *        x: 0,
     *        y: 0,
     *        endX: 15,
     *        endY: 15,
     *        strokeColor: "red",
     *        strokeWidth: 2
     *    });
     */
    flock.gfx.line = function (ctx, line) {
        ctx.moveTo(line.x, line.y);
        ctx.lineTo(line.endX, line.endY);
        ctx.stroke();
    };
    
    flock.gfx.knob = function (ctx, knob) {
        flock.gfx.circle(ctx, knob);
        
        var angle = (knob.atPos * 3.6) + 90; // Convert percentage to angle, shifting 0 degrees to the bottom.
        var theta = angle * (Math.PI / 180);
        var lineEndX = (Math.cos(theta) * knob.radius) * ctx.canvas.getAttribute("width");
        var lineEndY = (Math.sin(theta) * knob.radius) * ctx.canvas.getAttribute("height");
        
        flock.gfx.line(ctx, {
            x: knob.x,
            y: knob.y,
            endX: lineEndX,
            endY: lineEndY,
            strokeColor: knob.strokeColor,
            strokeWidth: knob.strokeWidth
        });
    };
    
    flock.gfx.knobView = function (canvas, model) {
        var that = {
            model: model || {
                pos: 0
            }
        };
        
        var ctx = canvas.getContext("2d");
        canvas.addEventListener("click", function (e) {
            var x = e.pageX - canvas.offsetLeft, y = e.pageY - canvas.offsetTop;
            // TODO need to convert from Cartesian to unit circle.
            that.refreshView();
        }, false);
        
        that.refreshView = function () {
            flock.gfx.knob(ctx, {
                radius: 20,
                atPos: that.model.pos,
                x: canvas.getAttribute("width") / 2,
                y: canvas.getAttribute("height") / 2,
                fill: "#FBB829",
                strokeColor: "gray",
                strokeWidth: 3
            });
        };
        
        that.refreshView();
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
            canvas: typeof(canvas) === "string" ? document.querySelector(canvas) : canvas
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