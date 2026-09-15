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

    /**
     * fluid.remoteModelComponent builds on top of fluid.modelComponent with the purpose of providing a buffer between a
     * local and remote model that are attempting to stay in sync. For example a local model is being updated by user
     * interaction, this is sent back to a remote server, which in turn tries to update the local model. If additional
     * user actions occur during the roundtrip, an infinite loop of updates may occur. fluid.remoteModelComponent solves
     * this by restricting reading and writing to a single request at a time, waiting for one request to complete
     * before operating the next.
     *
     * For more detailed documentation, including diagrams outlining the fetch and write workflows, see:
     * https://docs.fluidproject.org/infusion/development/RemoteModelAPI.html
     */
    fluid.defaults("fluid.remoteModelComponent", {
        gradeNames: ["fluid.modelComponent"],
        events: {
            afterFetch: null,
            onFetch: null,
            onFetchError: null,
            afterWrite: null,
            onWrite: null,
            onWriteError: null
        },
        members: {
            pendingRequests: {
                write: null,
                fetch: null
            }
        },
        model: {
            // an implementor must setup a model relay between the buffered local value and the portions of the
            // component's model state that should be updated with the remote source.
            local: {},
            remote: {},
            requestInFlight: false
        },
        modelListeners: {
            "requestInFlight": {
                listener: "fluid.remoteModelComponent.launchPendingRequest",
                args: ["{that}"]
            }
        },
        listeners: {
            "afterFetch.updateModel": {
                listener: "fluid.remoteModelComponent.updateModelFromFetch",
                args: ["{that}", "{arguments}.0"],
                priority: "before:unblock"
            },
            "afterFetch.unblock": {
                listener: "fluid.remoteModelComponent.unblockFetchReq",
                args: ["{that}"]
            },
            "onFetchError.unblock": {
                listener: "fluid.remoteModelComponent.unblockFetchReq",
                args: ["{that}"]
            },
            "afterWrite.updateRemoteModel": {
                listener: "fluid.remoteModelComponent.updateRemoteFromLocal",
                args: ["{that}"]
            },
            "afterWrite.unblock": {
                changePath: "requestInFlight",
                value: false,
                priority: "after:updateRemoteModel"
            },
            "onWriteError.unblock": {
                changePath: "requestInFlight",
                value: false
            }
        },
        invokers: {
            fetch: {
                funcName: "fluid.remoteModelComponent.fetch",
                args: ["{that}"]
            },
            fetchImpl: "fluid.notImplemented",
            write: {
                funcName: "fluid.remoteModelComponent.write",
                args: ["{that}"]
            },
            writeImpl: "fluid.notImplemented"
        }
    });

    fluid.remoteModelComponent.launchPendingRequest = function (that) {
        if (!that.model.requestInFlight) {
            if (that.pendingRequests.fetch) {
                that.fetch();
            } else if (that.pendingRequests.write) {
                that.write();
            }
        }
    };

    fluid.remoteModelComponent.updateModelFromFetch = function (that, fetchedModel) {
        var remoteChanges = fluid.modelPairToChanges(fetchedModel, that.model.remote, "local");
        var localChanges = fluid.modelPairToChanges(that.model.local, that.model.remote, "local");
        var changes = remoteChanges.concat(localChanges);

        // perform model updates in a single transaction
        var transaction = that.applier.initiate();
        transaction.fireChangeRequest({path: "local", type: "DELETE"}); // clear old local model
        transaction.change("local", that.model.remote); // reset local model to the base for applying changes.
        transaction.fireChangeRequest({path: "remote", type: "DELETE"}); // clear old remote model
        transaction.change("remote", fetchedModel); // update remote model to fetched changes.
        fluid.fireChanges(transaction, changes); // apply changes from remote and local onto base model.
        transaction.commit(); // submit transaction
    };

    fluid.remoteModelComponent.updateRemoteFromLocal = function (that) {
        // perform model updates in a single transaction
        var transaction = that.applier.initiate();
        transaction.fireChangeRequest({path: "remote", type: "DELETE"}); // clear old remote model
        transaction.change("remote", that.model.local); // update remote model to local changes.
        transaction.commit(); // submit transaction
    };

    /*
     * Similar to fluid.promise.makeSequenceStrategy from FluidPromises.js; however, rather than passing along the
     * result from one listener in the sequence to the next, the original payload is always passed to each listener.
     * In this way, the synthetic events are handled like typical events, but a promise can be resolved/rejected at the
     * end of the sequence.
     */
    fluid.remoteModelComponent.makeSequenceStrategy = function (payload) {
        return {
            invokeNext: function (that) {
                var lisrec = that.sources[that.index];
                lisrec.listener = fluid.event.resolveListener(lisrec.listener);
                var value = lisrec.listener.apply(null, [payload, that.options]);
                return value;
            },
            resolveResult: function () {
                return payload;
            }
        };
    };

    fluid.remoteModelComponent.makeSequence = function (listeners, payload, options) {
        var sequencer = fluid.promise.makeSequencer(listeners, options, fluid.remoteModelComponent.makeSequenceStrategy(payload));
        fluid.promise.resumeSequence(sequencer);
        return sequencer;
    };

    fluid.remoteModelComponent.fireEventSequence = function (event, payload, options) {
        var listeners = fluid.makeArray(event.sortedListeners);
        var sequence = fluid.remoteModelComponent.makeSequence(listeners, payload, options);
        return sequence.promise;
    };

    /**
     * Adds a fetch request and returns a promise.
     *
     * Only one request can be in flight (processing) at a time. If a write request is in flight, the fetch will be
     * queued. If a fetch request is already in queue/flight, the result of that request will be passed along to the
     * current fetch request. When a fetch request is in flight , it will trigger the fetchImpl invoker to perform the
     * actual request.
     *
     * Two synthetic events, onFetch and afterFetch, are fired during the processing of a fetch. onFetch can be used to
     * perform any necessary actions before running fetchImpl. afterFetch can be used to perform any necessary actions
     * after running fetchImpl (e.g. updating the model, unblocking the queue). If promises returned from onFetch, afterFetch, or
     * fetchImpl are rejected, the onFetchError event will be fired.
     *
     * @param {Object} that - The component itself.
     * @return {Promise} - A promise that will be resolved with the fetched value or rejected if there is an error.
     */
    fluid.remoteModelComponent.fetch = function (that) {
        var promise = fluid.promise();
        var activePromise;

        if (that.pendingRequests.fetch) {
            activePromise = that.pendingRequests.fetch;
            fluid.promise.follow(activePromise, promise);
        } else {
            activePromise = promise;
            that.pendingRequests.fetch = promise;
        }

        if (!that.model.requestInFlight) {
            var onFetchSeqPromise = fluid.remoteModelComponent.fireEventSequence(that.events.onFetch);
            onFetchSeqPromise.then(function () {
                that.applier.change("requestInFlight", true);
                var reqPromise = that.fetchImpl();
                reqPromise.then(function (data) {
                    var afterFetchSeqPromise = fluid.remoteModelComponent.fireEventSequence(that.events.afterFetch, data);
                    fluid.promise.follow(afterFetchSeqPromise, activePromise);
                }, that.events.onFetchError.fire);

            }, that.events.onFetchError.fire);
        }
        return promise;
    };

    fluid.remoteModelComponent.unblockFetchReq = function (that) {
        that.pendingRequests.fetch = null;
        that.applier.change("requestInFlight", false);
    };

    /**
     * Adds a write request and returns a promise.
     *
     * Only one request can be in flight (processing) at a time. If a fetch or write request is in flight, the write will
     * be queued. If a write request is already in queue, the result of that request will be passed along to the current
     * write request. When a write request is in flight , it will trigger the writeImpl invoker to perform the
     * actual request.
     *
     * Two synthetic events, onWrite and afterWrite, are fired during the processing of a write. onWrite can be used to
     * perform any necessary actions before running writeImpl (e.g. performing a fetch). afterWrite can be used to perform any necessary actions
     * after running writeImpl (e.g. unblocking the queue, performing a fetch). If promises returned from onWrite, afterWrite, or
     * writeImpl are rejected, the onWriteError event will be fired.
     *
     * @param {Object} that - The component itself.
     * @return {Promise} - A promise that will be resolved when the value is written or rejected if there is an error.
     */
    fluid.remoteModelComponent.write = function (that) {
        var promise = fluid.promise();
        var activePromise;

        if (that.pendingRequests.write) {
            activePromise = that.pendingRequests.write;
            fluid.promise.follow(that.pendingRequests.write, promise);
        } else {
            activePromise = promise;
        }

        if (that.model.requestInFlight) {
            that.pendingRequests.write = activePromise;
        } else {
            var onWriteSeqPromise = fluid.remoteModelComponent.fireEventSequence(that.events.onWrite);
            onWriteSeqPromise.then(function () {
                that.applier.change("requestInFlight", true);
                that.pendingRequests.write = null;

                if (fluid.model.diff(that.model.local, that.model.remote)) {
                    var afterWriteSeqPromise = fluid.remoteModelComponent.fireEventSequence(that.events.afterWrite, that.model.local);
                    fluid.promise.follow(afterWriteSeqPromise, activePromise);
                } else {
                    var reqPromise = that.writeImpl(that.model.local);
                    reqPromise.then(function (data) {
                        var afterWriteSeqPromise = fluid.remoteModelComponent.fireEventSequence(that.events.afterWrite, data);
                        fluid.promise.follow(afterWriteSeqPromise, activePromise);
                    }, that.events.onWriteError.fire);;
                }
            }, that.events.onWriteError.fire);
        }

        return promise;
    };

})(jQuery, fluid_3_0_0);
