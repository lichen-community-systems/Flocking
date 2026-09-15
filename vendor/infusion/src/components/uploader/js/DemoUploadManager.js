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

    fluid.registerNamespace("fluid.uploader.demo");

    fluid.defaults("fluid.uploader.demo", {
        distributeOptions: {
            record: "fluid.uploader.demo.remote",
            target: "{that strategy remote}.type"
        }
    });

    fluid.uploader.demo.uploadNextFile = function (that) {
        // Reset our upload stats for each new file.
        that.demoState.currentFile = that.queue.files[that.demoState.fileIdx];
        that.demoState.chunksForCurrentFile = Math.ceil(that.demoState.currentFile / that.demoState.chunkSize);
        that.demoState.bytesUploaded = 0;
        that.queue.isUploading = true;

        that.events.onFileStart.fire(that.demoState.currentFile);
        fluid.uploader.demo.simulateUpload(that);
    };

    fluid.uploader.demo.updateProgress = function (file, events, demoState, isUploading) {
        if (!isUploading) {
            return;
        }

        var chunk = Math.min(demoState.chunkSize, file.size);
        demoState.bytesUploaded = Math.min(demoState.bytesUploaded + chunk, file.size);
        events.onFileProgress.fire(file, demoState.bytesUploaded, file.size);
    };

    fluid.uploader.demo.finishAndContinueOrCleanup = function (that, file) {
        // TODO: it appears that this duplicates handlers in Uploader.js onFileComplete -
        // which this component does not fire
        that.queue.finishFile(file);
        that.events.afterFileComplete.fire(file);
        if (that.queue.shouldUploadNextFile()) {
            fluid.uploader.demo.uploadNextFile(that);
        } else {
            that.events.afterUploadComplete.fire(that.queue.currentBatch.files);
            if (file.status !== fluid.uploader.fileStatusConstants.CANCELLED) {
                that.queue.clearCurrentBatch(); // Only clear the current batch if we're actually done the batch.
            }
        }
    };

    fluid.uploader.demo.finishUploading = function (that) {
        if (!that.queue.isUploading) {
            return;
        }

        var file = that.demoState.currentFile;
        that.events.onFileSuccess.fire(file);
        that.demoState.fileIdx++;
        fluid.uploader.demo.finishAndContinueOrCleanup(that, file);
    };

    fluid.uploader.demo.simulateUpload = function (that) {
        if (!that.queue.isUploading) {
            return;
        }

        var file = that.demoState.currentFile;
        if (that.demoState.bytesUploaded < file.size) {
            fluid.invokeAfterRandomDelay(function () {
                fluid.uploader.demo.updateProgress(file, that.events, that.demoState, that.queue.isUploading);
                fluid.uploader.demo.simulateUpload(that);
            });
        } else {
            fluid.uploader.demo.finishUploading(that);
        }
    };

    fluid.uploader.demo.stop = function (that) {
        var file = that.demoState.currentFile;
        file.filestatus = fluid.uploader.fileStatusConstants.CANCELLED;
        that.queue.shouldStop = true;

        // Legacy from the SWFUpload implementation, where pausing is a combination of an UPLOAD_STOPPED error and a complete.
        that.events.onFileError.fire(file,
            fluid.uploader.errorConstants.UPLOAD_STOPPED,
            "The demo upload was paused by the user.");
        fluid.uploader.demo.finishAndContinueOrCleanup(that, file);
        that.events.onUploadStop.fire();
    };

    /**
     * Invokes a function after a random delay by using setTimeout.
     * @param {Function} fn - the function to invoke
     */
    fluid.invokeAfterRandomDelay = function (fn) {
        var delay = Math.floor(Math.random() * 200 + 100);
        setTimeout(fn, delay);
    };

    /*
     * The demo remote pretends to upload files to the server, firing all the appropriate events
     * but without sending anything over the network or requiring a server to be running.
     */
    fluid.defaults("fluid.uploader.demo.remote", {
        gradeNames: ["fluid.uploader.remote"],
        members: {
            demoState: {
                fileIdx: 0,
                chunkSize: 200000
            }
        },
        invokers: {
            uploadNextFile: {
                funcName: "fluid.uploader.demo.uploadNextFile",
                args: "{that}"
            },
            stop: {
                funcName: "fluid.uploader.demo.stop",
                args: "{that}"
            }
        }
    });

})(jQuery, fluid_3_0_0);
