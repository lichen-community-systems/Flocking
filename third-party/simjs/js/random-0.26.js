
/** Random.js library.
 * 
 * The code is licensed as LGPL.
*/

/* 
   A C-program for MT19937, with initialization improved 2002/1/26.
   Coded by Takuji Nishimura and Makoto Matsumoto.
 
   Before using, initialize the state by using init_genrand(seed)  
   or init_by_array(init_key, key_length).
 
   Copyright (C) 1997 - 2002, Makoto Matsumoto and Takuji Nishimura,
   All rights reserved.                          
 
   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions
   are met:

     1. Redistributions of source code must retain the above copyright
        notice, this list of conditions and the following disclaimer.

     2. Redistributions in binary form must reproduce the above copyright
        notice, this list of conditions and the following disclaimer in the
        documentation and/or other materials provided with the distribution.

     3. The names of its contributors may not be used to endorse or promote 
        products derived from this software without specific prior written 
        permission.

   THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
   "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
   LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
   A PARTICULAR PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL THE COPYRIGHT OWNER OR
   CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
   EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
   PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
   PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
   LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
   NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
   SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.


   Any feedback is very welcome.
   http://www.math.sci.hiroshima-u.ac.jp/~m-mat/MT/emt.html
   email: m-mat @ math.sci.hiroshima-u.ac.jp (remove space)
 */

var Random = function(seed) {
	seed = (seed === undefined) ? (new Date()).getTime() : seed;
	if (typeof(seed) !== 'number'                             // ARG_CHECK
		|| Math.ceil(seed) != Math.floor(seed)) {             // ARG_CHECK
		throw new TypeError("seed value must be an integer"); // ARG_CHECK
	}                                                         // ARG_CHECK
	
	
	/* Period parameters */  
	this.N = 624;
	this.M = 397;
	this.MATRIX_A = 0x9908b0df;   /* constant vector a */
	this.UPPER_MASK = 0x80000000; /* most significant w-r bits */
	this.LOWER_MASK = 0x7fffffff; /* least significant r bits */

	this.mt = new Array(this.N); /* the array for the state vector */
	this.mti=this.N+1; /* mti==N+1 means mt[N] is not initialized */

	//this.init_genrand(seed);
	this.init_by_array([seed], 1);
};

/* initializes mt[N] with a seed */
Random.prototype.init_genrand = function(s) {
	this.mt[0] = s >>> 0;
	for (this.mti=1; this.mti<this.N; this.mti++) {
		var s = this.mt[this.mti-1] ^ (this.mt[this.mti-1] >>> 30);
		this.mt[this.mti] = (((((s & 0xffff0000) >>> 16) * 1812433253) << 16) + (s & 0x0000ffff) * 1812433253)
		+ this.mti;
		/* See Knuth TAOCP Vol2. 3rd Ed. P.106 for multiplier. */
		/* In the previous versions, MSBs of the seed affect   */
		/* only MSBs of the array mt[].                        */
		/* 2002/01/09 modified by Makoto Matsumoto             */
		this.mt[this.mti] >>>= 0;
		/* for >32 bit machines */
	}
};

/* initialize by an array with array-length */
/* init_key is the array for initializing keys */
/* key_length is its length */
/* slight change for C++, 2004/2/26 */
Random.prototype.init_by_array = function(init_key, key_length) {
	var i, j, k;
	this.init_genrand(19650218);
	i=1; j=0;
	k = (this.N>key_length ? this.N : key_length);
	for (; k; k--) {
		var s = this.mt[i-1] ^ (this.mt[i-1] >>> 30);
		this.mt[i] = (this.mt[i] ^ (((((s & 0xffff0000) >>> 16) * 1664525) << 16) + ((s & 0x0000ffff) * 1664525)))
		+ init_key[j] + j; /* non linear */
		this.mt[i] >>>= 0; /* for WORDSIZE > 32 machines */
		i++; j++;
		if (i>=this.N) { this.mt[0] = this.mt[this.N-1]; i=1; }
		if (j>=key_length) j=0;
	}
	for (k=this.N-1; k; k--) {
		var s = this.mt[i-1] ^ (this.mt[i-1] >>> 30);
		this.mt[i] = (this.mt[i] ^ (((((s & 0xffff0000) >>> 16) * 1566083941) << 16) + (s & 0x0000ffff) * 1566083941))
		- i; /* non linear */
		this.mt[i] >>>= 0; /* for WORDSIZE > 32 machines */
		i++;
		if (i>=this.N) { this.mt[0] = this.mt[this.N-1]; i=1; }
	}

	this.mt[0] = 0x80000000; /* MSB is 1; assuring non-zero initial array */ 
};
 
