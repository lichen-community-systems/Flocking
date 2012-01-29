/*!
* Flocking - Creative audio synthesis for the Web!
* http://github.com/colinbdclark/flocking
*
* Flocking Interactive Demo Playground
*   Copyright 2012, Vitus (https://github.com/derDoc)
*   Copyright 2012, Colin Clark
*
* Dual licensed under the MIT and GPL Version 2 licenses.
*/

/*global window*/
/*jslint white: true, vars: true, plusplus: true, undef: true, newcap: true, regexp: true, browser: true, 
    forin: true, continue: true, nomen: true, bitwise: true, maxerr: 100, indent: 4 */

var demo = demo || {};

(function () {
    "use strict";
    
    var setupEditor = function (that, editorId, theme, mode) {
        theme = theme || "ace/theme/twilight";
        mode = mode || "ace/mode/javascript";
        
        var editor = ace.edit(editorId);
        editor.setTheme(theme);

        var JavaScriptMode = require(mode).Mode;
        editor.getSession().setMode(new JavaScriptMode());
    	
    	that.editor = editor;
    };
    
    var setupPlayButton = function (that) {
        // TODO: might be able to avoid eval()'ing if we load each demo's JavaScript source via Ajax and inject it as a script block.
        that.playButton.click(function (e) {
    		if (!flock.enviro.shared.isPlaying) {
    		    eval(that.editor.getSession().getValue());
                
    			that.playButton.html("Stop");
    			flock.enviro.shared.play();
    		} else {
    			that.playButton.html("Play");
    			flock.enviro.shared.reset();
    			if (timerId){ // TODO: Consider a non-global solution to starting/stopping timers for some demos.
    				window.clearInterval(timerId);
    				timerId = null;
    			}
    		}
        });
    };
    
    var setupLoadButton = function (that) {
        $(that.selectors.loadButton).click(function (e) {
            var id = $(that.selectors.demosMenu).val();
    		var code = $("#" + id).html();
    		that.editor.getSession().setValue(code);
    	});
    };

    demo.liveEditorView = function (editorId, selectors) {
        selectors = selectors || {
            playButton: "#play-button",
            loadButton: "#load-button",
            demosMenu: "#sample_code_sel"
        };
        
        var that = {
            editor: null,
            isPlaying: false,
            playButton: $(selectors.playButton),
            selectors: selectors
        };
        
        setupEditor(that, editorId);
        setupPlayButton(that);
        setupLoadButton(that);
        
        return that;
    };

}());
