// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE

// Depends on json5.js from https://github.com/aseemk/json5

// declare global: JSON5

(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
"use strict";

CodeMirror.registerHelper("lint", "json5", function(text, options, cm) {
  var found = [];
  try {
    JSON5.parse(text);
  } catch (e) {
    var messageGeneric = e.message.indexOf(" at ");
    var message = e.message.substring(0, messageGeneric);
    var line = e.lineNumber - 1, col = e.columnNumber;
    if (e.columnNumber === 0) { // More usefully assign column 0 errors to last character of previous line
        --line;
        var prevLine = cm.doc.getLine(line);
        col = prevLine.length;
    }

    found.push({from: CodeMirror.Pos(line, col - 1),
                to: CodeMirror.Pos(line, col),
                message: message});
  }
  return found;
});

});
