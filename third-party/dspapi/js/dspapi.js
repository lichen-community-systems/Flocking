// -*- mode: javascript; tab-width: 2; indent-tabs-mode: nil; -*-

//------------------------------------------------------------------------------
// DSP API - JavaScript shim
//
// Copyright (C) 2012 Marcus Geelnard
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
// IN THE SOFTWARE.
//------------------------------------------------------------------------------

"use strict";


//------------------------------------------------------------------------------
// interface DSP
//------------------------------------------------------------------------------

(function () {

    var g = typeof (window) !== "undefined" ? window : typeof (self) !== "undefined" ? self : global;

    (function () {
      if (g.DSP) return;

      var DSP = {};

      DSP.add = function (dst, x, y) {
        var k;
        if (y instanceof Float32Array)
          for (k = Math.min(dst.length, x.length, y.length) - 1; k >= 0; --k)
            dst[k] = x[k] + y[k];
        else
          for (k = Math.min(dst.length, x.length) - 1; k >= 0; --k)
            dst[k] = x[k] + y;
      };

      DSP.sub = function (dst, x, y) {
        var k;
        if (y instanceof Float32Array)
          for (k = Math.min(dst.length, x.length, y.length) - 1; k >= 0; --k)
            dst[k] = x[k] - y[k];
        else
          for (k = Math.min(dst.length, x.length) - 1; k >= 0; --k)
            dst[k] = x[k] - y;
      };

      DSP.mul = function (dst, x, y) {
        var k;
        if (y instanceof Float32Array)
          for (k = Math.min(dst.length, x.length, y.length) - 1; k >= 0; --k)
            dst[k] = x[k] * y[k];
        else
          for (k = Math.min(dst.length, x.length) - 1; k >= 0; --k)
            dst[k] = x[k] * y;
      };

      DSP.mulCplx = function (dstReal, dstImag, xReal, xImag, yReal, yImag) {
        var k, xr, xi, yr, yi;
        if (yReal instanceof Float32Array)
          for (k = Math.min(dstReal.length, dstImag.length, xReal.length, xImag.length, yReal.length, yImag.length) - 1; k >= 0; --k) {
            xr = xReal[k], xi = xImag[k], yr = yReal[k], yi = yImag[k];
            dstReal[k] = xr * yr - xi * yi;
            dstImag[k] = xr * yi + xi * yr;
          }
        else
          for (k = Math.min(dstReal.length, dstImag.length, xReal.length, xImag.length) - 1; k >= 0; --k) {
            xr = xReal[k], xi = xImag[k];
            dstReal[k] = xr * yReal - xi * yImag;
            dstImag[k] = xr * yImag + xi * yReal;
          }
      };

      DSP.div = function (dst, x, y) {
        var k;
        if (y instanceof Float32Array)
          for (k = Math.min(dst.length, x.length, y.length) - 1; k >= 0; --k)
            dst[k] = x[k] / y[k];
        else
          for (k = Math.min(dst.length, x.length) - 1; k >= 0; --k)
            dst[k] = x[k] / y;
      };

      DSP.divCplx = function (dstReal, dstImag, xReal, xImag, yReal, yImag) {
        var k, xr, xi, yr, yi, denom;
        if (yReal instanceof Float32Array)
          for (k = Math.min(dstReal.length, dstImag.length, xReal.length, xImag.length, yReal.length, yImag.length) - 1; k >= 0; --k) {
            xr = xReal[k], xi = xImag[k], yr = yReal[k], yi = yImag[k];
            denom = 1 / (yr * yr + yi * yi);
            dstReal[k] = (xr * yr + xi * yi) * denom;
            dstImag[k] = (xi * yr - xr * yi) * denom;
          }
        else {
          denom = 1 / (yReal * yReal + yImag * yImag);
          for (k = Math.min(dstReal.length, dstImag.length, xReal.length, xImag.length) - 1; k >= 0; --k) {
            xr = xReal[k], xi = xImag[k];
            dstReal[k] = (xr * yReal + xi * yImag) * denom;
            dstImag[k] = (xi * yReal - xr * yImag) * denom;
          }
        }
      };

      DSP.madd = function (dst, x, y, z) {
        var k;
        if (z instanceof Float32Array)
          for (k = Math.min(dst.length, x.length, y.length, z.length) - 1; k >= 0; --k)
            dst[k] = x[k] + y[k] * z[k];
        else
          for (k = Math.min(dst.length, x.length) - 1; k >= 0; --k)
            dst[k] = x[k] + y[k] * z;
      };

      DSP.abs = function (dst, x) {
        for (var k = Math.min(dst.length, x.length) - 1; k >= 0; --k)
          dst[k] = Math.abs(x[k]);
      };

      DSP.absCplx = function (dst, real, imag) {
        for (var k = Math.min(dst.length, real.length, imag.length) - 1; k >= 0; --k)
          dst[k] = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]);
      };

      DSP.acos = function (dst, x) {
        for (var k = Math.min(dst.length, x.length) - 1; k >= 0; --k)
          dst[k] = Math.acos(x[k]);
      };

      DSP.asin = function (dst, x) {
        for (var k = Math.min(dst.length, x.length) - 1; k >= 0; --k)
          dst[k] = Math.asin(x[k]);
      };

      DSP.atan = function (dst, x) {
        for (var k = Math.min(dst.length, x.length) - 1; k >= 0; --k)
          dst[k] = Math.atan(x[k]);
      };

      DSP.atan2 = function (dst, y, x) {
        for (var k = Math.min(dst.length, x.length, y.length) - 1; k >= 0; --k)
          dst[k] = Math.atan2(y[k], x[k]);
      };

      DSP.ceil = function (dst, x) {
        for (var k = Math.min(dst.length, x.length) - 1; k >= 0; --k)
          dst[k] = Math.ceil(x[k]);
      };

      DSP.cos = function (dst, x) {
        for (var k = Math.min(dst.length, x.length) - 1; k >= 0; --k)
          dst[k] = Math.cos(x[k]);
      };

      DSP.exp = function (dst, x) {
        for (var k = Math.min(dst.length, x.length) - 1; k >= 0; --k)
          dst[k] = Math.exp(x[k]);
      };

      DSP.floor = function (dst, x) {
        for (var k = Math.min(dst.length, x.length) - 1; k >= 0; --k)
          dst[k] = Math.floor(x[k]);
      };

      DSP.log = function (dst, x) {
        for (var k = Math.min(dst.length, x.length) - 1; k >= 0; --k)
          dst[k] = Math.log(x[k]);
      };

      DSP.max = function (x) {
        var ret = -Infinity;
        for (var k = x.length - 1; k >= 0; --k) {
          var val = x[k];
          if (val > ret)
            ret = val;
        }
        return ret;
      };

      DSP.min = function (x) {
        var ret = Infinity;
        for (var k = x.length - 1; k >= 0; --k) {
          var val = x[k];
          if (val < ret)
            ret = val;
        }
        return ret;
      };

      DSP.pow = function (dst, x, y) {
        var k;
        if (y instanceof Float32Array)
          for (k = Math.min(dst.length, x.length, y.length) - 1; k >= 0; --k)
            dst[k] = Math.pow(x[k], y[k]);
        else {
          // Optimize for special cases
          if (y == 2)
            for (k = Math.min(dst.length, x.length) - 1; k >= 0; --k) {
              var val = x[k];
              dst[k] = val * val;
            }
          else if (y == 3)
            for (k = Math.min(dst.length, x.length) - 1; k >= 0; --k) {
              var val = x[k];
              dst[k] = val * val * val;
            }
          else if (y == 4)
            for (k = Math.min(dst.length, x.length) - 1; k >= 0; --k) {
              var val = x[k];
              val = val * val;
              dst[k] = val * val;
            }
          else if (y == -1)
            for (k = Math.min(dst.length, x.length) - 1; k >= 0; --k)
              dst[k] = 1 / x[k]
          else if (y == -2)
            for (k = Math.min(dst.length, x.length) - 1; k >= 0; --k) {
              var val = 1 / x[k];
              dst[k] = val * val;
            }
          else
            for (k = Math.min(dst.length, x.length) - 1; k >= 0; --k)
              dst[k] = Math.pow(x[k], y);
        }
      };

      DSP.random = function (dst, low, high) {
        if (!low)
          low = 0;
        if (isNaN(parseFloat(high)))
          high = 1;
        var scale = high - low;
        for (var k = dst.length - 1; k >= 0; --k)
          dst[k] = Math.random() * scale + low;
      };

      DSP.round = function (dst, x) {
        for (var k = Math.min(dst.length, x.length) - 1; k >= 0; --k)
          dst[k] = Math.round(x[k]);
      };

      DSP.sin = function (dst, x) {
        for (var k = Math.min(dst.length, x.length) - 1; k >= 0; --k)
          dst[k] = Math.sin(x[k]);
      };

      DSP.sqrt = function (dst, x) {
        for (var k = Math.min(dst.length, x.length) - 1; k >= 0; --k)
          dst[k] = Math.sqrt(x[k]);
      };

      DSP.tan = function (dst, x) {
        for (var k = Math.min(dst.length, x.length) - 1; k >= 0; --k)
          dst[k] = Math.tan(x[k]);
      };

      DSP.clamp = function (dst, x, xMin, xMax) {
        for (var k = Math.min(dst.length, x.length) - 1; k >= 0; --k) {
          var val = x[k];
          dst[k] = val < xMin ? xMin : val > xMax ? xMax : val;
        }
      };

      DSP.fract = function (dst, x) {
        for (var k = Math.min(dst.length, x.length) - 1; k >= 0; --k) {
          var val = x[k];
          dst[k] = val - Math.floor(val);
        }
      };

      DSP.ramp = function (dst, first, last) {
        var maxIdx = dst.length - 1;
        if (maxIdx >= 0)
          dst[0] = first;
        if (maxIdx > 0) {
          var step = (last - first) / maxIdx;
          for (var k = 1; k <= maxIdx; ++k)
            dst[k] = first + step * k;
        }
      };

      DSP.sign = function (dst, x) {
        for (var k = Math.min(dst.length, x.length) - 1; k >= 0; --k)
          dst[k] = x[k] < 0 ? -1 : 1;
      };

      DSP.sum = function (x) {
        var ret = 0;
        for (var k = x.length - 1; k >= 0; --k)
          ret += x[k];
        return ret;
      };

      DSP.sampleLinear = function (dst, x, t, repeat) {
        var xLen = x.length, maxIdx = xLen - 1;
        if (repeat)
          for (var k = Math.min(dst.length, t.length) - 1; k >= 0; --k) {
            var t2 = t[k];
            t2 = t2 - Math.floor(t2/xLen) * xLen;
            var idx = Math.floor(t2);
            var w = t2 - idx;
            var p1 = x[idx];
            var p2 = x[idx < maxIdx ? idx + 1 : 0];
            dst[k] = p1 + w * (p2 - p1);
          }
        else
          for (var k = Math.min(dst.length, t.length) - 1; k >= 0; --k) {
            var t2 = t[k];
            t2 = t2 < 0 ? 0 : t2 > maxIdx ? maxIdx : t2;
            var idx = Math.floor(t2);
            var w = t2 - idx;
            var p1 = x[idx];
            var p2 = x[idx < maxIdx ? idx + 1 : maxIdx];
            dst[k] = p1 + w * (p2 - p1);
          }
      };

      DSP.sampleCubic = function (dst, x, t, repeat) {
        var xLen = x.length, maxIdx = xLen - 1;
        if (repeat)
          for (var k = Math.min(dst.length, t.length) - 1; k >= 0; --k) {
            var t2 = t[k];
            t2 = t2 - Math.floor(t2/xLen) * xLen;
            var idx = Math.floor(t2);
            var w = t2 - idx;
            var w2 = w * w;
            var w3 = w2 * w;
            var h2 = -2*w3 + 3*w2;
            var h1 = 1 - h2;
            var h4 = w3 - w2;
            var h3 = h4 - w2 + w;
            var p1 = x[idx > 0 ? idx - 1 : maxIdx];
            var p2 = x[idx];
            var p3 = x[idx < maxIdx ? idx + 1 : 0];
            var p4 = x[idx < maxIdx - 1 ? idx + 2 : (idx + 2 - Math.floor((idx + 2)/xLen) * xLen)];
            dst[k] = h1 * p2 + h2 * p3 + 0.5 * (h3 * (p3 - p1) + h4 * (p4 - p2));
          }
        else
          for (var k = Math.min(dst.length, t.length) - 1; k >= 0; --k) {
            var t2 = t[k];
            t2 = t2 < 0 ? 0 : t2 > maxIdx ? maxIdx : t2;
            var idx = Math.floor(t2);
            var w = t2 - idx;
            var w2 = w * w;
            var w3 = w2 * w;
            var h2 = -2*w3 + 3*w2;
            var h1 = 1 - h2;
            var h4 = w3 - w2;
            var h3 = h4 - w2 + w;
            var p1 = x[idx > 0 ? idx - 1 :  0];
            var p2 = x[idx];
            var p3 = x[idx < maxIdx ? idx + 1 : maxIdx];
            var p4 = x[idx < maxIdx - 1 ? idx + 2 : maxIdx];
            dst[k] = h1 * p2 + h2 * p3 + 0.5 * (h3 * (p3 - p1) + h4 * (p4 - p2));
          }
      };

      DSP.pack = function (dst, offset, stride, src1, src2, src3, src4) {
        var dstCount = Math.floor((dst.length - offset) / stride);
        var count = Math.min(dstCount, src1.length);
        if (src2)
          if (src3)
            if (src4)
              for (var k = 0; k < count; ++k) {
                dst[offset] = src1[k];
                dst[offset + 1] = src2[k];
                dst[offset + 2] = src3[k];
                dst[offset + 3] = src4[k];
                offset += stride;
              }
            else
              for (var k = 0; k < count; ++k) {
                dst[offset] = src1[k];
                dst[offset + 1] = src2[k];
                dst[offset + 2] = src3[k];
                offset += stride;
              }
          else
            for (var k = 0; k < count; ++k) {
              dst[offset] = src1[k];
              dst[offset + 1] = src2[k];
              offset += stride;
            }
        else
          for (var k = 0; k < count; ++k) {
            dst[offset] = src1[k];
            offset += stride;
          }
      };

      DSP.unpack = function (src, offset, stride, dst1, dst2, dst3, dst4) {
        var srcCount = Math.floor((src.length - offset) / stride);
        var count = Math.min(srcCount, dst1.length);
        if (dst2)
          if (dst3)
            if (dst4)
              for (var k = 0; k < count; ++k) {
                dst1[k] = src[offset];
                dst2[k] = src[offset + 1];
                dst3[k] = src[offset + 2];
                dst4[k] = src[offset + 3];
                offset += stride;
              }
            else
              for (var k = 0; k < count; ++k) {
                dst1[k] = src[offset];
                dst2[k] = src[offset + 1];
                dst3[k] = src[offset + 2];
                offset += stride;
              }
          else
            for (var k = 0; k < count; ++k) {
              dst1[k] = src[offset];
              dst2[k] = src[offset + 1];
              offset += stride;
            }
        else
          for (var k = 0; k < count; ++k) {
            dst1[k] = src[offset];
            offset += stride;
          }
      };

      g.DSP = DSP;
    })();


    //------------------------------------------------------------------------------
    // interface Filter
    //------------------------------------------------------------------------------

    (function () {
      if (g.Filter) return;

      var Filter = function (bSize, aSize) {
        if (isNaN(parseFloat(bSize)) || !isFinite(bSize))
          bSize = 1;
        if (!aSize)
          aSize = 0;
        this.b = new Float32Array(bSize);
        this.b[0] = 1;
        this.a = new Float32Array(aSize);
        this._bHist = new Float32Array(bSize);
        this._aHist = new Float32Array(aSize);
      };

      Filter.prototype.filter = function (dst, x) {
        // Put commonly accessed objects and properties in local variables
        var a = this.a, aLen = a.length,
            b = this.b, bLen = b.length,
            aHist = this._aHist, bHist = this._bHist,
            xLen = x.length, dstLen = dst.length;

        // FIXME: Optimize for long FIR filters

        // Perform run-in part using the history (slow)
        var bHistRunIn = bLen - 1;
        var aHistRunIn = aLen;
        var k;
        for (k = 0; (bHistRunIn || aHistRunIn) && k < xLen; ++k) {
          var m, noHistLen;

          // FIR part
          noHistLen = bLen - bHistRunIn;
          bHistRunIn && bHistRunIn--;
          var res = b[0] * x[k];
          for (m = 1; m < noHistLen; ++m)
            res += b[m] * x[k - m];
          for (; m < bLen; ++m)
            res += b[m] * bHist[m - noHistLen];

          // Recursive part
          noHistLen = aLen - aHistRunIn;
          aHistRunIn && aHistRunIn--;
          for (m = 0; m < noHistLen; ++m)
            res -= a[m] * dst[k - 1 - m];
          for (; m < aLen; ++m)
            res -= a[m] * aHist[m - noHistLen];

          dst[k] = res;
        }

        // Perform history-free part (fast)
        if (bLen == 3 && aLen == 2) {
          // Optimized special case: biquad filter
          var b0 = b[0], b1 = b[1], b2 = b[2], a1 = a[0], a2 = a[1];
          var x0 = x[k-1], x1 = x[k-2], x2;
          var y0 = dst[k-1], y1 = dst[k-2], y2;
          for (; k < xLen; ++k) {
            x2 = x1;
            x1 = x0;
            x0 = x[k];
            y2 = y1;
            y1 = y0;
            y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
            dst[k] = y0;
          }
        }
        else {
          // Generic case
          for (; k < xLen; ++k) {
            var m;

            // FIR part
            var res = b[0] * x[k];
            for (m = 1; m < bLen; ++m)
              res += b[m] * x[k - m];

            // Recursive part
            for (m = 0; m < aLen; ++m)
              res -= a[m] * dst[k - 1 - m];

            dst[k] = res;
          }
        }

        // Update history state
        var histCopy = Math.min(bLen - 1, xLen);
        for (k = bLen - 2; k >= histCopy; --k)
          bHist[k] = bHist[k - histCopy];
        for (k = 0; k < histCopy; ++k)
          bHist[k] = x[xLen - 1 - k];
        histCopy = Math.min(aLen, dstLen);
        for (k = aLen - 1; k >= histCopy; --k)
          aHist[k] = aHist[k - histCopy];
        for (k = 0; k < histCopy; ++k)
          aHist[k] = dst[xLen - 1 - k];
      };

      Filter.prototype.clearHistory = function () {
        for (var k = this._bHist.length - 1; k >= 0; --k)
          this._bHist[k] = 0;
        for (var k = this._aHist.length - 1; k >= 0; --k)
          this._aHist[k] = 0;
      };

      g.Filter = Filter;
    })();


    //------------------------------------------------------------------------------
    // interface FFT
    //
    // NOTE: This is essentially a hand-translation of the C language Kiss FFT
    // library, copyright by Mark Borgerding, relicensed with permission from the
    // author.
    //
    // The algorithm implements mixed radix FFT and supports transforms of any size
    // (not just powers of 2). For optimal performance, use sizes that can be
    // factorized into factors 2, 3, 4 and 5.
    //------------------------------------------------------------------------------

    (function () {
      if (g.FFT) return;

      var butterfly2 = function (outRe, outIm, outIdx, stride, twRe, twIm, m) {
        var scratch0Re, scratch0Im,
            out0Re, out0Im, out1Re, out1Im,
            tRe, tIm;

        var tw1 = 0,
            idx0 = outIdx,
            idx1 = outIdx + m;

        var idx0End = idx0 + m;
        while (idx0 < idx0End) {
          // out0 = out[idx0] / 2
          out0Re = outRe[idx0] * 0.5;
          out0Im = outIm[idx0] * 0.5;
          // out1 = out[idx1] / 2
          out1Re = outRe[idx1] * 0.5;
          out1Im = outIm[idx1] * 0.5;

          // scratch0 = out1 * tw[tw1]
          tRe = twRe[tw1]; tIm = twIm[tw1];
          scratch0Re = out1Re * tRe - out1Im * tIm;
          scratch0Im = out1Re * tIm + out1Im * tRe;

          // out[idx1] = out0 - scratch0
          outRe[idx1] = out0Re - scratch0Re;
          outIm[idx1] = out0Im - scratch0Im;

          // out[idx0] = out0 + scratch0
          outRe[idx0] = out0Re + scratch0Re;
          outIm[idx0] = out0Im + scratch0Im;

          tw1 += stride;
          ++idx0; ++idx1;
        }
      };

      var butterfly3 = function (outRe, outIm, outIdx, stride, twRe, twIm, m) {
        var scratch0Re, scratch0Im, scratch1Re, scratch1Im,
            scratch2Re, scratch2Im, scratch3Re, scratch3Im,
            out0Re, out0Im, out1Re, out1Im, out2Re, out2Im,
            tRe, tIm;

        var tw1 = 0,
            tw2 = 0,
            stride2 = 2 * stride,
            idx0 = outIdx,
            idx1 = outIdx + m,
            idx2 = outIdx + 2 * m;

        var epi3Im = twIm[stride*m];

        var div3 = 1 / 3;
        var idx0End = idx0 + m;
        while (idx0 < idx0End) {
          // out0 = out[idx0] / 3
          out0Re = outRe[idx0] * div3;
          out0Im = outIm[idx0] * div3;
          // out1 = out[idx1] / 3
          out1Re = outRe[idx1] * div3;
          out1Im = outIm[idx1] * div3;
          // out2 = out[idx2] / 3
          out2Re = outRe[idx2] * div3;
          out2Im = outIm[idx2] * div3;

          // scratch1 = out1 * tw[tw1]
          tRe = twRe[tw1]; tIm = twIm[tw1];
          scratch1Re = out1Re * tRe - out1Im * tIm;
          scratch1Im = out1Re * tIm + out1Im * tRe;

          // scratch2 = out2 * tw[tw2]
          tRe = twRe[tw2]; tIm = twIm[tw2];
          scratch2Re = out2Re * tRe - out2Im * tIm;
          scratch2Im = out2Re * tIm + out2Im * tRe;

          // scratch3 = scratch1 + scratch2
          scratch3Re = scratch1Re + scratch2Re;
          scratch3Im = scratch1Im + scratch2Im;

          // scratch0 = scratch1 - scratch2
          scratch0Re = scratch1Re - scratch2Re;
          scratch0Im = scratch1Im - scratch2Im;

          // out1 = out0 - scratch3 / 2
          out1Re = out0Re - scratch3Re * 0.5;
          out1Im = out0Im - scratch3Im * 0.5;

          // scratch0 *= epi3.i
          scratch0Re *= epi3Im;
          scratch0Im *= epi3Im;

          // out[idx0] = out0 + scratch3
          outRe[idx0] = out0Re + scratch3Re;
          outIm[idx0] = out0Im + scratch3Im;

          outRe[idx2] = out1Re + scratch0Im;
          outIm[idx2] = out1Im - scratch0Re;

          outRe[idx1] = out1Re - scratch0Im;
          outIm[idx1] = out1Im + scratch0Re;

          tw1 += stride; tw2 += stride2;
          ++idx0; ++idx1; ++idx2;
        }
      };

      var butterfly4 = function (outRe, outIm, outIdx, stride, twRe, twIm, m, inverse) {
        var scratch0Re, scratch0Im, scratch1Re, scratch1Im, scratch2Re, scratch2Im,
            scratch3Re, scratch3Im, scratch4Re, scratch4Im, scratch5Re, scratch5Im,
            out0Re, out0Im, out1Re, out1Im, out2Re, out2Im, out3Re, out3Im,
            tRe, tIm;

        var tw1 = 0,
            tw2 = 0,
            tw3 = 0,
            stride2 = 2 * stride,
            stride3 = 3 * stride,
            idx0 = outIdx,
            idx1 = outIdx + m,
            idx2 = outIdx + 2 * m,
            idx3 = outIdx + 3 * m;

        var div4 = 1 / 4;
        var idx0End = idx0 + m;
        while (idx0 < idx0End) {
          // out0 = out[idx0] / 4
          out0Re = outRe[idx0] * div4;
          out0Im = outIm[idx0] * div4;
          // out1 = out[idx1] / 4
          out1Re = outRe[idx1] * div4;
          out1Im = outIm[idx1] * div4;
          // out2 = out[idx2] / 4
          out2Re = outRe[idx2] * div4;
          out2Im = outIm[idx2] * div4;
          // out3 = out[idx3] / 4
          out3Re = outRe[idx3] * div4;
          out3Im = outIm[idx3] * div4;

          // scratch0 = out1 * tw[tw1]
          tRe = twRe[tw1]; tIm = twIm[tw1];
          scratch0Re = out1Re * tRe - out1Im * tIm;
          scratch0Im = out1Re * tIm + out1Im * tRe;

          // scratch1 = out2 * tw[tw2]
          tRe = twRe[tw2]; tIm = twIm[tw2];
          scratch1Re = out2Re * tRe - out2Im * tIm;
          scratch1Im = out2Re * tIm + out2Im * tRe;

          // scratch2 = out3 * tw[tw3]
          tRe = twRe[tw3]; tIm = twIm[tw3];
          scratch2Re = out3Re * tRe - out3Im * tIm;
          scratch2Im = out3Re * tIm + out3Im * tRe;

          // scratch5 = out0 - scratch1
          scratch5Re = out0Re - scratch1Re;
          scratch5Im = out0Im - scratch1Im;

          // out0 += scratch1
          out0Re += scratch1Re;
          out0Im += scratch1Im;

          // scratch3 = scratch0 + scratch2
          scratch3Re = scratch0Re + scratch2Re;
          scratch3Im = scratch0Im + scratch2Im;

          // scratch4 = scratch0 - scratch2
          scratch4Re = scratch0Re - scratch2Re;
          scratch4Im = scratch0Im - scratch2Im;

          // out[idx2] = out0 - scratch3
          outRe[idx2] = out0Re - scratch3Re;
          outIm[idx2] = out0Im - scratch3Im;

          // out[idx0] = out0 + scratch3
          outRe[idx0] = out0Re + scratch3Re;
          outIm[idx0] = out0Im + scratch3Im;

          if (inverse) {
            outRe[idx1] = scratch5Re - scratch4Im;
            outIm[idx1] = scratch5Im + scratch4Re;
            outRe[idx3] = scratch5Re + scratch4Im;
            outIm[idx3] = scratch5Im - scratch4Re;
          }
          else {
            outRe[idx1] = scratch5Re + scratch4Im;
            outIm[idx1] = scratch5Im - scratch4Re;
            outRe[idx3] = scratch5Re - scratch4Im;
            outIm[idx3] = scratch5Im + scratch4Re;
          }

          tw1 += stride; tw2 += stride2; tw3 += stride3;
          ++idx0; ++idx1; ++idx2; ++idx3;
        }
      };

      var butterfly5 = function (outRe, outIm, outIdx, stride, twRe, twIm, m) {
        var scratch0Re, scratch0Im, scratch1Re, scratch1Im, scratch2Re, scratch2Im,
            scratch3Re, scratch3Im, scratch4Re, scratch4Im, scratch5Re, scratch5Im,
            scratch6Re, scratch6Im, scratch7Re, scratch7Im, scratch8Re, scratch8Im,
            scratch9Re, scratch9Im, scratch10Re, scratch10Im, scratch11Re, scratch11Im,
            scratch12Re, scratch12Im,
            out0Re, out0Im, out1Re, out1Im, out2Re, out2Im, out3Re, out3Im, out4Re, out4Im,
            tRe, tIm;

        var tw1 = 0,
            tw2 = 0,
            tw3 = 0,
            tw4 = 0,
            stride2 = 2 * stride,
            stride3 = 3 * stride,
            stride4 = 4 * stride;

        var idx0 = outIdx,
            idx1 = outIdx + m,
            idx2 = outIdx + 2 * m,
            idx3 = outIdx + 3 * m,
            idx4 = outIdx + 4 * m;

        // ya = tw[stride*m];
        var yaRe = twRe[stride * m],
            yaIm = twIm[stride * m];
        // yb = tw[stride*2*m];
        var ybRe = twRe[stride * 2 * m],
            ybIm = twIm[stride * 2 * m];

        var div5 = 1 / 5;
        var idx0End = idx0 + m;
        while (idx0 < idx0End) {
          // out0 = out[idx0] / 5
          out0Re = outRe[idx0] * div5;
          out0Im = outIm[idx0] * div5;
          // out1 = out[idx1] / 5
          out1Re = outRe[idx1] * div5;
          out1Im = outIm[idx1] * div5;
          // out2 = out[idx2] / 5
          out2Re = outRe[idx2] * div5;
          out2Im = outIm[idx2] * div5;
          // out3 = out[idx3] / 5
          out3Re = outRe[idx3] * div5;
          out3Im = outIm[idx3] * div5;
          // out4 = out[idx4] / 5
          out4Re = outRe[idx4] * div5;
          out4Im = outIm[idx4] * div5;

          // scratch0 = out0;
          scratch0Re = out0Re;
          scratch0Im = out0Im;

          // scratch1 = out1 * tw[tw1]
          tRe = twRe[tw1]; tIm = twIm[tw1];
          scratch1Re = out1Re * tRe - out1Im * tIm;
          scratch1Im = out1Re * tIm + out1Im * tRe;
          // scratch2 = out2 * tw[tw2]
          tRe = twRe[tw2]; tIm = twIm[tw2];
          scratch2Re = out2Re * tRe - out2Im * tIm;
          scratch2Im = out2Re * tIm + out2Im * tRe;
          // scratch3 = out3 * tw[tw3]
          tRe = twRe[tw3]; tIm = twIm[tw3];
          scratch3Re = out3Re * tRe - out3Im * tIm;
          scratch3Im = out3Re * tIm + out3Im * tRe;
          // scratch4 = out4 * tw[tw4]
          tRe = twRe[tw4]; tIm = twIm[tw4];
          scratch4Re = out4Re * tRe - out4Im * tIm;
          scratch4Im = out4Re * tIm + out4Im * tRe;

          // scratch7 = scratch1 + scratch4
          scratch7Re = scratch1Re + scratch4Re;
          scratch7Im = scratch1Im + scratch4Im;
          // scratch10 = scratch1 - scratch4
          scratch10Re = scratch1Re - scratch4Re;
          scratch10Im = scratch1Im - scratch4Im;
          // scratch8 = scratch2 + scratch2
          scratch8Re = scratch2Re + scratch3Re;
          scratch8Im = scratch2Im + scratch3Im;
          // scratch9 = scratch2 - scratch3
          scratch9Re = scratch2Re - scratch3Re;
          scratch9Im = scratch2Im - scratch3Im;

          // out[idx0] = out0 + scratch7 + scratch8
          outRe[idx0] = out0Re + scratch7Re + scratch8Re;
          outIm[idx0] = out0Im + scratch7Im + scratch8Im;

          scratch5Re = scratch0Re + scratch7Re * yaRe + scratch8Re * ybRe;
          scratch5Im = scratch0Im + scratch7Im * yaRe + scratch8Im * ybRe;

          scratch6Re = scratch10Im * yaIm + scratch9Im * ybIm;
          scratch6Im = -scratch10Re * yaIm - scratch9Re * ybIm;

          // out[idx1] = scratch5 - scratch6
          outRe[idx1] = scratch5Re - scratch6Re;
          outIm[idx1] = scratch5Im - scratch6Im;
          // out[idx4] = scratch5 + scratch6
          outRe[idx4] = scratch5Re + scratch6Re;
          outIm[idx4] = scratch5Im + scratch6Im;

          scratch11Re = scratch0Re + scratch7Re * ybRe + scratch8Re * yaRe;
          scratch11Im = scratch0Im + scratch7Im * ybRe + scratch8Im * yaRe;

          scratch12Re = -scratch10Im * ybIm + scratch9Im * yaIm;
          scratch12Im = scratch10Re * ybIm - scratch9Re * yaIm;

          // out[idx2] = scratch11 + scratch12
          outRe[idx2] = scratch11Re + scratch12Re;
          outIm[idx2] = scratch11Im + scratch12Im;
          // out[idx3] = scratch11 - scratch12
          outRe[idx3] = scratch11Re - scratch12Re;
          outIm[idx3] = scratch11Im - scratch12Im;

          tw1 += stride; tw2 += stride2; tw3 += stride3; tw4 += stride4;
          ++idx0; ++idx1; ++idx2; ++idx3; ++idx4;
        }
      };

      var butterflyN = function (outRe, outIm, outIdx, stride, twRe, twIm, m, p, size) {
        var u, q1, q, idx0;
        var out0Re, out0Im, aRe, aIm, tRe, tIm;

        // FIXME: Allocate statically
        var scratchRe = new Float32Array(p);
        var scratchIm = new Float32Array(p);

        var pInv = 1 / p;
        for (u = 0; u < m; ++u) {
          idx0 = outIdx + u;
          for (q1 = 0; q1 < p; ++q1) {
            // scratch[q1] = out[idx0] / p
            scratchRe[q1] = outRe[idx0] * pInv;
            scratchIm[q1] = outIm[idx0] * pInv;
            idx0 += m;
          }

          idx0 = outIdx + u;
          var tw1Incr = stride * u;
          for (q1 = 0; q1 < p; ++q1) {
            // out0 = scratch[0]
            out0Re = scratchRe[0];
            out0Im = scratchIm[0];

            var tw1 = 0;
            for (q = 1; q < p; ++q) {
              tw1 += tw1Incr;
              if (tw1 >= size)
                tw1 -= size;

              // out0 += scratch[q] * tw[tw1]
              aRe = scratchRe[q], aIm = scratchIm[q];
              tRe = twRe[tw1], tIm = twIm[tw1];
              out0Re += aRe * tRe - aIm * tIm;
              out0Im += aRe * tIm + aIm * tRe;
            }

            // out[idx0] = out0
            outRe[idx0] = out0Re;
            outIm[idx0] = out0Im;

            idx0 += m;
            tw1Incr += stride;
          }
        }
      };

      var work = function (outRe, outIm, outIdx, fRe, fIm, fIdx, stride, inStride, factors, factorsIdx, twRe, twIm, size, inverse) {
        var p = factors[factorsIdx++];  // Radix
        var m = factors[factorsIdx++];  // Stage's FFT length / p

        var outIdxBeg = outIdx;
        var outIdxEnd = outIdx + p * m;

        var fIdxIncr = stride * inStride;
        if (m == 1) {
          do {
            outRe[outIdx] = fRe[fIdx];
            outIm[outIdx] = fIm[fIdx];
            fIdx += fIdxIncr;
            ++outIdx;
          }
          while (outIdx != outIdxEnd);
        }
        else {
          do {
            // DFT of size m*p performed by doing p instances of smaller DFTs of
            // size m, each one takes a decimated version of the input.
            work(outRe, outIm, outIdx, fRe, fIm, fIdx, stride * p, inStride, factors, factorsIdx, twRe, twIm, size, inverse);
            fIdx += fIdxIncr;
            outIdx += m;
          }
          while (outIdx != outIdxEnd);
        }

        outIdx = outIdxBeg;

        // Recombine the p smaller DFTs
        switch (p) {
          case 2:  butterfly2(outRe, outIm, outIdx, stride, twRe, twIm, m); break;
          case 3:  butterfly3(outRe, outIm, outIdx, stride, twRe, twIm, m); break;
          case 4:  butterfly4(outRe, outIm, outIdx, stride, twRe, twIm, m, inverse); break;
          case 5:  butterfly5(outRe, outIm, outIdx, stride, twRe, twIm, m); break;
          default: butterflyN(outRe, outIm, outIdx, stride, twRe, twIm, m, p, size); break;
        }
      };

      /*  facBuf is populated by p1,m1,p2,m2, ...
          where
          p[i] * m[i] = m[i-1]
          m0 = n                  */
      var factor = function (n, facBuf) {
        // Factor out powers of 4, powers of 2, then any remaining primes
        var p = 4;
        var floorSqrt = Math.floor(Math.sqrt(n));
        var idx = 0;
        do {
          while (n % p) {
            switch (p) {
              case 4:  p = 2; break;
              case 2:  p = 3; break;
              default: p += 2; break;
            }
            if (p > floorSqrt)
              p = n;
          }
          n = Math.floor(n / p);
          facBuf[idx++] = p;
          facBuf[idx++] = n;
        }
        while (n > 1);
      };

      var FFT = function (size) {
        if (!size)
          size = 256;
        this.size = size;

        // Allocate arrays for twiddle factors
        this._twiddlesFwdRe = new Float32Array(size);
        this._twiddlesFwdIm = new Float32Array(size);
        this._twiddlesInvRe = this._twiddlesFwdRe;
        this._twiddlesInvIm = new Float32Array(size);

        // Init twiddle factors (both forward & reverse)
        for (var i = 0; i < size; ++i) {
            var phase = -2*Math.PI*i / size;
            var cosPhase = Math.cos(phase), sinPhase = Math.sin(phase);
            this._twiddlesFwdRe[i] = cosPhase;
            this._twiddlesFwdIm[i] = sinPhase;
            this._twiddlesInvIm[i] = -sinPhase;
        }

        // Allocate arrays for radix plan
        this._factors = new Int32Array(2 * 32);  // MAXFACTORS = 32

        // Init radix factors (mixed radix breakdown)
        factor(size, this._factors);
      };

      FFT.prototype.forwardCplx = function (dstReal, dstImag, xReal, xImag) {
        var twRe = this._twiddlesFwdRe;
        var twIm = this._twiddlesFwdIm;
        work(dstReal, dstImag, 0, xReal, xImag, 0, 1, 1, this._factors, 0, twRe, twIm, this.size, false);
      };

      FFT.prototype.forward = function (dstReal, dstImag, x) {
        // FIXME: Optimize this case (real input signal)
        this.forwardCplx(dstReal, dstImag, x, new Float32Array(this.size));
      };

      FFT.prototype.inverseCplx = function (dstReal, dstImag, xReal, xImag) {
        var twRe = this._twiddlesInvRe;
        var twIm = this._twiddlesInvIm;
        work(dstReal, dstImag, 0, xReal, xImag, 0, 1, 1, this._factors, 0, twRe, twIm, this.size, true);
      };

      FFT.prototype.inverse = function (dst, xReal, xImag) {
        // FIXME: Optimize this case (real output signal)
        this.inverseCplx(dst, new Float32Array(this.size), xReal, xImag);
      };

      g.FFT = FFT;
    })();

    if (typeof module !== "undefined" && module.exports) {
        module.exports = {
            DSP: g.DSP,
            Filter: g.Filter,
            FFT: g.FFT
        };
    }
})();
