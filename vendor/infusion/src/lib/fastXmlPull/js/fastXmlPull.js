// =========================================================================
//
// tinyxmlsax.js - an XML SAX parser in JavaScript compressed for downloading
//
// version 3.1
//
// =========================================================================
//
// Copyright (C) 2000 - 2002, 2003 Michael Houghton (mike@idle.org), Raymond Irving and David Joham (djoham@yahoo.com)
//
// This library is free software; you can redistribute it and/or
// modify it under the terms of the GNU Lesser General Public
// License as published by the Free Software Foundation; either
// version 2.1 of the License, or (at your option) any later version.

// This library is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
// Lesser General Public License for more details.

// You should have received a copy of the GNU Lesser General Public
// License along with this library; if not, write to the Free Software
// Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
//
// Visit the XML for <SCRIPT> home page at http://xmljs.sourceforge.net
//

/*
The zlib/libpng License

Copyright (c) 2000 - 2002, 2003 Michael Houghton (mike@idle.org), Raymond Irving and David Joham (djoham@yahoo.com)

This software is provided 'as-is', without any express or implied
warranty. In no event will the authors be held liable for any damages
arising from the use of this software.

Permission is granted to anyone to use this software for any purpose,
including commercial applications, and to alter it and redistribute it
freely, subject to the following restrictions:

    1. The origin of this software must not be misrepresented; you must not
    claim that you wrote the original software. If you use this software
    in a product, an acknowledgment in the product documentation would be
    appreciated but is not required.

    2. Altered source versions must be plainly marked as such, and must not be
    misrepresented as being the original software.

    3. This notice may not be removed or altered from any source
    distribution.
 */

var fluid_3_0_0 = fluid_3_0_0 || {};

