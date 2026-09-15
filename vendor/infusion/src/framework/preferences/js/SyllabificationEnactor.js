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

    /*******************************************************************************
     * syllabification
     *
     * An enactor that is capable of breaking words down into syllables
     *******************************************************************************/

    /*
     * `fluid.prefs.enactor.syllabification` makes use of the "hypher" library to split up words into their phonetic
     * parts. Because different localizations may have different means of splitting up words, pattern files for the
     * supported languages are used. The language patterns are pulled in dynamically based on the language codes
     * encountered in the content. The language patterns available are configured through the patterns option,
     * populated by the `fluid.prefs.enactor.syllabification.patterns` grade.
     */
    fluid.defaults("fluid.prefs.enactor.syllabification", {
        gradeNames: ["fluid.prefs.enactor", "fluid.prefs.enactor.syllabification.patterns", "fluid.viewComponent"],
        preferenceMap: {
            "fluid.prefs.syllabification": {
                "model.enabled": "value"
            }
        },
        selectors: {
            separator: ".flc-syllabification-separator",
            softHyphenPlaceholder: ".flc-syllabification-softHyphenPlaceholder"
        },
        strings: {
            languageUnavailable: "Syllabification not available for %lang",
            patternLoadError: "The pattern file %src could not be loaded. %errorMsg"
        },
        markup: {
            separator: "<span class=\"flc-syllabification-separator fl-syllabification-separator\"></span>",
            softHyphenPlaceholder: "<span class=\"flc-syllabification-softHyphenPlaceholder fl-syllabification-softHyphenPlaceholder\"></span>"
        },
        model: {
            enabled: false
        },
        events: {
            afterParse: null,
            afterSyllabification: null,
            onParsedTextNode: null,
            onNodeAdded: null,
            onError: null
        },
        listeners: {
            "afterParse.waitForHyphenators": {
                listener: "fluid.prefs.enactor.syllabification.waitForHyphenators",
                args: ["{that}"]
            },
            "onParsedTextNode.syllabify": {
                listener: "{that}.apply",
                args: ["{arguments}.0.node", "{arguments}.0.lang"]
            },
            "onNodeAdded.syllabify": {
                listener: "{that}.parse",
                args: ["{arguments}.0", "{that}.model.enabled"]
            }
        },
        components: {
            parser: {
                type: "fluid.textNodeParser",
                options: {
                    listeners: {
                        "afterParse.boil": "{syllabification}.events.afterParse",
                        "onParsedTextNode.boil": "{syllabification}.events.onParsedTextNode"
                    },
                    invokers: {
                        hasTextToRead: {
                            // apply to text nodes even if they have the ariaHidden attribute set
                            funcName: "fluid.textNodeParser.hasTextToRead",
                            args: ["{arguments}.0", true]
                        }
                    }
                }
            },
            observer: {
                type: "fluid.mutationObserver",
                container: "{that}.container",
                options: {
                    defaultObserveConfig: {
                        attributes: false
                    },
                    modelListeners: {
                        "{syllabification}.model.enabled": {
                            funcName: "fluid.prefs.enactor.syllabification.disconnectObserver",
                            priority: "before:setPresentation",
                            args: ["{that}", "{change}.value"],
                            namespace: "disconnectObserver"
                        }
                    },
                    listeners: {
                        "onNodeAdded.boil": "{syllabification}.events.onNodeAdded",
                        "{syllabification}.events.afterSyllabification": {
                            listener: "{that}.observe",
                            namespace: "enableObserver"
                        }
                    }
                }
            }
        },
        members: {
            // `hyphenators` is a mapping of strings, representing the source paths of pattern files, to Promises
            // linked to the resolutions of loading and initially applying those syllabification patterns.
            hyphenators: {}
        },
        modelListeners: {
            "enabled": {
                listener: "{that}.setPresentation",
                args: ["{that}.container", "{change}.value"],
                namespace: "setPresentation"
            }
        },
        invokers: {
            apply: {
                funcName: "fluid.prefs.enactor.syllabification.syllabify",
                args: ["{that}", "{arguments}.0", "{arguments}.1"]
            },
            remove: {
                funcName: "fluid.prefs.enactor.syllabification.removeSyllabification",
                args: ["{that}"]
            },
            setPresentation: {
                funcName: "fluid.prefs.enactor.syllabification.setPresentation",
                args: ["{that}", "{arguments}.0", "{arguments}.1"]
            },
            parse: {
                funcName: "fluid.prefs.enactor.syllabification.parse",
                args: ["{that}", "{arguments}.0"]
            },
            createHyphenator: {
                funcName: "fluid.prefs.enactor.syllabification.createHyphenator",
                args: ["{that}", "{arguments}.0", "{arguments}.1"]
            },
            getHyphenator: {
                funcName: "fluid.prefs.enactor.syllabification.getHyphenator",
                args: ["{that}", "{arguments}.0"]
            },
            getPattern: "fluid.prefs.enactor.syllabification.getPattern",
            hyphenateNode: {
                funcName: "fluid.prefs.enactor.syllabification.hyphenateNode",
                args: [
                    "{arguments}.0",
                    "{arguments}.1",
                    "{that}.options.markup.separator",
                    "{that}.options.markup.softHyphenPlaceholder"
                ]
            },
            injectScript: {
                this: "$",
                method: "ajax",
                args: [{
                    url: "{arguments}.0",
                    dataType: "script",
                    cache: true
                }]
            }
        }
    });

    /**
     * Only disconnect the observer if the state is set to false.
     * This corresponds to the syllabification's `enabled` model path being set to false.
     *
     * @param {fluid.mutationObserver} that - an instance of `fluid.mutationObserver`
     * @param {Boolean} state - if `false` disconnect, otherwise do nothing
     */
    fluid.prefs.enactor.syllabification.disconnectObserver = function (that, state) {
        if (!state) {
            that.disconnect();
        }
    };

    /**
     * Wait for all hyphenators to be resolved. After they are resolved the `afterSyllabification` event is fired.
     * If any of the hyphenator promises is rejected, the `onError` event is fired instead.
     *
     * @param {fluid.prefs.enactor.syllabification} that - an instance of `fluid.prefs.enactor.syllabification`
     *
     * @return {Promise} - returns the sequence promise; which is constructed from the hyphenator promises.
     */
    fluid.prefs.enactor.syllabification.waitForHyphenators = function (that) {
        var hyphenatorPromises = fluid.values(that.hyphenators);
        var promise = fluid.promise.sequence(hyphenatorPromises);
        promise.then(function () {
            that.events.afterSyllabification.fire();
        }, that.events.onError.fire);
        return promise;
    };

    fluid.prefs.enactor.syllabification.parse = function (that, elm) {
        elm = fluid.unwrap(elm);
        elm = elm.nodeType === Node.ELEMENT_NODE ? $(elm) : $(elm.parentNode);
        that.parser.parse(elm);
    };

    /**
     * Creates a hyphenator instance making use of the pattern supplied by the path; which is injected into the Document
     * if it hasn't already been loaded. If the pattern file cannot be loaded, the onError event is fired.
     *
     * @param {fluid.prefs.enactor.syllabification} that - an instance of `fluid.prefs.enactor.syllabification`
     * @param {Object} pattern - the `file path` to the pattern file. The path may include a string template token to
     *                           resolve a portion of its path from. The token will be resolved from the component's
     *                           `terms` option. (e.g. "%patternPrefix/en-us.js");
     * @param {String} lang - a valid BCP 47 language code. (NOTE: supported lang codes are defined in the
     *                        `patterns`) option.
     *
     * @return {Promise} - If a hyphenator is successfully created, the promise is resolved with it. Otherwise it is
     *                     resolved with undefined and the `onError` event fired.
     */
    fluid.prefs.enactor.syllabification.createHyphenator = function (that, pattern, lang) {
        var promise = fluid.promise();
        var globalPath = ["Hypher", "languages", lang];
        var hyphenator = fluid.getGlobalValue(globalPath);

        // If the pattern file has already been loaded, return the hyphenator.
        // This could happen if the pattern file is statically linked to the page.
        if (hyphenator) {
            promise.resolve(hyphenator);
            return promise;
        }

        var src = fluid.stringTemplate(pattern, that.options.terms);

        var injectPromise = that.injectScript(src);
        injectPromise.then(function () {
            hyphenator = fluid.getGlobalValue(globalPath);
            promise.resolve(hyphenator);
        }, function (error) {
            var errorInfo = {
                src: src,
                errorMsg: typeof(error) === "string" ? error : ""
            };

            var errorMessage = fluid.stringTemplate(that.options.strings.patternLoadError, errorInfo);
            fluid.log(fluid.logLevel.WARN, errorMessage, error);
            that.events.onError.fire(errorMessage, error);

            //TODO: A promise rejection would be more appropriate. However, we need to know when all of the hyphenators
            //      have attempted to load and apply syllabification. The current promise utility,
            //      fluid.promise.sequence, will reject the whole sequence if a promise is rejected, and prevent us from
            //      knowing if all of the hyphenators have been attempted. We should be able to improve this
            //      implementation once https://issues.fluidproject.org/browse/FLUID-5938 has been resolved.
            //
            // If the pattern file could not be loaded, resolve the promise without a hyphenator (undefined).
            promise.resolve();
        });

        return promise;
    };

    /**
     * Information about a pattern, including the resolved language code and the file path to the pattern file.
     *
     * @typedef {Object} PatternInfo
     * @property {String} lang - The resolved language code
     * @property {String|undefined} src - The file path to the pattern file for the resolved language. If no pattern
     *                                    file is available, the value should be `undefined`.
     */

    /**
     * Assembles an Object containing the information for locating the pattern file. If a pattern for the specific
     * requested language code cannot be located, it will attempt to locate a fall back, by looking for a pattern
     * supporting the generic language code. If no pattern can be found, `undefined` is returned as the `src` value.
     *
     *
     * @param {String} lang - a valid BCP 47 language code. (NOTE: supported lang codes are defined in the
     *                        `patterns`) option.
     * @param {Object.<String, String>} patterns - an object mapping language codes to file paths for the pattern files. For example:
     *                            {"en": "./patterns/en-us.js"}
     *
     * @return {PatternInfo} - returns a PatternInfo Object for the resolved language code. If a pattern file is not
     *                         available for the language, the `src` property will be `undefined`.
     */
    fluid.prefs.enactor.syllabification.getPattern = function (lang, patterns) {
        var src = patterns[lang];

        if (!src) {
            lang = lang.split("-")[0];
            src = patterns[lang];
        }

        return {
            lang: lang,
            src: src
        };
    };

    /**
     * Retrieves a promise for the appropriate hyphenator. If a hyphenator has not already been created, it will attempt
     * to create one and assign the related promise to the `hyphenators` member for future retrieval.
     *
     * When creating a hyphenator, it first checks if there is configuration for the specified `lang`. If that fails,
     * it attempts to fall back to a less specific localization.
     *
     * @param {fluid.prefs.enactor.syllabification} that - an instance of `fluid.prefs.enactor.syllabification`
     * @param {String} lang - a valid BCP 47 language code. (NOTE: supported lang codes are defined in the
     *                        `patterns`) option.
     *
     * @return {Promise} - returns a promise. If a hyphenator is successfully created, it is resolved with it.
     *                     Otherwise, it resolves with undefined.
     */
    fluid.prefs.enactor.syllabification.getHyphenator = function (that, lang) {
        //TODO: For all of the instances where an empty promise is resolved, a promise rejection would be more
        //      appropriate. However, we need to know when all of the hyphenators have attempted to load and apply
        //      syllabification. The current promise utility, fluid.promise.sequence, will reject the whole sequence if
        //      a promise is rejected, and prevent us from knowing if all of the hyphenators have been attempted. We
        //      should be able to improve this implementation once https://issues.fluidproject.org/browse/FLUID-5938 has
        //      been resolved.
        var promise = fluid.promise();
        var hyphenatorPromise;

        if (!lang) {
            promise.resolve();
            return promise;
        }

        var pattern = that.getPattern(lang.toLowerCase(), that.options.patterns);

        if (!pattern.src) {
            hyphenatorPromise = promise;
            promise.resolve();
            return promise;
        }

        if (that.hyphenators[pattern.src]) {
            return that.hyphenators[pattern.src];
        }

        hyphenatorPromise = that.createHyphenator(pattern.src, pattern.lang);
        fluid.promise.follow(hyphenatorPromise, promise);
        that.hyphenators[pattern.src] = hyphenatorPromise;

        return promise;
    };

    fluid.prefs.enactor.syllabification.syllabify = function (that, node, lang) {
        var hyphenatorPromise = that.getHyphenator(lang);
        hyphenatorPromise.then(function (hyphenator) {
            that.hyphenateNode(hyphenator, node);
        });
    };

    /**
     * Splits a text node at the specified `position` into two text nodes and inserts the specified `toInsert` content
     * between them.
     *
     * @param {DomNode} node - The text node to be split by the inserted content
     * @param {DomNode|DomElement} toInsert - The node/element to insert into the original content from the `node`
     * @param {Number} position - The position to split `node`. At this point the `node` will be split into two new text
     *                            nodes and the `toInsert` node placed between them. The position is the 0 based index
     *                            where the content would be inserted into the original text node. That is, the portion
     *                            before `position` will be included before the inserted node, and those including and
     *                            after `position` will be included after the inserted node.
     *
     * @return {DomNode} - The newly created text node after executing the split. That is, the second portion of the
     *                     severed text node.
     */
    fluid.prefs.enactor.syllabification.insertIntoTextNode = function (node, toInsert, position) {
        node = node.splitText(position);
        node.parentNode.insertBefore(toInsert, node);
        return node;
    };

    /**
     * Insert separators, indicating the hyphenated positions, into a text node. This will inject the specified
     * markup as the separators and split the original textnode at the hyphenation points. If there are no places to
     * inject a hyphenation point, the node will be left unchanged. If the original textnode inclues soft hyphens (i.e.
     * &shy;) characters, these will be used as a hyphenation point with the original location in the text node
     * replaced with the `softHyphenPlaceholderMarkup` to allow it to be restored when syllabification is removed.
     *
     * @param {HypherHyphenator} hyphenator - an instance of a Hypher Hyphenator
     * @param {DomNode} node - a DOM node containing text to be hyphenated
     * @param {String} separatorMarkup - the markup to be injected and used to indicate the separators/hyphens
     * @param {String} softHyphenPlaceholderMarkup - the markup to be injected and used to indicate the original
     *                                               location of any soft hyphens included in `node`
     */
    fluid.prefs.enactor.syllabification.hyphenateNode = function (hyphenator, node, separatorMarkup, softHyphenPlaceholderMarkup) {
        if (!hyphenator || !node.textContent) {
            return;
        }

        var softHyphen = "\u00AD";
        var hyphenated = hyphenator.hyphenateText(node.textContent);

        // split words on soft hyphens
        var segs = hyphenated.split(softHyphen);

        for (var i = 0; i < segs.length; i++) {
            // If the text content starts with a soft hyphen (\u00AD, &shy;) replace it with an empty placeholder; which
            // is used to put the soft hyphen back if syllabification is disabled.
            // See: https://issues.fluidproject.org/browse/FLUID-6554
            if (node.textContent.startsWith(softHyphen)) {
                // converts the softHyphenPlaceholderMarkup markup string into a Dom Node
                var placeholder = $(softHyphenPlaceholderMarkup)[0];
                var newNode = fluid.prefs.enactor.syllabification.insertIntoTextNode(node, placeholder, 1);
                node.remove();
                node = newNode;
            }

            // skip the last segment as we only need to place separators in between the parts of the words
            if (i < segs.length - 1) {
                var separator = $(separatorMarkup)[0]; // converts the separatorMarkup markup string into a Dom Node
                node = fluid.prefs.enactor.syllabification.insertIntoTextNode(node, separator, segs[i].length);
            }
        }
    };

    fluid.prefs.enactor.syllabification.removeSyllabification = function (that) {
        // remove separators
        that.locate("separator").each(function (index, elm) {
            var parent = elm.parentNode;
            $(elm).remove();
            parent.normalize();
        });

        // restore soft hyphens
        that.locate("softHyphenPlaceholder").each(function (index, elm) {
            var parent = elm.parentNode;

            elm.replaceWith(document.createTextNode("\u00AD"));
            parent.normalize();
        });
    };

    fluid.prefs.enactor.syllabification.setPresentation = function (that, elm, state) {
        if (state) {
            that.parse(elm);
        } else {
            that.remove();
        }
    };

    /**********************************************************************
     * Language Pattern File Configuration
     *
     *
     * Supplies the source paths for the language pattern files used to
     * separate words into their phonetic parts.
     **********************************************************************/

    fluid.defaults("fluid.prefs.enactor.syllabification.patterns", {
        terms: {
            patternPrefix: "../../../lib/hypher/patterns"
        },
        patterns: {
            be: "%patternPrefix/bg.js",
            bn: "%patternPrefix/bn.js",
            ca: "%patternPrefix/ca.js",
            cs: "%patternPrefix/cs.js",
            da: "%patternPrefix/da.js",
            de: "%patternPrefix/de.js",
            el: "%patternPrefix/el-monoton.js",
            "el-monoton": "%patternPrefix/el-monoton.js",
            "el-polyton": "%patternPrefix/el-polyton.js",
            en: "%patternPrefix/en-us.js",
            "en-gb": "%patternPrefix/en-gb.js",
            "en-us": "%patternPrefix/en-us.js",
            es: "%patternPrefix/es.js",
            fi: "%patternPrefix/fi.js",
            fr: "%patternPrefix/fr.js",
            grc: "%patternPrefix/grc.js",
            gu: "%patternPrefix/gu.js",
            hi: "%patternPrefix/hi.js",
            hu: "%patternPrefix/hu.js",
            hy: "%patternPrefix/hy.js",
            is: "%patternPrefix/is.js",
            it: "%patternPrefix/it.js",
            kn: "%patternPrefix/kn.js",
            la: "%patternPrefix/la.js",
            lt: "%patternPrefix/lt.js",
            lv: "%patternPrefix/lv.js",
            ml: "%patternPrefix/ml.js",
            nb: "%patternPrefix/nb-no.js",
            "nb-no": "%patternPrefix/nb-no.js",
            no: "%patternPrefix/nb-no.js",
            nl: "%patternPrefix/nl.js",
            or: "%patternPrefix/or.js",
            pa: "%patternPrefix/pa.js",
            pl: "%patternPrefix/pl.js",
            pt: "%patternPrefix/pt.js",
            ru: "%patternPrefix/ru.js",
            sk: "%patternPrefix/sk.js",
            sl: "%patternPrefix/sl.js",
            sv: "%patternPrefix/sv.js",
            ta: "%patternPrefix/ta.js",
            te: "%patternPrefix/te.js",
            tr: "%patternPrefix/tr.js",
            uk: "%patternPrefix/uk.js"
        }
    });
})(jQuery, fluid_3_0_0);
