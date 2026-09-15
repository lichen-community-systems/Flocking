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

    var unUnicode = /(\\u[\dabcdef]{4}|\\x[\dabcdef]{2})/g;

    fluid.unescapeProperties = function (string) {
        string = string.replace(unUnicode, function (match) {
            var code = match.substring(2);
            var parsed = parseInt(code, 16);
            return String.fromCharCode(parsed);
        });
        var pos = 0;
        while (true) {
            var backpos = string.indexOf("\\", pos);
            if (backpos === -1) {
                break;
            }
            if (backpos === string.length - 1) {
                return [string.substring(0, string.length - 1), true];
            }
            var replace = string.charAt(backpos + 1);
            if (replace === "n") { replace = "\n"; }
            if (replace === "r") { replace = "\r"; }
            if (replace === "t") { replace = "\t"; }
            string = string.substring(0, backpos) + replace + string.substring(backpos + 2);
            pos = backpos + 1;
        }
        return [string, false];
    };

    var breakPos = /[^\\][\s:=]/;

    fluid.parseJavaProperties = function (text) {
        // File format described at http://java.sun.com/javase/6/docs/api/java/util/Properties.html#load(java.io.Reader)
        var togo = {};
        text = text.replace(/\r\n/g, "\n");
        text = text.replace(/\r/g, "\n");
        var lines = text.split("\n");
        var contin, key, valueComp, valueRaw, valueEsc;
        for (var i = 0; i < lines.length; ++i) {
            var line = lines[i].trim();
            if (!line || line.charAt(0) === "#" || line.charAt(0) === "!") {
                continue;
            }
            if (!contin) {
                valueComp = "";
                var breakpos = line.search(breakPos);
                if (breakpos === -1) {
                    key = line;
                    valueRaw = "";
                }
                else {
                    key = line.substring(0, breakpos + 1).trim(); // +1 since first char is escape exclusion
                    valueRaw = line.substring(breakpos + 2).trim();
                    if (valueRaw.charAt(0) === ":" || valueRaw.charAt(0) === "=") {
                        valueRaw = valueRaw.substring(1).trim();
                    }
                }

                key = fluid.unescapeProperties(key)[0];
                valueEsc = fluid.unescapeProperties(valueRaw);
            }
            else {
                valueEsc = fluid.unescapeProperties(line);
            }

            contin = valueEsc[1];
            if (!valueEsc[1]) { // this line was not a continuation line - store the value
                togo[key] = valueComp + valueEsc[0];
            }
            else {
                valueComp += valueEsc[0];
            }
        }
        return togo;
    };

    /**
     *
     * Expand a message string with respect to a set of arguments, following a basic subset of the Java MessageFormat
     * rules.
     * http://java.sun.com/j2se/1.4.2/docs/api/java/text/MessageFormat.html
     *
     * The message string is expected to contain replacement specifications such as {0}, {1}, {2}, etc.
     *
     * @param {String} messageString - The message key to be expanded
     * @param {String|String[]} args - A single string or array of strings to be substituted into the message.
     * @return {String} - The expanded message string.
     */
    fluid.formatMessage = function (messageString, args) {
        if (!args) {
            return messageString;
        }
        if (typeof(args) === "string") {
            args = [args];
        }
        for (var i = 0; i < args.length; ++i) {
            messageString = messageString.replace("{" + i + "}", args[i]);
        }
        return messageString;
    };

})(jQuery, fluid_3_0_0);
