/*!
* PolyDataView, a better polyfill for DataView.
* http://github.com/colinbdclark/PolyDataView
*
* Copyright 2012, Colin Clark
* Dual licensed under the MIT and GPL Version 2 licenses.
*
* Contributions:
*   - getFloat32 and getFloat64, Copyright 2011 Christopher Chedeau
*   - getFloat80, Copyright 2011 Joe Turner
*/

/*global window, ArrayBuffer, Uint8Array, Uint32Array*/
/*jslint white: true, funcinvoke: true, undef: true, newcap: false, regexp: true, browser: true,
    forin: true, continue: true, forvar: true, nomen: true, maxerr: 100, indent: 4 */

/*
 * To Do:
 *  - Finish unit tests for getFloat80() and the various array getters.
 */
 
(function () {
    "use strict";

    var nativeDataView = typeof (window.DataView) !== "undefined" ? window.DataView : undefined; 
    
    var isHostLittleEndian = (function () {
        var endianTest = new ArrayBuffer(4),
            u8View = new Uint8Array(endianTest),
            u32View = new Uint32Array(endianTest);
            
        u8View[0] = 0x01;
        u8View[1] = 0x02;
        u8View[2] = 0x03;
        u8View[3] = 0x04;

        return u32View[0] === 0x04030201;
    }());
    
    
    var addSharedMethods = function (that) {
        
        /**
         * Non-standard
         */
        that.getString = function (len, w, o, isL) {
            o = typeof (o) === "number" ? o : that.offsetState;
            
            var s = "",
                i,
                c;
            
            for (i = 0; i < len; i++) {
                c = that.getUint(w, o, isL);
                if (c > 0xFFFF) {
                    c -= 0x10000;
                    s += String.fromCharCode(0xD800 + (c >> 10), 0xDC00 + (c & 0x3FF));
                } else {
                    s += String.fromCharCode(c);
                }
                o = o + w;
            }
            
            return s;
        };

        /**
         * Non-standard
         */
        that.getFloat80 = function (o, isL) {
            o = typeof (o) === "number" ? o : that.offsetState;
            
            // This method is a modified version of Joe Turner's implementation of an "extended" float decoder,
            // originally licensed under the WTF license.
            // https://github.com/oampo/audiofile.js/blob/master/audiofile.js
            var expon = that.getUint(2, o, isL),
                hi = that.getUint(4, o + 2),
                lo = that.getUint(4, o + 6),
                rng = 1 << (16 - 1), 
                sign = 1,
                value;
                
            if (expon >= rng) {
                expon |= ~(rng - 1);
            }

            if (expon < 0) {
                sign = -1;
                expon += rng;
            }

            if (expon === hi === lo === 0) {
                value = 0;
            } else if (expon === 0x7FFF) {
                value = Number.MAX_VALUE;
            } else {
                expon -= 16383;
                value = (hi * 0x100000000 + lo) * Math.pow(2, expon - 63);
            }
            
            that.offsetState = o + 10;
            
            return sign * value;
        }; 
    };
    
    var PolyDataView = function (buffer, byteOffset, byteLength) {
        var cachedArray = [];
        
        var that = {
            buffer: buffer,
            byteOffset: typeof (byteOffset) === "number" ? byteOffset : 0
        };
        that.byteLength = typeof (byteLength) === "number" ? byteLength : buffer.byteLength - that.byteOffset;
        
        // Bail if we're trying to read off the end of the buffer.
        if (that.byteOffset > buffer.byteLength || that.byteOffset + that.byteLength > buffer.byteLength) {
            throw new Error("INDEX_SIZE_ERR: DOM Exception 1");
        }
        
        /**
         * Non-standard
         */
        that.u8Buf = new Uint8Array(buffer, that.byteOffset, that.byteLength);
        
        /**
         * Non-standard
         */
        that.offsetState = that.byteOffset;
        
        /**
         * Non-standard
         */
        that.getUints = function (len, w, o, isL, array) {
            // TODO: Complete cut and paste job from getInts()!
            o = typeof (o) === "number" ? o : that.offsetState;
            if (o + (len * w) > that.u8Buf.length) {
                throw new Error("INDEX_SIZE_ERR: DOM Exception 1");
            }
            
            that.offsetState = o + (len * w);
            var arrayType = window["Uint" + (w * 8) + "Array"];
            
            if (len > 1 && isHostLittleEndian === isL) {
                return new arrayType(that.buffer, o, len);
            }
            
            array = array || new arrayType(len);
            var startByte, 
                idxInc,
                i,
                idx,
                n,
                j,
                scale,
                v;

            if (isL) {
                startByte = 0;
                idxInc = 1;
            } else {
                startByte = w - 1;
                idxInc = -1;
            }
            
            for (i = 0; i < len; i++) {
                idx = o + (i * w) + startByte;
                n = 0;
                for (j = 0, scale = 1; j < w; j++, scale *= 256) {
                    v = that.u8Buf[idx];
                    n += v * scale;
                    idx += idxInc;
                }
                array[i] = n;
            }
            
            return array;
        };
        
        /**
         * Non-standard
         */
        that.getInts = function (len, w, o, isL, array) {
            o = typeof (o) === "number" ? o : that.offsetState;
            if (o + (len * w) > that.u8Buf.length) {
                throw new Error("INDEX_SIZE_ERR: DOM Exception 1");
            }
            
            that.offsetState = o + (len * w);
            var arrayType = window["Int" + (w * 8) + "Array"];
                        
            // If the host's endianness matches the file's, just use a typed array view directly.
            if (len > 1 && isHostLittleEndian === isL) {
                return new arrayType(that.buffer, o, len);
            }
            
            array = array || new arrayType(len);
            var mask = Math.pow(256, w),
                halfMask = (mask / 2) - 1,
                startByte, 
                idxInc,
                i,
                idx,
                n,
                j,
                scale,
                v;

            if (isL) {
                startByte = 0;
                idxInc = 1;
            } else {
                startByte = w - 1;
                idxInc = -1;
            }
            
            for (i = 0; i < len; i++) {
                idx = o + (i * w) + startByte;
                n = 0;
                for (j = 0, scale = 1; j < w; j++, scale *= 256) {
                    v = that.u8Buf[idx];
                    n += v * scale;
                    idx += idxInc;
                }
                array[i] = n > halfMask ? n - mask : n;
            }
            
            return array;
        };
        
        /**
         * Non-standard
         */
        that.getFloats = function (len, w, o, isL, array) {
            var bits = w * 8,
                getterName = "getFloat" + bits,
                arrayType = window["Float" + bits + "Array"],
                i;
            
            // If the host's endianness matches the file's, just use a typed array view directly.
            if (len > 1 && isHostLittleEndian === isL) {
                o = typeof (o) === "number" ? o : that.offsetState;
                if (o + (len * w) > that.u8Buf.length) {
                    throw new Error("INDEX_SIZE_ERR: DOM Exception 1");
                }
                that.offsetState = o + (len * w);
                return new arrayType(that.buffer, o, len);
            }
            
            array = array || new arrayType(len);
            
            for (i = 0; i < len; i++) {
                array[i] = that[getterName](o, isL);
            }
            
            return array;
        };
        
        /**
         * Non-standard
         */
        that.getUint = function (w, o, isL) {
            return w === 1 ? that.getUint8(o, isL) : that.getUints(1, w, o, isL, cachedArray)[0];
        };
        
        /**
         * Non-standard
         */
        that.getInt = function (w, o, isL) {
            return that.getInts(1, w, o, isL, cachedArray)[0];
        };
         
        that.getUint8 = function (o) {
            o = typeof (o) === "number" ? o : that.offsetState;
            
            var n = that.u8Buf[o];
            that.offsetState = o + 1;
            
            return n;
        };
        
        that.getInt8 = function (o, isL) {
            return that.getInts(1, 1, o, isL, cachedArray)[0];
        };
        
        that.getUint16 = function (o, isL) {
            return that.getUints(1, 2, o, isL, cachedArray)[0];
        };
        
        that.getInt16 = function (o, isL) {
            return that.getInts(1, 2, o, isL, cachedArray)[0];
        };
        
        that.getUint32 = function (o, isL) {
            return that.getUints(1, 4, o, isL, cachedArray)[0];
        };
        
        that.getInt32 = function (o, isL) {
            return that.getInts(1, 4, o, isL, cachedArray)[0];
        };
        
        that.getFloat32 = function (o, isL) {
            // This method is a modified version of Christopher Chedeau's Float32 decoding
            // implementation from jDataView, originally distributed under the WTF license.
            // https://github.com/vjeux/jDataView
            var bytes = that.getUints(4, 1, o, isL),
                b0,
                b1,
                b2,
                b3,
                sign,
                exp,
                mant;
            
            if (isL) {
                b0 = bytes[3];
                b1 = bytes[2];
                b2 = bytes[1];
                b3 = bytes[0];
            } else {
                b0 = bytes[0];
                b1 = bytes[1];
                b2 = bytes[2];
                b3 = bytes[3];
            }
                
            sign = 1 - (2 * (b0 >> 7));
            exp = (((b0 << 1) & 255) | (b1 >> 7)) - 127;
            mant = ((b1 & 127) * 65536) | (b2 * 256) | b3;
            
            if (exp === 128) {
                return mant !== 0 ? NaN : sign * Infinity;
            }
            
            if (exp === -127) {
                return sign * mant * 1.401298464324817e-45;
            }
            
            return sign * (1 + mant * 1.1920928955078125e-7) * Math.pow(2, exp);
        };
        
        that.getFloat64 = function (o, isL) {
            // This method is a modified version of Christopher Chedeau's Float64 decoding
            // implementation from jDataView, originally distributed under the WTF license.
            // https://github.com/vjeux/jDataView
            var bytes = that.getUints(8, 1, o, isL),
                b0,
                b1,
                b2,
                b3,
                b4,
                b5,
                b6,
                b7,
                sign,
                exp,
                mant;
            
            if (isL) {
                b0 = bytes[7];
                b1 = bytes[6];
                b2 = bytes[5];
                b3 = bytes[4];
                b4 = bytes[3];
                b5 = bytes[2];
                b6 = bytes[1];
                b7 = bytes[0];
            } else {
                b0 = bytes[0];
                b1 = bytes[1];
                b2 = bytes[2];
                b3 = bytes[3];
                b4 = bytes[4];
                b5 = bytes[5];
                b6 = bytes[6];
                b7 = bytes[7];
            }
            
            sign = 1 - (2 * (b0 >> 7));
            exp = ((((b0 << 1) & 255) << 3) | (b1 >> 4)) - 1023;
            mant = ((b1 & 15) * 281474976710656) + (b2 * 1099511627776) + (b3 * 4294967296) + 
                (b4 * 16777216) + (b5 * 65536) + (b6 * 256) + b7;
                                
            if (exp === 1024) {
                return mant !== 0 ? NaN : sign * Infinity;
            }

            if (exp === -1023) {
                return sign * mant * 5e-324;
            }

            return sign * (1 + mant * 2.220446049250313e-16) * Math.pow(2, exp);
        };
        
        addSharedMethods(that);
        return that;
    };
    
    var wrappedDataView = function (buffer, byteOffset, byteLength) {
        var that = {
            buffer: buffer,
            byteOffset: typeof (byteOffset) === "number" ? byteOffset : 0
        };
        that.byteLength = typeof (byteLength) === "number" ? byteLength : buffer.byteLength - that.byteOffset;
        
        /**
         * Non-standard
         */
        that.dv = new nativeDataView(buffer, that.byteOffset, that.byteLength);
        
        /**
         * Non-standard
         */
        that.offsetState = that.byteOffset;
        
        /**
         * Non-standard
         */
        that.getUint = function (w, o, isL) {
            o = typeof (o) === "number" ? o : that.offsetState;
            
            var n = that.dv["getUint" + (w * 8)](o, isL);
            that.offsetState = o + w;
            
            return n;
        };
        
        /**
         * Non-standard
         */
        that.getInt = function (w, o, isL) {
            o = typeof (o) === "number" ? o : that.offsetState;

            var n = that.dv["getInt" + (w * 8)](o, isL);
            that.offsetState = o + w;
            
            return n;  
        };
        
        /**
         * Non-standard
         */
        var getBytes = function (type, len, w, o, isL, array) {
            var bits = w * 8,
                typeSize = type + bits,
                dv = that.dv,
                getterName = "get" + typeSize,
                i;
                
            array = array || new window[typeSize + "Array"](len);
            o = typeof (o) === "number" ? o : that.offsetState;
            
            for (i = 0; i < len; i++) {
                array[i] = dv[getterName](o, isL);
                o += w;
            }
            
            that.offsetState = o;

            return array;
        };
        
        /**
         * Non-standard
         */
        that.getUints = function (len, w, o, isL, array) {
            return getBytes("Uint", len, w, o, isL, array);
        };
        
        /**
         * Non-standard
         */
        that.getInts = function (len, w, o, isL, array) {
            return getBytes("Int", len, w, o, isL, array);
        };
        
        /**
         * Non-standard
         */
        that.getFloats = function (len, w, o, isL, array) {
            return getBytes("Float", len, w, o, isL, array);
        };
        
        that.getUint8 = function (o) {
            o = typeof (o) === "number" ? o : that.offsetState;
            
            var n = that.dv.getUint8(o);
            that.offsetState = o + 1;
            
            return n;
        };
        
        that.getInt8 = function (o) {
            o = typeof (o) === "number" ? o : that.offsetState;
            
            var n = that.dv.getInt8(o);
            that.offsetState = o + 1;
            
            return n;
        };
        
        that.getUint16 = function (o, isL) {
            o = typeof (o) === "number" ? o : that.offsetState;
            
            var n = that.dv.getUint16(o, isL);
            that.offsetState = o + 2;
            
            return n;            
        };
        
        that.getInt16 = function (o, isL) {
            o = typeof (o) === "number" ? o : that.offsetState;
            
            var n = that.dv.getInt16(o, isL);
            that.offsetState = o + 2;
            
            return n;
        };
        
        that.getUint32 = function (o, isL) {
            o = typeof (o) === "number" ? o : that.offsetState;
            
            var n = that.dv.getUint32(o, isL);
            that.offsetState = o + 4;
            
            return n;
        };
        
        that.getInt32 = function (o, isL) {
            o = typeof (o) === "number" ? o : that.offsetState;
            
            var n = that.dv.getInt32(o, isL);
            that.offsetState = o + 4;
            
            return n;            
        };
        
        that.getFloat32 = function (o, isL) {
            o = typeof (o) === "number" ? o : that.offsetState;
            
            var n = that.dv.getFloat32(o, isL);
            that.offsetState = o + 4;
            
            return n;
        };
        
        that.getFloat64 = function (o, isL) {
            o = typeof (o) === "number" ? o : that.offsetState;
            
            var n = that.dv.getFloat64(o, isL);
            that.offsetState = o + 8;
            
            return n;
        };
        
        addSharedMethods(that);
        return that;
    };
    
    window.PolyDataView = nativeDataView ? wrappedDataView : PolyDataView;
}());
