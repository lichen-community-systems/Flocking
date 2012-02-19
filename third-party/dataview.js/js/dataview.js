
(function () {
    "use strict";

    var nativeDataView = typeof (window.DataView) !== "undefined" ? window.DataView : undefined;
    
    var addSharedMethods = function (that) {
        that.getString = function (l, w, o, isLittle) {
            var s = "",
                i,
                c;
                
            for (i = 0; i < l; ++i) {
                c = that.getUint(w, o, isLittle);
                if (c > 0xFFFF) {
                    c -= 0x10000;
                    s += String.fromCharCode(0xD800 + (c >> 10), 0xDC00 + (c & 0x3FF));
                }  else {
                    s += String.fromCharCode(c);
                }
            }
            
            return s;
        };

        that.getFloat80 = function (o, isLittle) {
            o = typeof (o) === "number" ? o : that.offset;
            
            // From Joe
            var expon = that.getUint(2, o, isLittle), 
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

            if (expon == hi == lo == 0) {
                value = 0;
            } else if (expon == 0x7FFF) {
                value = Number.MAX_VALUE;
            } else {
                expon -= 16383;
                value = (hi * 0x100000000 + lo) * Math.pow(2, expon - 63);
            }
            
            that.offset = o + 10;
            
            return sign * value;
            //
        }; 
    };
    
    var polyDataView = function (buffer, offset, length) {
        var that = {
            buffer: buffer,
            offset: typeof(offset) === "number" ? offset : 0,
            u8Buf: new Uint8Array(buffer),
            quickArray: []
        };
        that.length = that.u8Buf.length;
        
        that.getUints = function (l, w, o, isLittle, array) {
            o = typeof (o) === "number" ? o : that.offset;
            array = array || new window["Uint" + (w * 8) + "Array"](l);
            var last = w - 1,
                n = 0,
                v,
                i, 
                j,
                dump;

            if (isLittle) {
                for (i = 0; i < l; i++) {
                    n = 0;
                    for (j = 0, dump = 1; j < w; j++, dump *= 256) {
                        v = that.u8Buf[o];
                        n += v * dump;
                        o++;
                    }

                    array[i] = n;
                }
            } else {
                for (i = 0; i < l; i++) {
                    n = 0;
                    for (j = 0, dump = Math.pow(256, last); j < w; j++, dump /= 256){
                        v = that.u8Buf[o];
                        n += v * dump;
                        o++;
                    }
                    array[i] = n;
                }
            }

            that.offset = o;

            return array;
        };

        that.getInts = function (l, w, o, isLittle, array) {
            // TODO: Complete cut and paste job from getUints()!
            o = typeof (o) === "number" ? o : that.offset;
            array = array || new window["Int" + (w * 8) + "Array"](l);
            var last = w - 1,
                n = 0,
                pow = Math.pow,
                mask = pow(256, w),
                halfMask = (mask / 2) - 1,
                v,
                i, 
                j,
                dump;

            if (isLittle) {
                for (i = 0; i < l; i++) {
                    n = 0;
                    for (j = 0, dump = 1; j < w; j++, dump *= 256) {
                        v = that.u8Buf[o];
                        n += v * dump;
                        o++;
                    }
                
                    array[i] = n > halfMask ? n - mask : n;
                }
            } else {
                for (i = 0; i < l; i++) {
                    n = 0;
                    for (j = 0, dump = Math.pow(256, last); j < w; j++, dump /= 256){
                        v = that.u8Buf[o];
                        n += v * dump;
                        o++;
                    }
                    array[i] = n > halfMask ? n - mask : n;
                }
            }
            
            that.offset = o;

            return array;
        };
        
        that.getFloats = function (l, w, o, isLittle, array) {
            var bits = w * 8,
                getterName = "getFloat" + bits,
                i;
            
            array = array || new window["Float" + bits + "Array"](l);
            
            for (i = 0; i < l; i++) {
                array[i] = that[getterName](o, isLittle);
            }
            
            return array;
        };
        
        that.getUint = function (w, o, isLittle) {
            return that.getUints(1, w, o, isLittle, that.quickArray)[0];
        };
        
        that.getInt = function (w, o, isLittle) {
            return that.getInts(1, w, o, isLittle, that.quickArray)[0];
        };
         
        that.getUint8 = function (o, isLittle) {
            o = typeof (o) === "number" ? o : that.offset;
            
            var n = that.u8Buf[o];
            that.offset = o + 1;
            
            return n;
        };
        
        that.getInt8 = function (o, isLittle) {
            return that.getInts(1, 1, o, isLittle, that.quickArray)[0];            
        };
        
        that.getUint16 = function (o, isLittle) {
            return that.getUints(1, 2, o, isLittle, that.quickArray)[0];            
        };
        
        that.getInt16 = function (o, isLittle) {
            return that.getInts(1, 2, o, isLittle, that.quickArray)[0];            
        };
        
        that.getUint32 = function (o, isLittle) {
            return that.getUints(1, 4, o, isLittle, that.quickArray)[0];
        };
        
        that.getInt32 = function (o, isLittle) {
            return that.getInts(1, 4, o, isLittle, that.quickArray)[0];            
        };
        
        that.getFloat32 = function (o, isLittle) {
            o = typeof (o) === "number" ? o : that.offset;
            
            that.offset = o + 4;
            return 0; // TODO: Implement me!
        };
        
        that.getFloat64 = function (o, isLittle) {
            o = typeof (o) === "number" ? o : that.offset;
            
            that.offset = o + 4;
            return 0; // TODO: Implement me!
        };
        
        addSharedMethods(that);
        return that;
    };
    
    var wrappedDataView = function (buffer, offset, length) {
        var that = {
            buffer: buffer,
            offset: typeof(offset) === "number" ? offset : 0,
            dv: new nativeDataView(buffer, offset, length),
            length: new Uint8Array(buffer).length
        };
                
        that.getUint = function (w, o, isLittle) {
            o = typeof (o) === "number" ? o : that.offset;
            
            var n = that.dv["getUint" + (w * 8)](o, isLittle);
            that.offset = o + w;
            
            return n;
        };
        
        that.getInt = function (w, o, isLittle) {
            o = typeof (o) === "number" ? o : that.offset;

            var n = that.dv["getInt" + (w * 8)](o, isLittle);
            that.offset = o + w;
            
            return n;  
        };
        
        var getBytes = function (type, l, w, o, isLittle, array) {
            var bits = (w * 8),
                typeSize = type + bits,
                dv = that.dv,
                getterName = "get" + typeSize,
                i;
                
            array = array || new window[typeSize + "Array"](l);
            o = typeof (o) === "number" ? o : that.offset;
            
            for (i = 0; i < l; i++) {
                array[i] = dv[getterName](o, isLittle);
                o += w;
            }
            
            that.offset = o;

            return array;
        };
        
        that.getUints = function (l, w, o, isLittle, array) {
            return getBytes("Uint", l, w, o, isLittle, array);
        };
        
        that.getInts = function (l, w, o, isLittle, array) {
            return getBytes("Int", l, w, o, isLittle, array);
        };
        
        that.getFloats = function (l, w, o, isLittle, array) {
            return getBytes("Float", l, w, o, isLittle, array);
        };
        
        that.getUint8 = function (o, isLittle) {
            o = typeof (o) === "number" ? o : that.offset;
            
            var n = that.dv.getUint8(o, isLittle);
            that.offset = o + 1;
            
            return n;
        };
        
        that.getInt8 = function (o, isLittle) {
            o = typeof (o) === "number" ? o : that.offset;
            
            var n = that.dv.getInt8(o, isLittle);
            that.offset = o + 1;
            
            return n;
        };
        
        that.getUint16 = function (o, isLittle) {
            o = typeof (o) === "number" ? o : that.offset;
            
            var n = that.dv.getUint16(o, isLittle);
            that.offset = o + 2;
            
            return n;            
        };
        
        that.getInt16 = function (o, isLittle) {
            o = typeof (o) === "number" ? o : that.offset;
            
            var n = that.dv.getInt16(o, isLittle);
            that.offset = o + 2;
            
            return n;
        };
        
        that.getUint32 = function (o, isLittle) {
            o = typeof (o) === "number" ? o : that.offset;
            
            var n = that.dv.getUint32(o, isLittle);
            that.offset = o + 4;
            
            return n;
        };
        
        that.getInt32 = function (o, isLittle) {
            o = typeof (o) === "number" ? o : that.offset;
            
            var n = that.dv.getInt32(o, isLittle);
            that.offset = o + 4;
            
            return n;            
        };
        
        that.getFloat32 = function (o, isLittle) {
            o = typeof (o) === "number" ? o : that.offset;
            
            var n = that.dv.getFloat32(o, isLittle);
            that.offset = o + 4;
            
            return n;
        };
        
        that.getFloat64 = function (o, isLittle) {
            o = typeof (o) === "number" ? o : that.offset;
            
            var n = that.dv.getFloat64(o, isLittle);
            that.offset = o + 8;
            
            return n;
        };
        
        addSharedMethods(that);
        return that;
    };
    
    window.polyDataView = nativeDataView ? wrappedDataView : polyDataView;
}());