/* generates a random number on [0,0xffffffff]-interval */
Random.prototype.genrand_int32 = function() {
	var y;
	var mag01 = new Array(0x0, this.MATRIX_A);
	/* mag01[x] = x * MATRIX_A  for x=0,1 */

	if (this.mti >= this.N) { /* generate N words at one time */
		var kk;

		if (this.mti == this.N+1)   /* if init_genrand() has not been called, */
			this.init_genrand(5489); /* a default initial seed is used */

		for (kk=0;kk<this.N-this.M;kk++) {
			y = (this.mt[kk]&this.UPPER_MASK)|(this.mt[kk+1]&this.LOWER_MASK);
			this.mt[kk] = this.mt[kk+this.M] ^ (y >>> 1) ^ mag01[y & 0x1];
		}
		for (;kk<this.N-1;kk++) {
			y = (this.mt[kk]&this.UPPER_MASK)|(this.mt[kk+1]&this.LOWER_MASK);
			this.mt[kk] = this.mt[kk+(this.M-this.N)] ^ (y >>> 1) ^ mag01[y & 0x1];
		}
		y = (this.mt[this.N-1]&this.UPPER_MASK)|(this.mt[0]&this.LOWER_MASK);
		this.mt[this.N-1] = this.mt[this.M-1] ^ (y >>> 1) ^ mag01[y & 0x1];

		this.mti = 0;
	}

	y = this.mt[this.mti++];

	/* Tempering */
	y ^= (y >>> 11);
	y ^= (y << 7) & 0x9d2c5680;
	y ^= (y << 15) & 0xefc60000;
	y ^= (y >>> 18);

	return y >>> 0;
};
 
/* generates a random number on [0,0x7fffffff]-interval */
Random.prototype.genrand_int31 = function() {
	return (this.genrand_int32()>>>1);
};

/* generates a random number on [0,1]-real-interval */
Random.prototype.genrand_real1 = function() {
	return this.genrand_int32()*(1.0/4294967295.0); 
	/* divided by 2^32-1 */ 
};

/* generates a random number on [0,1)-real-interval */
Random.prototype.random = function() {
	if (this.pythonCompatibility) {
		if (this.skip) {
			this.genrand_int32();
		}
		this.skip = true;
	}
	return this.genrand_int32()*(1.0/4294967296.0); 
	/* divided by 2^32 */
};

/* generates a random number on (0,1)-real-interval */
Random.prototype.genrand_real3 = function() {
	return (this.genrand_int32() + 0.5)*(1.0/4294967296.0); 
	/* divided by 2^32 */
};

/* generates a random number on [0,1) with 53-bit resolution*/
Random.prototype.genrand_res53 = function() { 
	var a=this.genrand_int32()>>>5, b=this.genrand_int32()>>>6; 
	return(a*67108864.0+b)*(1.0/9007199254740992.0); 
};

/* These real versions are due to Isaku Wada, 2002/01/09 added */


/**************************************************************************/
Random.prototype.LOG4 = Math.log(4.0);
Random.prototype.SG_MAGICCONST = 1.0 + Math.log(4.5);

Random.prototype.exponential = function (lambda) {
	if (arguments.length != 1) {                         // ARG_CHECK                     
		throw new SyntaxError("exponential() must "     // ARG_CHECK
				+ " be called with 'lambda' parameter"); // ARG_CHECK
	}                                                   // ARG_CHECK
	
	var r = this.random();
	return -Math.log(r) / lambda;
};

