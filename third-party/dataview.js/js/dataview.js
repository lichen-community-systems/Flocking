
(function () {
    "use strict";

    var nativeDataView = typeof (window.DataView) !== "undefined" ? window.DataView : undefined;
    
    var addNonStandardMethods = function (that) {
        that.getString = function (l, o, isLittle) {
            o = typeof (o) === "number" ? o : that.polyOffset;
            
            var s = "",
                i,
                c;
                
			for (i = 0; i < l; ++i) {
				c = that.getUint8(o + i, isLittle);
				s += String.fromCharCode(c > 127 ? 65533 : c);
			}
			
			that.polyOffset = o + l;
			
			return s;
        };
        
        that.getFloat80 = function (o, isLittle) {
            o = typeof (o) === "number" ? o : that.polyOffset;
            
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
            
            that.polyOffset = o + 10;
            
            return sign * value;
            //
        };        
    };
    
    var polyDataView = function (buffer, offset, length) {
        var that = {
            buffer: buffer,
            polyOffset: typeof(offset) === "number" ? offset : 0,
            polyU8Buf: new Uint8Array(buffer)
        };
        
        that.getUint = function (l, o, isLittle) {
            o = typeof (o) === "number" ? o : that.polyOffset;
            
            var last = l - 1,
                n = 0,
                pow = Math.pow,
                v,
                i;
            
            if (isLittle){
                for (i = 0; i < l; i++){
                    v = that.getUint8();
                    n += v * pow(256, i);
                }
            } else {
                for (i = 0; i < l; i++){
                    v = that.getUint8();
                    n += v * pow(256, last - i);
                }
            }
            
            return n;
        };
        
        that.getInt = function (l, o, isLittle) {
            var mask = Math.pow(256, l),
                n = that.getUint(l, o, isLittle);
                
            return n > (mask / 2) - 1 ? n - mask : n;
        };
         
        that.getUint8 = function (o, isLittle) {
            o = typeof (o) === "number" ? o : that.polyOffset;
            
            var n = that.polyU8Buf[o];
            that.polyOffset = o + 1;
            
            return n;
        };
        
        that.getInt8 = function (o, isLittle) {
            return that.getInt(1, o, isLittle);
        };
        
        that.getUint16 = function (o, isLittle) {
            return that.getUint(2, o, isLittle);
        };
        
        that.getInt16 = function (o, isLittle) {
            return that.getInt(2, o, isLittle);
        };
        
        that.getUint32 = function (o, isLittle) {
            return that.getUint(4, o, isLittle);
        };
        
        that.getInt32 = function (o, isLittle) {
            return that.getInt(4, o, isLittle);
        };
        
        that.getFloat32 = function (o, isLittle) {
            o = typeof (o) === "number" ? o : that.polyOffset;
            
            that.polyOffset = o + 4;
            return 0; // TODO: Implement me!
        };
        
        that.getFloat64 = function (o, isLittle) {
            o = typeof (o) === "number" ? o : that.polyOffset;
            
            that.polyOffset = o + 4;
            return 0; // TODO: Implement me!
        };
        
        addNonStandardMethods(that);
        return that;
    };
    
    var wrappedDataView = function (buffer, offset, length) {
        var that = {
            buffer: buffer,
            dv: new nativeDataView(buffer, offset, length)
        };
        
        that.polyOffset = typeof(offset) === "number" ? offset : 0;
        
        that.getUint = function (l, o, isLittle) {
            o = typeof (o) === "number" ? o : that.polyOffset;
            
            var bits = l * 8,
                n;
            
            n = that.dv["getUint" + bits](o, isLittle);
            that.polyOffset = o + l;
            
            return n;
        };
        
        that.getInt = function (l, o, isLittle) {
            o = typeof (o) === "number" ? o : that.polyOffset;
            
            var bits = l * 8,
                n;
            
            n = that.dv["getInt" + bits](o, isLittle);
            that.polyOffset = o + l;
            
            return n;  
        };
        
        that.getUint8 = function (o, isLittle) {
            o = typeof (o) === "number" ? o : that.polyOffset;
            
            var n = that.dv.getUint8(o, isLittle);
            that.polyOffset = o + 1;
            
            return n;
        };
        
        that.getInt8 = function (o, isLittle) {
            o = typeof (o) === "number" ? o : that.polyOffset;
            
            var n = that.dv.getInt8(o, isLittle);
            that.polyOffset = o + 1;
            
            return n;
        };
        
        that.getUint16 = function (o, isLittle) {
            o = typeof (o) === "number" ? o : that.polyOffset;
            
            var n = that.dv.getUint16(o, isLittle);
            that.polyOffset = o + 2;
            
            return n;            
        };
        
        that.getInt16 = function (o, isLittle) {
            o = typeof (o) === "number" ? o : that.polyOffset;
            
            var n = that.dv.getInt16(o, isLittle);
            that.polyOffset = o + 2;
            
            return n;
        };
        
        that.getUint32 = function (o, isLittle) {
            o = typeof (o) === "number" ? o : that.polyOffset;
            
            var n = that.dv.getUint32(o, isLittle);
            that.polyOffset = o + 4;
            
            return n;
        };
        
        that.getInt32 = function (o, isLittle) {
            o = typeof (o) === "number" ? o : that.polyOffset;
            
            var n = that.dv.getInt32(o, isLittle);
            that.polyOffset = o + 4;
            
            return n;            
        };
        
        that.getFloat32 = function (o, isLittle) {
            o = typeof (o) === "number" ? o : that.polyOffset;
            
            var n = that.dv.getFloat32(o, isLittle);
            that.polyOffset = o + 4;
            
            return n;
        };
        
        that.getFloat64 = function (o, isLittle) {
            o = typeof (o) === "number" ? o : that.polyOffset;
            
            var n = that.dv.getFloat64(o, isLittle);
            that.polyOffset = o + 8;
            
            return n;
        };
        
        addNonStandardMethods(that);
        return that;
    };
    
    window.DataView = nativeDataView ? wrappedDataView : polyDataView;
}());
