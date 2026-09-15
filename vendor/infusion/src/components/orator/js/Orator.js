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

    /**********************************************
     * fluid.orator
     *
     * A component for self voicing a web page
     **********************************************/

    fluid.defaults("fluid.orator", {
        gradeNames: ["fluid.viewComponent"],
        selectors: {
            controller: ".flc-orator-controller",
            content: ".flc-orator-content"
        },
        model: {
            enabled: true,
            play: false
        },
        components: {
            tts: {
                type: "fluid.textToSpeech"
            },
            controller: {
                type: "fluid.orator.controller",
                options: {
                    parentContainer: "{orator}.container",
                    model: {
                        playing: "{orator}.model.play",
                        enabled: "{orator}.model.enabled"
                    }
                }
            },
            selectionReader: {
                type: "fluid.orator.selectionReader",
                container: "{that}.container",
                options: {
                    model: {
                        enabled: "{orator}.model.enabled"
                    }
                }
            },
            domReader: {
                type: "fluid.orator.domReader",
                container: "{that}.dom.content",
                options: {
                    model: {
                        tts: {
                            enabled: "{orator}.model.enabled"
                        }
                    },
                    listeners: {
                        "onStop.domReaderStop": {
                            changePath: "{orator}.model.play",
                            value: false,
                            source: "domReader.onStop",
                            priority: "after:removeHighlight"
                        }
                    },
                    modelListeners: {
                        "{orator}.model.play": {
                            funcName: "fluid.orator.handlePlayToggle",
                            args: ["{that}", "{change}.value"],
                            namespace: "domReader.handlePlayToggle"
                        }
                    }
                }
            }
        },
        modelListeners: {
            "enabled": {
                listener: "fluid.orator.cancelWhenDisabled",
                args: ["{tts}.cancel", "{change}.value"],
                namespace: "orator.clearSpeech"
            }
        },
        distributeOptions: [{
            source: "{that}.options.tts",
            target: "{that tts}.options",
            removeSource: true,
            namespace: "ttsOpts"
        }, {
            source: "{that}.options.controller",
            target: "{that controller}.options",
            removeSource: true,
            namespace: "controllerOpts"
        }, {
            source: "{that}.options.domReader",
            target: "{that domReader}.options",
            removeSource: true,
            namespace: "domReaderOpts"
        }, {
            source: "{that}.options.selectionReader",
            target: "{that selectionReader}.options",
            removeSource: true,
            namespace: "selectionReaderOpts"
        }]
    });

    // TODO: When https://issues.fluidproject.org/browse/FLUID-6393 has been addressed, it will be possible to remove
    //       this function and directly configure the modelListener to only trigger when a false value is passed.
    fluid.orator.cancelWhenDisabled = function (cancelFn, state) {
        if (!state) {
            cancelFn();
        }
    };

    fluid.orator.handlePlayToggle = function (that, state) {
        if (state) {
            that.play();
        } else {
            that.pause();
        }
    };

    /**********************************************
     * fluid.orator.controller
     *
     * Provides a UI Widget to control the Orator
     **********************************************/

    fluid.defaults("fluid.orator.controller", {
        gradeNames: ["fluid.containerRenderingView"],
        selectors: {
            playToggle: ".flc-orator-controller-playToggle"
        },
        styles: {
            play: "fl-orator-controller-play"
        },
        strings: {
            play: "play",
            pause: "pause"
        },
        model: {
            playing: false,
            enabled: true
        },
        injectionType: "prepend",
        markup: {
            container: "<div class=\"flc-orator-controller fl-orator-controller\">" +
                "<div class=\"fl-icon-orator\" aria-hidden=\"true\"></div>" +
                "<button type=\"button\" class=\"flc-orator-controller-playToggle\">" +
                    "<span class=\"fl-orator-controller-playToggle fl-icon-orator-playToggle\" aria-hidden=\"true\"></span>" +
                "</button></div>"
        },
        invokers: {
            play: {
                changePath: "playing",
                value: true,
                source: "play"
            },
            pause: {
                changePath: "playing",
                value: false,
                source: "pause"
            },
            toggle: {
                funcName: "fluid.orator.controller.toggleState",
                args: ["{that}", "{arguments}.0", "{arguments}.1"]
            }
        },
        listeners: {
            "onCreate.bindClick": {
                listener: "fluid.orator.controller.bindClick",
                args: ["{that}"]
            }
        },
        modelListeners: {
            "playing": {
                listener: "fluid.orator.controller.setToggleView",
                args: ["{that}", "{change}.value"]
            },
            "enabled": {
                "this": "{that}.container",
                method: "toggle",
                args: ["{change}.value"],
                namespace: "toggleView"
            }
        }
    });

    /**
     * Binds the click event for the "playToggle" element to trigger the `that.toggle` method.
     * This is not bound declaratively to ensure that the correct arguments are passed along to the `that.toggle`
     * method.
     *
     * @param {fluid.orator.controller} that - an instance of the component
     */
    fluid.orator.controller.bindClick = function (that) {
        that.locate("playToggle").on("click", function () {
            that.toggle("playing");
        });
    };

    /**
     * Used to toggle the state of a model value at a specified path. The new state will be the inverse of the current
     * boolean value at the specified model path, or can be set explicitly by passing in a `state` value. It's likely
     * that this method will be used in conjunction with a click handler. In that case, it's most likely that the state
     * will be toggling the existing model value.
     *
     * @param {fluid.orator.controller} that - an instance of the component
     * @param {String|Array} path - the path, into the model, for the value to toggle
     * @param {Boolean} state - (optional) explicit state to set the model value to
     */
    fluid.orator.controller.toggleState = function (that, path, state) {
        var newState = fluid.isValue(state) ? state : !fluid.get(that.model, path);
        // the !! ensures that the newState is a boolean value.
        that.applier.change(path, !!newState, "ADD", "toggleState");
    };

    /**
     * Sets the view state of the toggle controller.
     * True - play style added
     *      - aria-label set to the `pause` string
     * False - play style removed
     *       - aria-label set to the `play` string
     *
     * @param {fluid.orator.controller} that - an instance of the component
     * @param {Boolean} state - the state to set the controller to
     */
    fluid.orator.controller.setToggleView = function (that, state) {
        var playToggle = that.locate("playToggle");
        playToggle.toggleClass(that.options.styles.play, state);
        playToggle.attr({
            "aria-label": that.options.strings[state ? "pause" : "play"]
        });
    };


    /*******************************************************************************
     * fluid.orator.domReader
     *
     * Reads in text from a DOM element and voices it
     *******************************************************************************/

    fluid.defaults("fluid.orator.domReader", {
        gradeNames: ["fluid.viewComponent"],
        selectors: {
            highlight: ".flc-orator-highlight"
        },
        markup: {
            highlight: "<mark class=\"flc-orator-highlight fl-orator-highlight\"></mark>"
        },
        events: {
            onQueueSpeech: null,
            onReadFromDOM: null,
            utteranceOnEnd: null,
            utteranceOnBoundary: null,
            utteranceOnError: null,
            utteranceOnMark: null,
            utteranceOnPause: null,
            utteranceOnResume: null,
            utteranceOnStart: null,
            onStop: null,
            onError: null
        },
        utteranceEventMap: {
            onboundary: "utteranceOnBoundary",
            onend: "utteranceOnEnd",
            onerror: "utteranceOnError",
            onmark:"utteranceOnMark",
            onpause: "utteranceOnPause",
            onresume: "utteranceOnResume",
            onstart: "utteranceOnStart"
        },
        model: {
            tts: {
                paused: false,
                speaking: false,
                enabled: true
            },
            parseQueueIndex: 0,
            parseIndex: null,
            ttsBoundary: null,
            parseQueueCount: 0,
            parseItemCount: 0
        },
        modelRelay: [{
            target: "parseIndex",
            backward: "never",
            excludeSource: ["utteranceOnPause"],
            namespace: "getClosestIndex",
            singleTransform: {
                type: "fluid.transforms.free",
                func: "fluid.orator.domReader.getClosestIndex",
                args: ["{that}", "{that}.model.ttsBoundary", "{that}.model.parseQueueIndex"]
            }
        }],
        members: {
            parseQueue: []
        },
        components: {
            parser: {
                type: "fluid.textNodeParser",
                options: {
                    listeners: {
                        "onParsedTextNode.addToParseQueue": "{domReader}.addToParseQueue"
                    }
                }
            }
        },
        invokers: {
            parsedToString: "fluid.orator.domReader.parsedToString",
            readFromDOM: {
                funcName: "fluid.orator.domReader.readFromDOM",
                args: ["{that}", "{that}.container"]
            },
            removeHighlight: {
                funcName: "fluid.orator.domReader.unWrap",
                args: ["{that}.dom.highlight"]
            },
            addToParseQueue: {
                funcName: "fluid.orator.domReader.addToParseQueue",
                args: ["{that}", "{arguments}.0"]
            },
            resetParseQueue: {
                funcName: "fluid.orator.domReader.resetParseQueue",
                args: ["{that}"]
            },
            highlight: {
                funcName: "fluid.orator.domReader.highlight",
                args: ["{that}"]
            },
            play: {
                funcName: "fluid.orator.domReader.play",
                args: ["{that}", "{fluid.textToSpeech}.resume"]
            },
            pause: {
                funcName: "fluid.orator.domReader.pause",
                args: ["{that}", "{fluid.textToSpeech}.pause"]
            },
            queueSpeech: {
                funcName: "fluid.orator.domReader.queueSpeech",
                args: ["{that}", "{arguments}.0", "{arguments}.1"]
            },
            isWord: "fluid.textNodeParser.hasGlyph"
        },
        modelListeners: {
            "parseIndex": {
                listener: "{that}.highlight",
                namespace: "highlight",
                excludeSource: ["init", "utteranceOnEnd", "resetParseQueue"]
            }
        },
        listeners: {
            "onQueueSpeech.removeExtraWhiteSpace": "fluid.orator.domReader.removeExtraWhiteSpace",
            "onQueueSpeech.queueSpeech": {
                func: "{fluid.textToSpeech}.queueSpeech",
                args: ["{arguments}.0", "{arguments}.1.interrupt", "{arguments}.1"],
                priority: "after:removeExtraWhiteSpace"
            },
            "onError.stop": "{that}.events.onStop",
            "onStop.resetParseQueue": {
                listener: "{that}.resetParseQueue"
            },
            "onStop.removeHighlight": {
                listener: "{that}.removeHighlight",
                priority: "after:resetParseQueue"
            },
            "onStop.updateTTSModel": {
                changePath: "tts",
                value: {
                    speaking: false,
                    paused: false
                },
                source: "onStop"
            },
            "utteranceOnEnd.resetParseIndex": {
                changePath: "",
                value: {
                    parseIndex: null
                },
                source: "utteranceOnEnd"
            },
            "utteranceOnStart.updateTTSModel": {
                changePath: "tts",
                value: {
                    speaking: true,
                    paused: false
                },
                source: "utteranceOnStart"
            },
            "utteranceOnPause.updateTTSModel": {
                changePath: "tts",
                value: {
                    speaking: true,
                    paused: true
                },
                source: "utteranceOnPause"
            },
            // needed to prevent the parseQueueIndex from incrementing when the resume is called, instead of continuing on.
            "utteranceOnPause.resetBoundary": {
                changePath: "ttsBoundary",
                value: null,
                source: "utteranceOnPause"
            },
            "utteranceOnResume.updateTTSModel": {
                changePath: "tts",
                value: {
                    speaking: true,
                    paused: false
                },
                source: "utteranceOnResume"
            },
            "utteranceOnBoundary.setCurrentBoundary": {
                listener: "fluid.orator.domReader.setCurrentBoundary",
                args: ["{that}", "{arguments}.0.charIndex", "{arguments}.0.name"]
            }
        }
    });

    /**
     * Updates the `ttsBoundary` and `parseQueueIndex` model paths based on the provided boundary. Attempts to determine
     * if the supplied boundary is derived from the current queue or if the parseQueueIndex needs to be incremented.
     *
     * @param  {fluid.orator.domReader} that - an instance of the component
     * @param  {Integer} boundary - the incoming boundary, typically from a {SpeechSynthesisUtterance} boundary event.
     *                              This indicates the starting index of the word being Synthesized.
     * @param  {String} boundaryType - Boundary events can fire at the beginning of a "word" or "sentence". This is used
     *                                 to indicate which one it is related to. From the {SpeechSynthesisUtterance}
     *                                 boundary event this is found in the `name` property. Currently only `"word"`
     *                                 boundary events are supported. All others will be ignored.
     */
    fluid.orator.domReader.setCurrentBoundary = function (that, boundary, boundaryType) {
        // It is possible that the pause event triggers before all of the boundary events have been received.
        // The following check prevents boundary events from updating the model if TTS is paused.
        // Also we currently only support "word" boundary events. Some synthesizers also fire boundary events
        // In those cases, we will get two boundary events for the beginning which will confuse the parseQueueIndex
        // incrementing algorithm. At the moment we ignore any non-word boundary events. In the future we may also
        // accept sentence boundary events for potentially highlighting sentences as well.
        if (that.model.tts.paused || boundaryType !== "word") {
            return;
        }

        var currentBoundary = fluid.isValue(that.model.ttsBoundary) ? that.model.ttsBoundary : -1;
        var parseQueueIndex;

        if (currentBoundary < boundary) {
            parseQueueIndex = that.model.parseQueueIndex;
        } else {
            parseQueueIndex = that.model.parseQueueIndex + 1;
        }

        that.applier.change("", {
            "ttsBoundary": boundary,
            "parseQueueIndex": parseQueueIndex
        }, "ADD", "setCurrentBoundary");
    };

    fluid.orator.domReader.play = function (that, resumeFn) {
        if (that.model.tts.enabled) {
            if (that.model.tts.paused) {
                resumeFn();
            } else if (!that.model.tts.speaking) {
                that.readFromDOM();
            }
        }
    };

    fluid.orator.domReader.pause = function (that, pauseFn) {
        if (that.model.tts.speaking && !that.model.tts.paused) {
            pauseFn();
        }
    };

    fluid.orator.domReader.mapUtteranceEvents = function (that, utterance, utteranceEventMap) {
        fluid.each(utteranceEventMap, function (compEventName, utteranceEvent) {
            var compEvent = that.events[compEventName];
            utterance[utteranceEvent] = compEvent.fire;
        });
    };

    fluid.orator.domReader.removeExtraWhiteSpace = function (text) {
        var promise = fluid.promise();
        // force a string value
        var str = text.toString();
        // trim whitespace
        str = str.trim();

        if (str) {
            promise.resolve(str);
        } else {
            promise.reject("The text is empty");
        }

        return promise;
    };

    /**
     * Operates the core "transforming promise workflow" for queuing an utterance. The initial listener is provided the
     * initial text; which then proceeds through the transform chain to arrive at the final text.
     * To change the speech function (e.g for testing) the `onQueueSpeech.queueSpeech` listener can be overridden.
     *
     * @param {fluid.orator.domReader} that - an instance of the component
     * @param {String} text - The text to be synthesized
     * @param {Object} options - (optional) options to configure the utterance with. This will also be interpolated with
     *                           the event mappings. See: `fluid.textToSpeech.queueSpeech` in TextToSpeech.js for an
     *                           example of utterance options for that speech function.
     *
     * @return {Promise} - A promise for the final resolved text
     */
    fluid.orator.domReader.queueSpeech = function (that, text, options) {
        options = options || {};
        // map events
        fluid.orator.domReader.mapUtteranceEvents(that, options, that.options.utteranceEventMap);

        return fluid.promise.fireTransformEvent(that.events.onQueueSpeech, text, options);
    };

    /**
     * Unwraps the contents of the element by removing the tag surrounding the content and placing the content
     * as a node within the element's parent. The parent is also normalized to combine any adjacent text nodes.
     *
     * @param {String|jQuery|DomElement} elm - element to unwrap
     */
    fluid.orator.domReader.unWrap = function (elm) {
        elm = $(elm);

        if (elm.length) {
            var parent = elm.parent();
            // Remove the element, but place its contents within the parent.
            elm.contents().unwrap();
            // Normalize the parent to cleanup text nodes
            parent[0].normalize();
        }
    };

    /**
     * Positional information about a word parsed from the text in a {DomElement}. This can be used for mappings between
     * a synthesizer's speech boundary and the word's location within the DOM.
     *
     * @typedef {Object} DomWordMap
     * @property {Integer} blockIndex - The index into the entire block of text being parsed from the DOM
     * @property {Integer} startOffset - The start offset of the current `word` relative to the closest
     *                                   enclosing DOM element
     * @property {Integer} endOffset - The end offset of the current `word` relative to the closest
     *                                 enclosing DOM element
     * @property {DomNode} node - The current child node being parsed
     * @property {Integer} childIndex - The index of the child node being parsed relative to its parent
     * @property {DomElement} parentNode - The parent DOM node
     * @property {String} word - The text, `word`, parsed from the node. It may contain only whitespace.
     */

    /**
     * Retrieves the active parseQueue array to be used when updating from the latest parsed text node. Will increment
     * the parseQueue with a new empty array if one doesn't already exist or if the language has changed.
     *
     * @param {fluid.orator.domReader} that - an instance of the component
     * @param {String} lang - a valid BCP 47 language code.
     *
     * @return {Array} - the parseQueue array to update with the latest parsed text node.
     */
    fluid.orator.domReader.retrieveActiveQueue = function (that, lang) {
        var lastQueue = that.parseQueue[that.parseQueue.length - 1];

        if (!lastQueue ||  (lastQueue.length && lastQueue[0].lang !== lang)) {
            lastQueue = [];
            that.parseQueue.push(lastQueue);
            that.applier.change("parseQueueCount", that.parseQueue.length, "ADD", "retrieveActiveQueue");
        }

        return lastQueue;
    };

    /**
     * Takes in a text node and separates the contained words into {DomWordMaps} that are added to the `parseQueue`.
     * Typically this handles parsed data passed along by a Parser's (`fluid.textNodeParser`) `onParsedTextNode` event.
     * Empty nodes are skipped and the subsequent text is analyzed to determine if it should be appended to the
     * previous {DomWordMap} in the parseQueue. For example: when the syllabification separator tag is inserted
     * between words.
     *
     * @param {fluid.orator.domReader} that - an instance of the component
     * @param {TextNodeData} textNodeData - the parsed information of text node. Typically from `fluid.textNodeParser`
     */
    fluid.orator.domReader.addToParseQueue = function (that, textNodeData) {
        var activeQueue = fluid.orator.domReader.retrieveActiveQueue(that, textNodeData.lang);
        var lastParsed = activeQueue[activeQueue.length - 1] || {};

        var words = textNodeData.node.textContent.split(/(\s+)/); // split on whitespace, and capture whitespace

        var parsed = $.extend({}, textNodeData, {
            blockIndex: (lastParsed.blockIndex || 0) + (fluid.get(lastParsed, ["word", "length"]) || 0),
            startOffset: 0,
            parentNode: textNodeData.node.parentNode
        });

        fluid.each(words, function (word) {
            var lastIsWord = that.isWord(lastParsed.word);
            var currentIsWord = that.isWord(word);

            // If the last parsed item is a word and the current item is a word, combine into the the last parsed block.
            // Otherwise, if the new item is a word or non-empty string create a new parsed block.
            if (lastIsWord && currentIsWord) {
                lastParsed.word += word;
                lastParsed.endOffset += word.length;
                parsed.blockIndex += word.length;
                parsed.startOffset += word.length;
            } else {
                parsed.word = word;
                parsed.endOffset = parsed.startOffset + word.length;
                if (currentIsWord || word && lastIsWord) {
                    lastParsed = fluid.copy(parsed);
                    activeQueue.push(lastParsed);
                    that.applier.change("parseItemCount", that.model.parseItemCount + 1, "ADD", "addToParseQueue");
                    parsed.blockIndex += word.length;
                }
                parsed.startOffset = parsed.endOffset;
            }
        });
    };

    /**
     * Reset the parseQueue and related model values
     *
     * @param {fluid.orator.domReader} that - an instance of the component
     */
    fluid.orator.domReader.resetParseQueue = function (that) {
        that.parseQueue = [];
        that.applier.change("", {
            parseQueueIndex: 0,
            parseIndex: null,
            ttsBoundary: null,
            parseQueueCount: 0,
            parseItemCount: 0
        }, "ADD", "resetParseQueue");
    };

    /**
     * Combines the parsed text into a String.
     *
     * @param {DomWordMap[]} parsed - An array of {DomWordMap} objects containing the position mappings from a parsed
     *                                {DomElement}.
     *
     * @return {String} - The parsed text combined into a String.
     */
    fluid.orator.domReader.parsedToString = function (parsed) {
        var words = fluid.transform(parsed, function (block) {
            return block.word;
        });

        return words.join("");
    };

    /**
     * Parses the DOM element into data points to use for highlighting the text, and queues the text into the self
     * voicing engine. The parsed data points are added to the component's `parseQueue`. Once all of the text has been
     * synthesized, the `onStop` event is fired.
     *
     * @param {fluid.orator.domReader} that - an instance of the component
     * @param {String|jQuery|DomElement} elm - The DOM node to read
     */
    fluid.orator.domReader.readFromDOM = function (that, elm) {
        elm = $(elm);

        // only execute if there are nodes to read from
        if (elm.length) {
            that.resetParseQueue();
            that.parser.parse(elm[0]);

            var queueSpeechPromises = fluid.transform(that.parseQueue, function (parsedBlock, index) {
                var interrupt = !index; // only interrupt on the first string
                var text = that.parsedToString(parsedBlock);
                return that.queueSpeech(text, {lang: parsedBlock[0].lang, interrupt: interrupt});
            });

            fluid.promise.sequence(queueSpeechPromises).then(that.events.onStop.fire, that.events.onError.fire);
        }
    };

    /**
     * Returns the index of the closest data point from the parseQueue based on the boundary provided.
     *
     * @param {fluid.orator.domReader} that - an instance of the component
     * @param {Integer} boundary - The boundary value used to compare against the blockIndex of the parsed data points.
     *                             If the boundary is undefined or out of bounds, `undefined` will be returned.
     * @param {Integer} parseQueueIndex - The index of into the parseQueue to determine which queue to use for
     *                                    calculating the boundary positions against.
     *
     * @return {Integer|undefined} - Will return the index of the closest data point in the parseQueue. If the boundary
     *                               cannot be located within the parseQueue, `undefined` is returned.
     */
    fluid.orator.domReader.getClosestIndex = function (that, boundary, parseQueueIndex) {
        var parseQueue = that.parseQueue[parseQueueIndex];

        if (!fluid.get(parseQueue, "length") || !fluid.isValue(boundary)) {
            return undefined;
        };

        var maxIndex = Math.max(parseQueue.length - 1, 0);
        var index = Math.max(Math.min(that.model.parseIndex || 0, maxIndex), 0);
        var maxBoundary = parseQueue[maxIndex].blockIndex + parseQueue[maxIndex].word.length;

        if (boundary > maxBoundary || boundary < 0) {
            return undefined;
        }

        while (index >= 0) {
            var nextIndex = index + 1;
            var prevIndex = index - 1;
            var currentBlockIndex = parseQueue[index].blockIndex;
            var nextBlockIndex = index < maxIndex ? parseQueue[nextIndex].blockIndex : (maxBoundary + 1);

            // Break if the boundary lies within the current block
            if (boundary >= currentBlockIndex && boundary < nextBlockIndex) {
                break;
            }

            if (currentBlockIndex > boundary) {
                index = prevIndex;
            } else {
                index = nextIndex;
            }
        }

        return index;

    };

    /**
     * Searches down, starting from the provided node, returning the first text node found.
     *
     * @param  {DomNode} node - the DOM Node to start searching from.
     * @return {DomNode|undefined} - Returns the first text node found, or `undefined` if none located.
     */
    fluid.orator.domReader.findTextNode = function (node) {
        if (!node) {
            return;
        }

        if (node.nodeType === Node.TEXT_NODE) {
            return node;
        }

        var children = node.childNodes;
        for (var i = 0; i < children.length; i++) {
            var textNode = fluid.orator.domReader.findTextNode(children[i]);
            if (textNode !== undefined) {
                return textNode;
            }
        }
    };

    fluid.orator.domReader.getTextNodeFromSibling = function (node) {
        while (node.nextSibling) {
            node = node.nextSibling;
            var textNode = fluid.orator.domReader.findTextNode(node);
            if (textNode) {
                return textNode;
            }
        }
    };

    fluid.orator.domReader.getNextTextNode = function (node) {
        var nextTextNode = fluid.orator.domReader.getTextNodeFromSibling(node);

        if (nextTextNode) {
            return nextTextNode;
        }

        var parent = node.parentNode;

        if (parent) {
            return fluid.orator.domReader.getNextTextNode(parent);
        }
    };

    fluid.orator.domReader.setRangeEnd = function (range, node, end) {
        var ranges = fluid.makeArray(range);
        if (end <= node.length) {
            range.setEnd(node, end);
        } else {
            var nextRange = document.createRange();
            var nextTextNode = fluid.orator.domReader.getNextTextNode(node);
            nextRange.selectNode(nextTextNode);
            nextRange.setStart(nextTextNode, 0);
            ranges = ranges.concat(fluid.orator.domReader.setRangeEnd(nextRange, nextTextNode, end - node.length));
        }
        return ranges;
    };

    /**
     * Highlights text from the `parseQueue`. Highlights are performed by wrapping the appropriate text in the markup
     * specified at `that.options.markup.highlight`.
     *
     * @param {fluid.orator.domReader} that - an instance of the component
     */
    fluid.orator.domReader.highlight = function (that) {
        that.removeHighlight();

        if (that.model.parseQueueCount && fluid.isValue(that.model.parseIndex)) {
            var data = that.parseQueue[that.model.parseQueueIndex][that.model.parseIndex];
            var rangeNode = data.parentNode.childNodes[data.childIndex];

            var startRange = document.createRange();
            startRange.selectNode(rangeNode);
            startRange.setStart(rangeNode, data.startOffset);
            var ranges = fluid.orator.domReader.setRangeEnd (startRange, rangeNode, data.endOffset);
            fluid.each(ranges, function (range) {
                range.surroundContents($(that.options.markup.highlight)[0]);
                range.detach(); // removes the range
            });
        }
    };

    /*******************************************************************************
     * fluid.orator.selectionReader
     *
     * Reads in text from a selection and voices it
     *******************************************************************************/

    fluid.defaults("fluid.orator.selectionReader", {
        gradeNames: ["fluid.viewComponent"],
        selectors: {
            control: ".flc-orator-selectionReader-control",
            controlLabel: ".flc-orator-selectionReader-controlLabel"
        },
        strings: {
            play: "play",
            stop: "stop"
        },
        styles: {
            above: "fl-orator-selectionReader-above",
            below: "fl-orator-selectionReader-below",
            control: "fl-orator-selectionReader-control"
        },
        markup: {
            control: "<button type=\"button\" class=\"flc-orator-selectionReader-control\"><span class=\"fl-icon-orator\"></span><span class=\"flc-orator-selectionReader-controlLabel\"></span></button>"
        },
        model: {
            enabled: true,
            play: false,
            text: ""
        },
        events: {
            onError: null,
            onSelectionChanged: null,
            onStop: null,
            onToggleControl: null
        },
        components: {
            parser: {
                type: "fluid.textNodeParser"
            }
        },
        listeners: {
            "onCreate.bindEvents": {
                funcName: "fluid.orator.selectionReader.bindSelectionEvents",
                args: ["{that}"]
            },
            "onSelectionChanged.updateSelection": "{that}.setTextFromSelection",
            "onStop.stop": {
                changePath: "play",
                value: false,
                source: "stopMethod"
            },
            "onError.stop": {
                changePath: "play",
                value: false,
                source: "onError"
            },
            "onToggleControl.togglePlay": "{that}.toggle"
        },
        modelListeners: {
            "text": [{
                func: "{that}.stop",
                namespace: "stopPlayingWhenTextChanges"
            }, {
                funcName: "fluid.orator.selectionReader.renderControl",
                args: ["{that}", "{change}.value"],
                namespace: "render"
            }],
            "play": [{
                func: "fluid.orator.selectionReader.queueSpeech",
                args: ["{that}", "{change}.value", "{fluid.textToSpeech}.queueSpeechSequence"],
                namespace: "queueSpeech"
            }, {
                func: "fluid.orator.selectionReader.renderControlState",
                args: ["{that}", "{that}.control", "{arguments}.0"],
                excludeSource: ["init"],
                namespace: "renderControlState"
            }],
            "enabled": {
                funcName: "fluid.orator.selectionReader.updateText",
                args: ["{that}", "{change}.value"],
                namespace: "updateText"
            }
        },
        invokers: {
            setTextFromSelection: {
                funcName: "fluid.orator.selectionReader.setTextFromSelection",
                args: ["{that}", "{that}.selectionFilter"]
            },
            play: {
                changePath: "play",
                value: true,
                source: "playMethod"
            },
            stop: {
                funcName: "fluid.orator.selectionReader.stopSpeech",
                args: ["{that}.model.play", "{fluid.textToSpeech}.cancel"]
            },
            toggle: {
                funcName: "fluid.orator.selectionReader.togglePlay",
                args: ["{that}", "{arguments}.0"]
            },
            selectionFilter: "fluid.textNodeParser.hasGlyph"
        }
    });

    // TODO: When https://issues.fluidproject.org/browse/FLUID-6393 has been addressed, it will be possible to remove
    //       this function and directly configure the modelListener to only trigger when a false value is passed.
    fluid.orator.selectionReader.stopSpeech = function (state, cancelFn) {
        if (state) {
            cancelFn();
        }
    };

    fluid.orator.selectionReader.queueSpeech = function (that, state, speechFn) {
        if (state && that.model.enabled && that.model.text) {
            var parsed = fluid.orator.selectionReader.parseRange(that.selection.getRangeAt(0), that.parser.parse);
            var speechPromise = speechFn(parsed, true);

            speechPromise.then(that.events.onStop.fire, that.events.onError.fire);
        }
    };

    fluid.orator.selectionReader.bindSelectionEvents = function (that) {
        $(document).on("selectionchange", function (e) {
            if (that.model.enabled) {
                that.events.onSelectionChanged.fire(e);
            }
        });
    };

    fluid.orator.selectionReader.updateText = function (that, state) {
        if (state) {
            that.setTextFromSelection();
        } else {
            that.applier.change("text", "", "ADD", "updateText");
        }
    };

    /**
     * Retrieves the text from the current selection. If a filter is provided and the string does not pass the filter
     * check, an empty string `""` is used as the selection.
     *
     * @param {fluid.orator.selectionReader} that - an instance of the component
     * @param {Function} [filter] - (optional) a function that takes the selection string as an input and returns `true`
     *                              if it should be accepted and `false` if rejected. If the filter rejects, an empty
     *                              string `""` is used as the selection.
     */
    fluid.orator.selectionReader.setTextFromSelection = function (that, filter) {
        that.selection = window.getSelection();
        var selectedText = that.selection.toString();
        selectedText = !filter || filter(selectedText) ? selectedText : "";
        that.applier.change("text", selectedText, "ADD", "setTextFromSelection");
    };

    /**
     * Parses a selection into a {Speech[]}. If the selection includes multiple text nodes, the supplied domParser is
     * used to do an initial parsing into a {TextNodeData[]}.
     *
     * @param  {Range} range - a Range object representing a selection.
     * @param  {Function} domParser - a parser function to parse Dom Elements into a {TextNodeData[]}
     *
     * @return {Speech[]} - an array of {Speech} objects for configuring SpeechSynthesis Utterances with.
     */
    fluid.orator.selectionReader.parseRange = function (range, domParser) {
        // Handles the case where all of the selection is in a single text node. Don't need to parse in this case.
        if (range.commonAncestorContainer.nodeType === Node.TEXT_NODE) {
            return [{
                text: range.commonAncestorContainer.textContent.slice(range.startOffset, range.endOffset),
                options: {
                    lang: $(range.commonAncestorContainer.parentNode).closest("[lang]").attr("lang")
                }
            }];
        }

        // Handles the case were range.selectNode was called to create the selection
        if (range.commonAncestorContainer === range.startContainer) {
            return fluid.orator.selectionReader.parseElement(range.commonAncestorContainer.childNodes[range.startOffset], domParser);
        }

        return fluid.orator.selectionReader.parseElement(range.commonAncestorContainer, domParser, range);
    };

    /**
     * The options for parsing an element into {Speech[]}. It has similar properties to a {Range} and is typically used
     * for `fluid.orator.selectionReader.parseElement`.
     * @type {Object} ParseElementOpts
     * @property {Integer} startOffset - the starting offset of the first text node. Text before will be omitted
     * @property {Integer} endOffset - the end offset of the last text node. Text after will be omitted.
     * @property {DomNode} startContainer - the text node to start parsing from.
     * @property {DomNode} endContainer - the text node to stop parsing at.
     */

    /**
     * Parses an element into a {Speech[]}. The supplied domParser is used to do an initial parsing of the element into
     * a {TextNodeData[]}.
     *
     * @param  {DomElement} element - The DOM Element to parse
     * @param  {Function} domParser - a parser function to parse Dom Elements into a {TextNodeData[]}
     * @param  {ParseElementOpts} options - (Optional) parsing configuration
     * @return {Speech[]} - an array of {Speech} objects for configuring SpeechSynthesis Utterances with.
     */
    fluid.orator.selectionReader.parseElement = function (element, domParser, options) {
        options = options || {};
        var parsed = [];

        var fromParser = domParser(element);
        var parsedNodes = fluid.getMembers(fromParser, "node");
        var startIndex  = options.startContainer ? parsedNodes.indexOf(options.startContainer) : 0;
        var endIndex = options.endContainer ? parsedNodes.indexOf(options.endContainer) : parsedNodes.length - 1;

        if (startIndex >= 0 && endIndex >= 0) {
            for (var i = startIndex; i <= endIndex; i++) {
                var startOffset = i === startIndex ? options.startOffset : 0;
                var endOffset = i === endIndex ? options.endOffset : undefined;
                var node = fromParser[i].node;
                var lang = fromParser[i].lang;
                var lastParsed = parsed[parsed.length - 1];

                if (parsed.length && lastParsed.options.lang === lang) {
                    lastParsed.text += node.textContent.slice(startOffset, endOffset);
                } else {
                    parsed.push({
                        text: node.textContent.slice(startOffset, endOffset),
                        options: {
                            lang: lang
                        }
                    });
                }
            }
        }

        return parsed;
    };

    /**
     * Coordinates for an element, includes both viewPort and Document coordinates.
     *
     * @typedef {Object} ElementPosition
     * @property {Object} viewPort - the coordinates relative to the viewPort
     * @property {Float} viewPort.top - The `top` pixel coordinate relative to the top edge of the viewPort
     * @property {Float} viewPort.left - The `left` pixel coordinate relative to the left edge of the viewPort
     * @property {Object} offset - the coordinates relative to the offset parent (closest positioned ancestor)
     * @property {Float} offset.top - The `top` pixel coordinate relative to the offset parent
     * @property {Float} offset.left - The `left` pixel coordinate relative to the offset parent
     */

    /**
     * Returns a position object containing coordinates of the provided range. These can be used to position other
     * elements in relation to it.
     *
     * @param {Range} range - A Range object for which to calculate the position of.
     *
     * @return {ElementPosition} - An object containing the coordinates of the provided `range`.
     */
    fluid.orator.selectionReader.calculatePosition = function (range) {
        // use getClientRects()[0] instead of getBoundingClientRect() because in cases where more than one rect
        // is returned we only want the first one, not the aggregation of all of them.
        var rangeRect = range.getClientRects()[0];
        var rangeParent = range.startContainer.parentNode;
        var rangeParentRect = rangeParent.getClientRects()[0];
        var offsetParent = rangeParent.offsetParent;
        var bodyBorderAdjustment = {
            top: 0,
            left: 0
        };

        // If the offset parent is the `body` element and it is positioned, if there is a border set
        // on the `body` it may affect the offset value returned. In some browsers the outer edge of the
        // border is used to calculate the offset, in others it is the inner edge. The algorithm below can calculate
        // a needed adjustment value by comparing the offsetParent's offset and client values. In the case where the
        // Outer edge of the border is used, the offset is 0. In cases where the inner edge is used, the offset is a
        // negative value. The difference in the absolute value of the offset and the client values, is the amount
        // that the positioning needs to be adjusted for.
        if (offsetParent && offsetParent.tagName.toLowerCase() === "body") {
            bodyBorderAdjustment.top = Math.abs(offsetParent.offsetTop) - offsetParent.clientTop;
            bodyBorderAdjustment.left = Math.abs(offsetParent.offsetLeft) - offsetParent.clientLeft;
        }

        return {
            viewPort: {
                top: rangeRect.top,
                bottom: rangeRect.bottom,
                left: rangeRect.left
            },
            offset: {
                top: rangeParent.offsetTop + rangeRect.top - rangeParentRect.top + bodyBorderAdjustment.top,
                bottom: rangeParent.offsetTop + rangeRect.bottom - rangeParentRect.top + bodyBorderAdjustment.top,
                left: rangeParent.offsetLeft + rangeRect.left - rangeParentRect.left + bodyBorderAdjustment.left
            }
        };
    };

    fluid.orator.selectionReader.renderControlState = function (that, control) {
        var text = that.options.strings[that.model.play ? "stop" : "play"];
        control.find(that.options.selectors.controlLabel).text(text);
    };

    fluid.orator.selectionReader.adjustForHorizontalCollision = function (control, position, viewPortWidth) {
        viewPortWidth = viewPortWidth || document.body.clientWidth;
        var controlMidPoint = parseFloat(control.css("width")) / 2;
        // check for collision on left side
        if (controlMidPoint > position.viewPort.left) {
            control.css("left", position.offset.left + controlMidPoint - position.viewPort.left);
        // check for collision on right side
        } else if (controlMidPoint + position.viewPort.left > viewPortWidth) {
            control.css("left", position.offset.left - viewPortWidth + position.viewPort.left);
        }
    };

    fluid.orator.selectionReader.adjustForVerticalCollision = function (control, position, belowStyle, aboveStyle) {
        var controlHeight = parseFloat(control.css("height"));
        if (controlHeight > position.viewPort.top) {
            control.css("top", position.offset.bottom);
            control.removeClass(aboveStyle);
            control.addClass(belowStyle);
        } else {
            control.removeClass(belowStyle);
            control.addClass(aboveStyle);
        }
    };

    fluid.orator.selectionReader.createControl = function (that) {
        var control = $(that.options.markup.control);
        control.addClass(that.options.styles.control);
        control.on("click", function () {
            // wrapped in an empty function so as not to pass along the jQuery event object
            that.events.onToggleControl.fire();
        });
        return control;
    };

    fluid.orator.selectionReader.renderControl = function (that, state) {
        if (state) {
            var selectionRange = window.getSelection().getRangeAt(0);
            var controlContainer = selectionRange.startContainer.parentNode.offsetParent || selectionRange.startContainer.parentNode;
            var position = fluid.orator.selectionReader.calculatePosition(selectionRange);

            that.control = that.control || fluid.orator.selectionReader.createControl(that);

            // set the intial position
            that.control.css({
                top:  position.offset.top,
                left: position.offset.left
            });

            fluid.orator.selectionReader.renderControlState(that, that.control);
            that.control.appendTo(controlContainer);

            // check if there is space to display above, if not move to below selection
            fluid.orator.selectionReader.adjustForVerticalCollision(
                that.control,
                position,
                that.options.styles.below,
                that.options.styles.above
            );

            // adjust horizontal position for collisions with the viewport edge.
            fluid.orator.selectionReader.adjustForHorizontalCollision(that.control, position);

            // cleanup range
            selectionRange.detach();

        } else {
            if (that.control) {
                that.control.detach();
            }
        }
    };

    fluid.orator.selectionReader.togglePlay = function (that, state) {
        var newState = state || !that.model.play;
        that[newState ? "play" : "stop"]();
    };

})(jQuery, fluid_3_0_0);