(function (fluid) {
    "use strict";

    fluid.XMLP = function(strXML) {
        return fluid.XMLP.XMLPImpl(strXML);
    };


    // List of closed HTML tags, taken from JQuery 1.2.3
    fluid.XMLP.closedTags = {
        abbr: true,
        br: true,
        col: true,
        img: true,
        input: true,
        link: true,
        meta: true,
        param: true,
        hr: true,
        area: true,
        embed:true
    };

    fluid.XMLP._NONE = 0;
    fluid.XMLP._ELM_B = 1;
    fluid.XMLP._ELM_E = 2;
    fluid.XMLP._ELM_EMP = 3;
    fluid.XMLP._ATT = 4;
    fluid.XMLP._TEXT = 5;
    fluid.XMLP._ENTITY = 6;
    fluid.XMLP._PI = 7;
    fluid.XMLP._CDATA = 8;
    fluid.XMLP._COMMENT = 9;
    fluid.XMLP._DTD = 10;
    fluid.XMLP._ERROR = 11;

    fluid.XMLP._CONT_XML = 0;
    fluid.XMLP._CONT_ALT = 1;
    fluid.XMLP._ATT_NAME = 0;
    fluid.XMLP._ATT_VAL = 1;

    fluid.XMLP._STATE_PROLOG = 1;
    fluid.XMLP._STATE_DOCUMENT = 2;
    fluid.XMLP._STATE_MISC = 3;

    fluid.XMLP._errs = [];
    fluid.XMLP._errs[fluid.XMLP.ERR_CLOSE_PI = 0 ] = "PI: missing closing sequence";
    fluid.XMLP._errs[fluid.XMLP.ERR_CLOSE_DTD = 1 ] = "DTD: missing closing sequence";
    fluid.XMLP._errs[fluid.XMLP.ERR_CLOSE_COMMENT = 2 ] = "Comment: missing closing sequence";
    fluid.XMLP._errs[fluid.XMLP.ERR_CLOSE_CDATA = 3 ] = "CDATA: missing closing sequence";
    fluid.XMLP._errs[fluid.XMLP.ERR_CLOSE_ELM = 4 ] = "Element: missing closing sequence";
    fluid.XMLP._errs[fluid.XMLP.ERR_CLOSE_ENTITY = 5 ] = "Entity: missing closing sequence";
    fluid.XMLP._errs[fluid.XMLP.ERR_PI_TARGET = 6 ] = "PI: target is required";
    fluid.XMLP._errs[fluid.XMLP.ERR_ELM_EMPTY = 7 ] = "Element: cannot be both empty and closing";
    fluid.XMLP._errs[fluid.XMLP.ERR_ELM_NAME = 8 ] = "Element: name must immediately follow \"<\"";
    fluid.XMLP._errs[fluid.XMLP.ERR_ELM_LT_NAME = 9 ] = "Element: \"<\" not allowed in element names";
    fluid.XMLP._errs[fluid.XMLP.ERR_ATT_VALUES = 10] = "Attribute: values are required and must be in quotes";
    fluid.XMLP._errs[fluid.XMLP.ERR_ATT_LT_NAME = 11] = "Element: \"<\" not allowed in attribute names";
    fluid.XMLP._errs[fluid.XMLP.ERR_ATT_LT_VALUE = 12] = "Attribute: \"<\" not allowed in attribute values";
    fluid.XMLP._errs[fluid.XMLP.ERR_ATT_DUP = 13] = "Attribute: duplicate attributes not allowed";
    fluid.XMLP._errs[fluid.XMLP.ERR_ENTITY_UNKNOWN = 14] = "Entity: unknown entity";
    fluid.XMLP._errs[fluid.XMLP.ERR_INFINITELOOP = 15] = "Infinite loop";
    fluid.XMLP._errs[fluid.XMLP.ERR_DOC_STRUCTURE = 16] = "Document: only comments, processing instructions, or whitespace allowed outside of document element";
    fluid.XMLP._errs[fluid.XMLP.ERR_ELM_NESTING = 17] = "Element: must be nested correctly";


    fluid.XMLP._checkStructure = function(that, iEvent) {
        var stack = that.m_stack;
        if (fluid.XMLP._STATE_PROLOG == that.m_iState) {
            // disabled original check for text node in prologue
            that.m_iState = fluid.XMLP._STATE_DOCUMENT;
        }

        if (fluid.XMLP._STATE_DOCUMENT === that.m_iState) {
            if ((fluid.XMLP._ELM_B == iEvent) || (fluid.XMLP._ELM_EMP == iEvent)) {
                that.m_stack[stack.length] = that.getName();
            }
            if ((fluid.XMLP._ELM_E == iEvent) || (fluid.XMLP._ELM_EMP == iEvent)) {
                if (stack.length === 0) {
                    //return fluid.XMLP._setErr(XMLP.ERR_DOC_STRUCTURE);
                    return fluid.XMLP._NONE;
                }
                var strTop = stack[stack.length - 1];
                that.m_stack.length--;
                if (strTop === null || strTop !== that.getName()) {
                    return fluid.XMLP._setErr(that, fluid.XMLP.ERR_ELM_NESTING);
                }
            }

            // disabled original check for text node in epilogue - "MISC" state is disused
        }
        return iEvent;
    };


    fluid.XMLP._parseCDATA = function(that, iB) {
        var iE = that.m_xml.indexOf("]]>", iB);
        if (iE == -1) { return fluid.XMLP._setErr(that, fluid.XMLP.ERR_CLOSE_CDATA);}
        fluid.XMLP._setContent(that, fluid.XMLP._CONT_XML, iB, iE);
        that.m_iP = iE + 3;
        return fluid.XMLP._CDATA;
    };


    fluid.XMLP._parseComment = function(that, iB) {
        var iE = that.m_xml.indexOf("-" + "->", iB);
        if (iE == -1) {
            return fluid.XMLP._setErr(that, fluid.XMLP.ERR_CLOSE_COMMENT);
            }
        fluid.XMLP._setContent(that, fluid.XMLP._CONT_XML, iB - 4, iE + 3);
        that.m_iP = iE + 3;
        return fluid.XMLP._COMMENT;
    };

    fluid.XMLP._parseDTD = function(that, iB) {
        var iE, strClose, iInt, iLast;
        iE = that.m_xml.indexOf(">", iB);
        if (iE == -1) {
            return fluid.XMLP._setErr(that, fluid.XMLP.ERR_CLOSE_DTD);
        }
        iInt = that.m_xml.indexOf("[", iB);
        strClose = ((iInt != -1) && (iInt < iE)) ? "]>" : ">";
        while (true) {
            if (iE == iLast) {
                return fluid.XMLP._setErr(that, fluid.XMLP.ERR_INFINITELOOP);
            }
            iLast = iE;
            iE = that.m_xml.indexOf(strClose, iB);
            if(iE == -1) {
                return fluid.XMLP._setErr(that, fluid.XMLP.ERR_CLOSE_DTD);
            }
            if (that.m_xml.substring(iE - 1, iE + 2) != "]]>") { break;}
        }
        that.m_iP = iE + strClose.length;
        return fluid.XMLP._DTD;
    };

    fluid.XMLP._parsePI = function(that, iB) {
        var iE, iTB, iTE, iCB, iCE;
        iE = that.m_xml.indexOf("?>", iB);
        if (iE == -1) { return fluid.XMLP._setErr(that, fluid.XMLP.ERR_CLOSE_PI);}
        iTB = fluid.SAXStrings.indexOfNonWhitespace(that.m_xml, iB, iE);
        if (iTB == -1) { return fluid.XMLP._setErr(that, fluid.XMLP.ERR_PI_TARGET);}
        iTE = fluid.SAXStrings.indexOfWhitespace(that.m_xml, iTB, iE);
        if (iTE == -1) { iTE = iE;}
        iCB = fluid.SAXStrings.indexOfNonWhitespace(that.m_xml, iTE, iE);
        if (iCB == -1) { iCB = iE;}
        iCE = fluid.SAXStrings.lastIndexOfNonWhitespace(that.m_xml, iCB, iE);
        if (iCE == -1) { iCE = iE - 1;}
        that.m_name = that.m_xml.substring(iTB, iTE);
        fluid.XMLP._setContent(that, fluid.XMLP._CONT_XML, iCB, iCE + 1);
        that.m_iP = iE + 2;
        return fluid.XMLP._PI;
    };

    fluid.XMLP._parseText = function(that, iB) {
        var iE = that.m_xml.indexOf("<", iB);
        if (iE == -1) { iE = that.m_xml.length;}
        fluid.XMLP._setContent(that, fluid.XMLP._CONT_XML, iB, iE);
        that.m_iP = iE;
        return fluid.XMLP._TEXT;
    };

    fluid.XMLP._setContent = function(that, iSrc) {
        var args = arguments;
        if (fluid.XMLP._CONT_XML == iSrc) {
            that.m_cAlt = null;
            that.m_cB = args[2];
            that.m_cE = args[3];
        }
        else {
            that.m_cAlt = args[2];
            that.m_cB = 0;
            that.m_cE = args[2].length;
        }

        that.m_cSrc = iSrc;
    };

    fluid.XMLP._setErr = function(that, iErr) {
        var strErr = fluid.XMLP._errs[iErr];
        that.m_cAlt = strErr;
        that.m_cB = 0;
        that.m_cE = strErr.length;
        that.m_cSrc = fluid.XMLP._CONT_ALT;
        return fluid.XMLP._ERROR;
    };


    fluid.XMLP._parseElement = function(that, iB) {
        var iE, iDE, iRet;
        var iType, strN, iLast;
        iDE = iE = that.m_xml.indexOf(">", iB);
        if (iE == -1) {
            return fluid.XMLP._setErr(that, fluid.XMLP.ERR_CLOSE_ELM);
        }
        if (that.m_xml.charAt(iB) == "/") {
            iType = fluid.XMLP._ELM_E;
            iB++;
        }
        else {
            iType = fluid.XMLP._ELM_B;
        }
        if (that.m_xml.charAt(iE - 1) == "/") {
            if (iType == fluid.XMLP._ELM_E) {
                return fluid.XMLP._setErr(that, fluid.XMLP.ERR_ELM_EMPTY);
                }
            iType = fluid.XMLP._ELM_EMP; iDE--;
        }

        that.nameRegex.lastIndex = iB;
        var nameMatch = that.nameRegex.exec(that.m_xml);
        if (!nameMatch) {
            return fluid.XMLP._setErr(that, fluid.XMLP.ERR_ELM_NAME);
        }
        strN = nameMatch[1].toLowerCase();
        // This branch is specially necessary for broken markup in IE. If we see an li
        // tag apparently directly nested in another, first emit a synthetic close tag
        // for the earlier one without advancing the pointer, and set a flag to ensure
        // doing this just once.
        if ("li" === strN && iType !== fluid.XMLP._ELM_E && that.m_stack.length > 0 &&
            that.m_stack[that.m_stack.length - 1] === "li" && !that.m_emitSynthetic) {
            that.m_name = "li";
            that.m_emitSynthetic = true;
            return fluid.XMLP._ELM_E;
        }
        // We have acquired the tag name, now set about parsing any attribute list
        that.m_attributes = {};
        that.m_cAlt = "";

        if (that.nameRegex.lastIndex < iDE) {
            that.m_iP = that.nameRegex.lastIndex;
            while (that.m_iP < iDE) {
                that.attrStartRegex.lastIndex = that.m_iP;
                var attrMatch = that.attrStartRegex.exec(that.m_xml);
                if (!attrMatch) {
                    return fluid.XMLP._setErr(that, fluid.XMLP.ERR_ATT_VALUES);
                }
                var attrname = attrMatch[1].toLowerCase();
                var attrval;
                if (that.m_xml.charCodeAt(that.attrStartRegex.lastIndex) === 61) { // =
                    var valRegex = that.m_xml.charCodeAt(that.attrStartRegex.lastIndex + 1) === 34? that.attrValRegex : that.attrValIERegex; // "
                    valRegex.lastIndex = that.attrStartRegex.lastIndex + 1;
                    attrMatch = valRegex.exec(that.m_xml);
                    if (!attrMatch) {
                        return fluid.XMLP._setErr(that, fluid.XMLP.ERR_ATT_VALUES);
                    }
                    attrval = attrMatch[1];
                }
                else { // accommodate insanity on unvalued IE attributes
                    attrval = attrname;
                    valRegex = that.attrStartRegex;
                }
                if (!that.m_attributes[attrname] || that.m_attributes[attrname] === attrval) {
                    // last branch required because of fresh duplicate attribute bug introduced in IE10 and above - FLUID-5204
                    that.m_attributes[attrname] = attrval;
                }
                else {
                    return fluid.XMLP._setErr(that, fluid.XMLP.ERR_ATT_DUP);
                }
                that.m_iP = valRegex.lastIndex;

            }
        }
        if (strN.indexOf("<") != -1) {
            return fluid.XMLP._setErr(that, fluid.XMLP.ERR_ELM_LT_NAME);
        }

        that.m_name = strN;
        that.m_iP = iE + 1;
        // Check for corrupted "closed tags" from innerHTML
        if (fluid.XMLP.closedTags[strN]) {
            that.closeRegex.lastIndex = iE + 1;
            var closeMatch = that.closeRegex.exec;
            if (closeMatch) {
                var matchclose = that.m_xml.indexOf(strN, closeMatch.lastIndex);
                if (matchclose === closeMatch.lastIndex) {
                    return iType; // bail out, a valid close tag is separated only by whitespace
                }
                else {
                    return fluid.XMLP._ELM_EMP;
                }
            }
        }
        that.m_emitSynthetic = false;
        return iType;
    };

    fluid.XMLP._parse = function(that) {
        var iP = that.m_iP;
        var xml = that.m_xml;
        if (iP === xml.length) { return fluid.XMLP._NONE;}
        var c = xml.charAt(iP);
        if (c === '<') {
            var c2 = xml.charAt(iP + 1);
            if (c2 === '?') {
                return fluid.XMLP._parsePI(that, iP + 2);
            }
            else if (c2 === '!') {
                if (iP === xml.indexOf("<!DOCTYPE", iP)) {
                    return fluid.XMLP._parseDTD(that, iP + 9);
                }
                else if (iP === xml.indexOf("<!--", iP)) {
                    return fluid.XMLP._parseComment(that, iP + 4);
                }
                else if (iP === xml.indexOf("<![CDATA[", iP)) {
                    return fluid.XMLP._parseCDATA(that, iP + 9);
                }
            }
            else {
                return fluid.XMLP._parseElement(that, iP + 1);
            }
        }
        else {
            return fluid.XMLP._parseText(that, iP);
        }
    };


    fluid.XMLP.XMLPImpl = function(strXML) {
        var that = {};
        that.m_xml = strXML;
        that.m_iP = 0;
        that.m_iState = fluid.XMLP._STATE_PROLOG;
        that.m_stack = [];
        that.m_attributes = {};
        that.m_emitSynthetic = false; // state used for emitting synthetic tags used to correct broken markup (IE)

        that.getColumnNumber = function() {
            return fluid.SAXStrings.getColumnNumber(that.m_xml, that.m_iP);
        };

        that.getContent = function() {
            return (that.m_cSrc == fluid.XMLP._CONT_XML) ? that.m_xml : that.m_cAlt;
        };

        that.getContentBegin = function() { return that.m_cB;};
        that.getContentEnd = function() { return that.m_cE;};

        that.getLineNumber = function() {
            return fluid.SAXStrings.getLineNumber(that.m_xml, that.m_iP);
        };

        that.getName = function() {
            return that.m_name;
        };

        that.next = function() {
            return fluid.XMLP._checkStructure(that, fluid.XMLP._parse(that));
        };

        that.nameRegex = /([^\s\/>]+)/g;
        that.attrStartRegex = /\s*([\w:_][\w:_\-\.]*)/gm;
        that.attrValRegex = /\"([^\"]*)\"\s*/gm; // "normal" XHTML attribute values
        that.attrValIERegex = /([^\>\s]+)\s*/gm; // "stupid" unquoted IE attribute values (sometimes)
        that.closeRegex = /\s*<\//g;

        return that;
    };


    fluid.SAXStrings = {};

    fluid.SAXStrings.WHITESPACE = " \t\n\r";
    fluid.SAXStrings.QUOTES = "\"'";
    fluid.SAXStrings.getColumnNumber = function (strD, iP) {
        if (!strD) { return -1;}
        iP = iP || strD.length;
        var arrD = strD.substring(0, iP).split("\n");
        arrD.length--;
        var iLinePos = arrD.join("\n").length;
        return iP - iLinePos;
    };

    fluid.SAXStrings.getLineNumber = function (strD, iP) {
        if (!strD) { return -1;}
        iP = iP || strD.length;
        return strD.substring(0, iP).split("\n").length;
    };

    fluid.SAXStrings.indexOfNonWhitespace = function (strD, iB, iE) {
        if (!strD) return -1;
        iB = iB || 0;
        iE = iE || strD.length;

        for (var i = iB; i < iE; ++ i) {
            var c = strD.charAt(i);
            if (c !== ' ' && c !== '\t' && c !== '\n' && c !== '\r') return i;
        }
        return -1;
    };


    fluid.SAXStrings.indexOfWhitespace = function (strD, iB, iE) {
        if (!strD) { return -1;}
        iB = iB || 0;
        iE = iE || strD.length;
        for (var i = iB; i < iE; i++) {
            if (fluid.SAXStrings.WHITESPACE.indexOf(strD.charAt(i)) != -1) { return i;}
        }
        return -1;
    };


    fluid.SAXStrings.lastIndexOfNonWhitespace = function (strD, iB, iE) {
        if (!strD) { return -1;}
        iB = iB || 0; iE = iE || strD.length;
        for (var i = iE - 1; i >= iB; i--) {
        if (fluid.SAXStrings.WHITESPACE.indexOf(strD.charAt(i)) == -1) {
            return i;
            }
        }
        return -1;
    };

    fluid.SAXStrings.replace = function(strD, iB, iE, strF, strR) {
        if (!strD) { return "";}
        iB = iB || 0;
        iE = iE || strD.length;
        return strD.substring(iB, iE).split(strF).join(strR);
    };

})(fluid_3_0_0);
