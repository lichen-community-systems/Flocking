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

    fluid.defaults("fluid.prefs.store", {
        gradeNames: ["fluid.dataSource", "fluid.contextAware"],
        contextAwareness: {
            strategy: {
                defaultGradeNames: "fluid.prefs.cookieStore"
            }
        }
    });

    fluid.prefs.store.decodeURIComponent = function (payload) {
        if (typeof payload === "string") {
            return decodeURIComponent(payload);
        }
    };

    fluid.prefs.store.encodeURIComponent = function (payload) {
        if (typeof payload === "string") {
            return encodeURIComponent(payload);
        }
    };

    /****************
     * Cookie Store *
     ****************/

    /**
     * Options for reading and/or writing a cookie using the `Document.cookie` web api through a {fluid.dataSource}.
     * In most cases these are used directly for setting attributes of the same name on the cookie. However, the `name`
     * and `directModel` properties are used for reading/writing the specific cookie. The `directModel` is typically
     * included via calls to the `dataSource`'s `get` and `set` methods. The `directModel` is typically prioritized for
     * sourcing the cookie's name, followed by the `name` property.
     *
     * Note: Other than `name` and `directModel` all property names are case insensitive.
     * See: https://developer.mozilla.org/en-US/docs/Web/API/Document/cookie for more details on `Document.cookie`
     *
     * @typedef {Object} CookieOpts
     *
     * @property {Object} [directModel] - An object defining the coordinates to the cookie
     *                                    see: `fluid.dataSource` for more information.
     * @property {String} [directModel.cookieName] - The name of the cookie to read/write
     * @property {String} [domain] - The domain to scope the cookie's permissions to.
     *                               (e.g. "example.com" or "subdomain.example.com"). Defaults to the host portion of
     *                               the current `document.location`.
     * @property {GMTString} [expires] - The cookie expiry date.
     * @property {Integer} [max-age] - The maximum age, in seconds, for the cookie before it expires. A negative value
     *                                 will cause the cookie to expire immediately.
     * @property {String} [name] - The name of the cookie to read/write; typically used if `directModel.cookieName` is
     *                             not provided.
     * @property {String} [path] - The URL path that must be included. Defaults to the current
     *                             `document.location.pathname`.
     * @property {String} [samesite] - Manages how cookies are sent with cross site requests. Possible values are `lax`,
     *                                `strict`, or `none`. In the future this may be a required field or default to
     *                                `lax`.
     * @property {String} [secure] - If enabled, will only allow cookies to be sent over secure protocols (e.g. https).
     *                               In the Cookie specification this property doesn't take any values and will be
     *                               enabled regardless of the value assigned. However, the specific {fluid.dataSource}
     *                               implementation may handle `falsey` values as a means to remove it.
     */

    /**
     * A type of {fluid.dataSource} that uses a cookie for persistence.
     */
    fluid.defaults("fluid.prefs.cookieStore", {
        gradeNames: ["fluid.dataSource"],
        writableGrade: "fluid.prefs.cookieStore.writable",
        cookie: {
            name: "fluid-ui-settings"
        },
        listeners: {
            "onRead.impl": {
                listener: "fluid.prefs.cookieStore.getCookie",
                args: ["{arguments}.1"]
            },
            "onRead.decodeURI": {
                listener: "fluid.prefs.store.decodeURIComponent",
                priority: "before:encoding"
            }
        },
        invokers: {
            get: {
                args: ["{that}", "{arguments}.0", "{that}.options.cookie"] // directModel, options/callback
            }
        }
    });

    fluid.defaults("fluid.prefs.cookieStore.writable", {
        gradeNames: ["fluid.dataSource.writable"],
        cookie: {
            // Any attribute specified will be interpolated into the cookie during a write
            path: "/",
            samesite: "strict"
        },
        listeners: {
            "onWrite.encodeURI": {
                func: "fluid.prefs.store.encodeURIComponent",
                priority: "before:impl"
            },
            "onWrite.impl": {
                listener: "fluid.prefs.cookieStore.writeCookie"
            },
            "onWriteResponse.decodeURI": {
                listener: "fluid.prefs.store.decodeURIComponent",
                priority: "before:encoding"
            }
        },
        invokers: {
            set: {
                args: ["{that}", "{arguments}.0", "{arguments}.1", "{that}.options.cookie"] // directModel, model, options/callback
            }
        }
    });

    /**
     * Retrieve and return the value of the cookie
     *
     * @param {CookieOpts} options - the cookie attributes; used to get the cookie name.
     * @return {String} - the serialized cookie
     */
    fluid.prefs.cookieStore.getCookie = function (options) {
        var cookieName = fluid.get(options, ["directModel", "cookieName"]) || options.name;
        var cookie = document.cookie;
        if (cookie.length <= 0) {
            return;
        }

        var cookiePrefix = cookieName + "=";
        var startIndex = cookie.indexOf(cookiePrefix);
        if (startIndex < 0) {
            return;
        }

        startIndex = startIndex + cookiePrefix.length;
        var endIndex = cookie.indexOf(";", startIndex);
        if (endIndex < startIndex) {
            endIndex = cookie.length;
        }
        return cookie.substring(startIndex, endIndex);
    };

    /**
     * Assembles the cookie string
     * @param {String} cookieName - name of the cookie
     * @param {String} payload - the serialized data to be stored in the cookie
     * @param {CookieOpts} options - the cookie attributes
     * @return {String} - A string representing the assembled cookie.
     */
    fluid.prefs.cookieStore.assembleCookie = function (cookieName, payload, options) {
        options = options || {};
        var cookieStr = cookieName + "=" + payload;

        fluid.each(options, function (value, attribute) {
            // skip name because it was already set as the first portion of the cookieStr
            var isNameAttr = attribute.toLowerCase() === "name";
            var isSecureAttr = attribute.toLowerCase() === "secure";
            if (!isNameAttr && !isSecureAttr) {
                cookieStr += "; " + attribute + "=" + value;
            } else if (isSecureAttr && value) {
                cookieStr += "; " + attribute;
            }
        });

        return cookieStr;
    };

    /**
     * Saves the settings into a cookie
     * @param {String} payload - the serialized data to be stored in the cookie
     * @param {CookieOpts} options - settings
     * @return {Object} - The original payload.
     */
    fluid.prefs.cookieStore.writeCookie = function (payload, options) {
        var cookieName = fluid.get(options, ["directModel", "cookieName"]) || options.name;
        var cookieStr = fluid.prefs.cookieStore.assembleCookie(cookieName, payload, options);

        document.cookie = cookieStr;
        return payload;
    };


    /**************
     * Temp Store *
     **************/

    fluid.defaults("fluid.dataSource.encoding.model", {
        gradeNames: "fluid.component",
        invokers: {
            parse: "fluid.identity",
            render: "fluid.identity"
        },
        contentType: "application/json"
    });

    /*
     * A type of {fluid.dataSource} mock that doesn't do persistence.
     */
    fluid.defaults("fluid.prefs.tempStore", {
        gradeNames: ["fluid.dataSource", "fluid.modelComponent"],
        writableGrade: "fluid.prefs.tempStore.writable",
        components: {
            encoding: {
                type: "fluid.dataSource.encoding.model"
            }
        },
        listeners: {
            "onRead.impl": {
                listener: "fluid.identity",
                args: ["{that}.model"]
            }
        }
    });

    fluid.defaults("fluid.prefs.tempStore.writable", {
        gradeNames: ["fluid.dataSource.writable", "fluid.modelComponent"],
        components: {
            encoding: {
                type: "fluid.dataSource.encoding.model"
            }
        },
        listeners: {
            "onWrite.impl": {
                listener: "fluid.prefs.tempStore.write",
                args: ["{that}", "{arguments}.0", "{arguments}.1"]
            }
        }
    });

    fluid.prefs.tempStore.write = function (that, settings) {
        var transaction = that.applier.initiate();
        transaction.fireChangeRequest({path: "", type: "DELETE"});
        transaction.change("", settings);
        transaction.commit();
        return that.model;
    };

    fluid.defaults("fluid.prefs.globalSettingsStore", {
        gradeNames: ["fluid.component"],
        components: {
            settingsStore: {
                type: "fluid.prefs.store",
                options: {
                    gradeNames: ["fluid.resolveRootSingle"],
                    writable: true,
                    singleRootType: "fluid.prefs.store"
                }
            }
        }
    });

})(jQuery, fluid_3_0_0);
