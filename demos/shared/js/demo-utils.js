/*
 * Flocking demo utilities
 * http://github.com/colinbdclark/flocking
 *
 * Copyright 2011-2014, Colin Clark
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require*/
var fluid = fluid || require("infusion"),
    demo = fluid.registerNamespace("demo");

(function () {
    
    "use strict";
    
    demo.toggleButtonView = function(synth, options) {
        var that = {
            model: {
                isPlaying: false
            },
            
            synth: synth,
            button: document.querySelector(typeof (options) === "string" ? options : options.selectors.button),
            onPlay: options.onPlay,
            onPause: options.onPause
        };
        that.buttonBaseClass = that.button.className; // TODO: ummm... library, anyone?
        
        that.play = function () {
            if (that.onPlay) {
                that.onPlay(that.button);
            }
            
            that.button.innerHTML = "Pause";
            that.button.className = that.buttonBaseClass + " " + "playing";
            that.synth.play();
            that.model.isPlaying = true;
        };
        
        that.pause = function () {
            if (that.onPause) {
                that.onPause(that.button);
            }
            
            that.button.innerHTML = "Play";
            that.button.className = that.buttonBaseClass + " " + "paused";
            that.synth.pause();

            that.model.isPlaying = false;
        };
        
        // Wire it up to a button on the page.
        that.button.addEventListener("click", function () {
            if (!that.model.isPlaying) {
                that.play();
            } else {
                that.pause();
            }
        }, false);
        
        that.pause();
        return that;
    };
    
    demo.fileSelectorView = function(synth, options) {
        var that = {
            input: document.querySelector(options.selectors.input),
            button: document.querySelector(options.selectors.button),
            fileName: document.querySelector(options.selectors.fileName)
        };
        
        that.input.addEventListener("change", function () {
            if (that.fileName) {
                that.fileName.innerHTML = that.input.files[0].name;
            }
            
            var players = fluid.makeArray(options.playerId);
            fluid.each(players, function (id) {
                synth.input(id).onInputChanged("buffer");
            });
        });
		
        // On Firefox, bind a click event to the browse button, which delegates to the hidden (ugly) file input element.
        if (window.navigator.userAgent.indexOf("Firefox") !== -1) {
            that.button.addEventListener("click", function (e) {
                that.input.click();
                e.preventDefault();
            }, false);
        } else {
            // On Chrome, show the ugly file input element.
            that.input.style.display = "inline";
            that.button.style.display = "none";
            if (that.fileName) {
                that.fileName.style.display = "none";
            }
        }
    };
    
    demo.dataUrlSelectorView = function (synth, options) {
        var that = {
            field: document.querySelector(options.selectors.field)
        };
        
        that.field.addEventListener("change", function () {
            that.dataUrl = that.field.value;
            
            var players = fluid.makeArray(options.playerId);
            fluid.each(players, function (id) {
                var player = synth.input(id),
                    bufDef = player.input("buffer");
            
                bufDef.url = that.dataUrl;
                player.onInputChanged("buffer");
            });
        });
    };
    
})();