Random.prototype.gamma = function (alpha, beta) {
	if (arguments.length != 2) {                         // ARG_CHECK                     
		throw new SyntaxError("gamma() must be called"  // ARG_CHECK
				+ " with alpha and beta parameters"); // ARG_CHECK
	}                                                   // ARG_CHECK
	
	/* Based on Python 2.6 source code of random.py.
	 */
	
	if (alpha > 1.0) {
		var ainv = Math.sqrt(2.0 * alpha - 1.0);
		var bbb = alpha - this.LOG4;
		var ccc = alpha + ainv;
		
		while (true) {
			var u1 = this.random();
			if ((u1 < 1e-7) || (u > 0.9999999)) {
				continue;
			}
			var u2 = 1.0 - this.random();
			var v = Math.log(u1 / (1.0 - u1)) / ainv;
			var x = alpha * Math.exp(v);
			var z = u1 * u1 * u2;
			var r = bbb + ccc * v - x;
			if ((r + this.SG_MAGICCONST - 4.5 * z >= 0.0) || (r >= Math.log(z))) {
				return x * beta;
			}
		}
	} else if (alpha == 1.0) {
		var u = this.random();
		while (u <= 1e-7) {
			u = this.random();
		}
		return - Math.log(u) * beta;
	} else {
		while (true) {
			var u = this.random();
			var b = (Math.E + alpha) / Math.E;
			var p = b * u;
			if (p <= 1.0) {
				var x = Math.pow(p, 1.0 / alpha);
			} else {
				var x = - Math.log((b - p) / alpha);
			}
			var u1 = this.random();
			if (p > 1.0) {
				if (u1 <= Math.pow(x, (alpha - 1.0))) {
					break;
				}
			} else if (u1 <= Math.exp(-x)) {
				break;
			}
		}
		return x * beta;
	}
	
};

Random.prototype.normal = function (mu, sigma) {
	if (arguments.length != 2) {                          // ARG_CHECK                     
		throw new SyntaxError("normal() must be called"  // ARG_CHECK
				+ " with mu and sigma parameters");      // ARG_CHECK
	}                                                    // ARG_CHECK
	
	var z = this.lastNormal;
	this.lastNormal = NaN;
	if (!z) {
		var a = this.random() * 2 * Math.PI;
		var b = Math.sqrt(-2.0 * Math.log(1.0 - this.random()));
		z = Math.cos(a) * b;
		this.lastNormal = Math.sin(a) * b;
	} 
	return mu + z * sigma;
};

Random.prototype.pareto = function (alpha) {
	if (arguments.length != 1) {                         // ARG_CHECK                     
		throw new SyntaxError("pareto() must be called" // ARG_CHECK
				+ " with alpha parameter");             // ARG_CHECK
	}                                                   // ARG_CHECK
	
	var u = this.random();
	return 1.0 / Math.pow((1 - u), 1.0 / alpha);
};

Random.prototype.triangular = function (lower, upper, mode) {
	// http://en.wikipedia.org/wiki/Triangular_distribution
	if (arguments.length != 3) {                         // ARG_CHECK                     
		throw new SyntaxError("triangular() must be called" // ARG_CHECK
		+ " with lower, upper and mode parameters");    // ARG_CHECK
	}                                                   // ARG_CHECK
	
	var c = (mode - lower) / (upper - lower);
	var u = this.random();
	
	if (u <= c) {
		return lower + Math.sqrt(u * (upper - lower) * (mode - lower));
	} else {
		return upper - Math.sqrt((1 - u) * (upper - lower) * (upper - mode));
	}
};

Random.prototype.uniform = function (lower, upper) {
	if (arguments.length != 2) {                         // ARG_CHECK                     
		throw new SyntaxError("uniform() must be called" // ARG_CHECK
		+ " with lower and upper parameters");    // ARG_CHECK
	}                                                   // ARG_CHECK
	return lower + this.random() * (upper - lower);
};

Random.prototype.weibull = function (alpha, beta) {
	if (arguments.length != 2) {                         // ARG_CHECK                     
		throw new SyntaxError("weibull() must be called" // ARG_CHECK
		+ " with alpha and beta parameters");    // ARG_CHECK
	}                                                   // ARG_CHECK
	var u = 1.0 - this.random();
	return alpha * Math.pow(-Math.log(u), 1.0 / beta);
};
