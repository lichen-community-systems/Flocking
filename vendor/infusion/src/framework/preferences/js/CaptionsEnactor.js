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

/* global YT */

(function ($, fluid) {
    "use strict";

    /*******************************************************************************
     * captions
     *
     * An enactor that is capable of enabling captions on embedded YouTube videos
     *******************************************************************************/

    fluid.defaults("fluid.prefs.enactor.captions", {
        gradeNames: ["fluid.prefs.enactor", "fluid.viewComponent"],
        preferenceMap: {
            "fluid.prefs.captions": {
                "model.enabled": "value"
            }
        },
        events: {
            onVideoElementLocated: null
        },
        selectors: {
            videos: "iframe[src^=\"https://www.youtube.com/embed/\"]"
        },
        model: {
            enabled: false
        },
        components: {
            ytAPI: {
                type: "fluid.prefs.enactor.captions.ytAPI"
            }
        },
        dynamicComponents: {
            player: {
                type: "fluid.prefs.enactor.captions.youTubePlayer",
                createOnEvent: "onVideoElementLocated",
                container: "{arguments}.0",
                options: {
                    model: {
                        captions: "{captions}.model.enabled"
                    }
                }
            }
        },
        listeners: {
            "onCreate.initPlayers": "{that}.initPlayers"
        },
        invokers: {
            initPlayers: {
                funcName: "fluid.prefs.enactor.captions.initPlayers",
                args: ["{that}", "{ytAPI}.notifyWhenLoaded", "{that}.dom.videos"]
            }
        }
    });

    /**
     * When the YouTube API is available, the onVideoElementLocated event will fire for each video element located by
     * the `videos` argument. Each of these event calls will fire with a jQuery object containing a single video
     * element. This allows for initializing dynamicComponents (fluid.prefs.enactor.captions.youTubePlayer) for each
     * video element.
     *
     * @param {Component} that - the component
     * @param {Function} getYtApi - a function that returns a promise indicating if the YouTube API is available
     * @param {jQuery|Element} videos - the videos to fire onVideoElementLocated events with
     *
     * @return {Promise} - A promise that follows the promise returned by the getYtApi function
     */
    fluid.prefs.enactor.captions.initPlayers = function (that, getYtApi, videos) {
        var promise = fluid.promise();
        var ytAPINotice = getYtApi();

        promise.then(function () {
            $(videos).each(function (index, elm) {
                that.events.onVideoElementLocated.fire($(elm));
            });
        });

        fluid.promise.follow(ytAPINotice, promise);
        return promise;
    };

    /*********************************************************************************************
     * fluid.prefs.enactor.captions.window is a singleton component to be used for assigning     *
     * values onto the window object.                                                            *
     *********************************************************************************************/

    fluid.defaults("fluid.prefs.enactor.captions.ytAPI", {
        gradeNames: ["fluid.component", "fluid.resolveRootSingle"],
        singleRootType: "fluid.prefs.enactor.captions.window",
        events: {
            onYouTubeAPILoaded: null
        },
        members: {
            global: window
        },
        invokers: {
            notifyWhenLoaded: {
                funcName: "fluid.prefs.enactor.captions.ytAPI.notifyWhenLoaded",
                args: ["{that}"]
            }
        }
    });

    /**
     * Used to determine when the YouTube API is available for use. It will test if the API is already available, and if
     * not, will bind to the onYouTubeIframeAPIReady method that is called when the YouTube API finishes loading.
     * When the YouTube API is ready, the promise will resolve an the onYouTubeAPILoaded event will fire.
     *
     * NOTE: After FLUID-6148 (https://issues.fluidproject.org/browse/FLUID-6148) is complete, it should be possible for
     *       the framework to handle this asynchrony directly in an expander for the player member in
     *       fluid.prefs.enactor.captions.youTubePlayer.
     *
     * @param {Component} that - the component itself
     *
     * @return {Promise} - a promise resolved after the YouTube API has loaded.
     */
    fluid.prefs.enactor.captions.ytAPI.notifyWhenLoaded = function (that) {
        var promise = fluid.promise();
        promise.then(function () {
            that.events.onYouTubeAPILoaded.fire();
        }, function (error) {
            fluid.log(fluid.logLevel.WARN, error);
        });

        if (fluid.get(window, ["YT", "Player"])) {
            promise.resolve();
        } else {
            // the YouTube iframe api will call onYouTubeIframeAPIReady after the api has loaded
            fluid.set(that.global, "onYouTubeIframeAPIReady", promise.resolve);
        }

        return promise;
    };

    /**
     * See: https://developers.google.com/youtube/iframe_api_reference#Events for details on the YouTube player
     * events. This includes when they are fired and what data is passed along.
     */
    fluid.defaults("fluid.prefs.enactor.captions.youTubePlayer", {
        gradeNames: ["fluid.viewComponent"],
        events: {
            onReady: null,
            onStateChange: null,
            onPlaybackQualityChange: null,
            onPlaybackRateChange: null,
            onError: null,
            onApiChange: null
        },
        model: {
            captions: false,
            track: {}
        },
        members: {
            player: {
                expander: {
                    funcName: "fluid.prefs.enactor.captions.youTubePlayer.initYTPlayer",
                    args: ["{that}"]
                }
            },
            tracklist: []
        },
        invokers: {
            applyCaptions: {
                funcName: "fluid.prefs.enactor.captions.youTubePlayer.applyCaptions",
                args: ["{that}.player", "{that}.model.track", "{that}.model.captions"]
            }
        },
        modelListeners: {
            "setCaptions": {
                listener: "{that}.applyCaptions",
                path: ["captions", "track"],
                excludeSource: "init"
            }
        },
        listeners: {
            "onApiChange.prepTrack": {
                listener: "fluid.prefs.enactor.captions.youTubePlayer.prepTrack",
                args: ["{that}", "{that}.player"]
            },
            "onApiChange.applyCaptions": {
                listener: "{that}.applyCaptions",
                priority: "after:prepTrack"
            }
        }
    });

    /**
     * Adds the "enablejsapi=1" query parameter to the query string at the end of the src attribute.
     * If "enablejsapi" already exists it will modify its value to 1. This is required for API access
     * to the embedded YouTube video.
     *
     * @param {jQuery|Element} videoElm - a reference to the existing embedded YouTube video.
     */
    fluid.prefs.enactor.captions.youTubePlayer.enableJSAPI = function (videoElm) {
        videoElm = $(videoElm);
        var url = new URL(videoElm.attr("src"));

        url.searchParams.set("enablejsapi", 1);
        videoElm.attr("src", url.toString());
    };

    /**
     * An instance of a YouTube player from the YouTube iframe API
     *
     * @typedef {Object} YTPlayer
     */

    /**
     * Initializes the YT.Player using the existing embedded video (component's container). An ID will be added to the
     * video element if one does not already exist.
     *
     * @param {Component} that - the component
     *
     * @return {YTPlayer} - an instance of a YouTube player controlling the embedded video
     */
    fluid.prefs.enactor.captions.youTubePlayer.initYTPlayer = function (that) {
        var id = fluid.allocateSimpleId(that.container);
        fluid.prefs.enactor.captions.youTubePlayer.enableJSAPI(that.container);
        return new YT.Player(id, {
            events: {
                onReady: that.events.onReady.fire,
                onStateChange: that.events.onStateChange.fire,
                onPlaybackQualityChange: that.events.onPlaybackQualityChange.fire,
                onPlaybackRateChange: that.events.onPlaybackRateChange.fire,
                onError: that.events.onError.fire,
                onApiChange: that.events.onApiChange.fire
            }
        });
    };

    /**
     * Enables/disables the captions on an embedded YouTube video. Requires that the player be initiallized and the API
     * ready for use.
     *
     * @param {YTPlayer} player - an instance of a YouTube player
     * @param {Object} track - a track object for the {YTPlayer}
     * @param {Boolean} state - true - captions enabled; false - captions disabled.
     */
    fluid.prefs.enactor.captions.youTubePlayer.applyCaptions = function (player, track, state) {
        // The loadModule method from the player must be ready first. This is made available after
        // the onApiChange event has fired.
        if (player.loadModule) {
            if (state) {
                player.loadModule("captions");
                player.setOption("captions", "track", track);
            } else {
                player.unloadModule("captions");
            }
        }
    };

    /**
     * Prepares the track to be used when captions are enabled. It will use the first track in the tracklist, and update
     * the "track" model path with it.
     *
     * @param {Component} that - the component
     * @param {YTPlayer} player - an instance of a YouTube player
     */
    fluid.prefs.enactor.captions.youTubePlayer.prepTrack = function (that, player) {
        player.loadModule("captions");
        var tracklist = player.getOption("captions", "tracklist");

        if (tracklist.length && !that.tracklist.length) {
            // set the tracklist and use first track for the captions
            that.tracklist = tracklist;
            that.applier.change("track", tracklist[0], "ADD", "prepTrack");
        }
    };


})(jQuery, fluid_3_0_0);
