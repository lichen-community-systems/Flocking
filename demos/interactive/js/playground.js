/*
 * Flocking Interactive Demo Playground
 *   Copyright 2012, Vitus Lorenz-Meyer (https://github.com/derDoc)
 *   Copyright 2013-2014, Colin Clark
 *
 * Dual licensed under the MIT and GPL Version 2 licenses.
 */

/*global require, CodeMirror, window*/

var fluid = fluid || require("infusion"),
    flock = fluid.registerNamespace("flock");

(function () {
    "use strict";

    var $ = fluid.registerNamespace("jQuery"),
        demo = fluid.registerNamespace("demo");

    flock.init();

    // TODO: Infuse.

    var setupEditor = function (that, container, theme) {
        theme = theme || "flockingcm";
        container = typeof (container) === "string" ? document.querySelector(container) : container;

        that.editor = CodeMirror(container, { // jshint ignore:line
            mode: {
                name: "javascript",
                json: true
            },
            autoCloseBrackets: true,
            matchBrackets: true,
            smartIndent: true,
            theme: theme,
            indentUnit: 4,
            tabSize: 4,
            lineNumbers: true
        });
    };

    var setupPlayButton = function (that) {
        // TODO: might be able to avoid eval()'ing if we load each demo's JavaScript source via Ajax and inject it as a script block.
        that.playButton.click(function () {
            if (!flock.enviro.shared.model.isPlaying) {
                eval(that.editor.getDoc().getValue()); // jshint ignore:line

                that.playButton.html("Pause");
                that.playButton.removeClass("paused");
                that.playButton.addClass("playing");
                flock.enviro.shared.play();
            } else {
                that.playButton.html("Play");
                that.playButton.removeClass("playing");
                that.playButton.addClass("paused");
                flock.enviro.shared.reset();
            }
        });
    };

    var setupLoadControls = function (that) {
        $(that.selectors.loadButton).click(that.loadSelectedDemo);

        // Automatically load the demo whenever the demo menu changes.
        $(that.selectors.demosMenu).change(that.loadSelectedDemo);
    };

    demo.liveEditorView = function (editorId, selectors) {
        selectors = selectors || {
            playButton: ".playButton",
            loadButton: "#load-button",
            demosMenu: "#sample_code_sel"
        };

        var that = {
            editor: null,
            isPlaying: false,
            playButton: $(selectors.playButton),
            selectors: selectors
        };

        that.loadDemoFromURLHash = function () {
            var id = window.location.hash;
            if (!id) {
                that.loadSelectedDemo();
                return;
            }

            id = id.slice(1);
            that.loadDemo(id);
            $(that.selectors.demosMenu).val(id);
        };

        that.loadSelectedDemo = function () {
            var id = $(that.selectors.demosMenu).val();
            that.updateURLHash(id);
            that.loadDemo(id);
        };

        that.loadDemo = function (id) {
            var code = $("#" + id).html();
            that.editor.getDoc().setValue(code);

            if (flock.enviro.shared.model.isPlaying) {
                that.playButton.click(); // Stop the previous demo if it is playing.
            }
        };

        that.updateURLHash = function (id) {
            window.location.hash = "#" + id;
        };

        setupEditor(that, editorId);
        setupPlayButton(that);
        setupLoadControls(that);
        $(document).ready(that.loadDemoFromURLHash);

        return that;
    };

}());
