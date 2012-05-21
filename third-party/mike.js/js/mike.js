/*jshint onecase:true undef:true browser:true */
var Mike = function () {

function extend (obj) {
	var k, n;

	for (n=1; n < arguments.length; n++) {
		for (k in arguments[n]) {
			if (arguments[n].hasOwnProperty(k)) {
				obj[k] = arguments[n][k];
			}
		}
	}

	return k;
}

function EventEmitter (target) {
	extend(target, EventEmitter.prototype);
	target._listeners = {};
}

EventEmitter.prototype = {
	_listeners: null,

	emit: function (name, args) {
		if (this._listeners[name]) {
			for (var i=0; i<this._listeners[name].length; i++) {
				this._listeners[name][i].apply(this, args);
			}
		}
		return this;
	},

	on: function (name, listener) {
		this._listeners[name] = this._listeners[name] || [];
		this._listeners[name].push(listener);
		return this;
	},

	off: function (name, listener) {
		if (this._listeners[name]) {
			if (!listener) {
				delete this._listeners[name];
				return this;
			}

			for (var i=0; i<this._listeners[name].length; i++) {
				if (this._listeners[name][i] === listener) {
					this._listeners[name].splice(i--, 1);
				}
			}

			if (!this._listeners[name].length) {
				delete this._listeners[name];
			}
		}
		return this;
	},

	once: function (name, listener) {
		var self = this;

		return this.on(name, function l () {
			this.off(name, l);
			return listener.apply(this, arguments);
		});
	}
};

function Mike (options) {
	extend(this, options || {});
	this.id = this.id ||  'mike' + (+new Date()) + Math.random();
	EventEmitter(this);

	this.createDOM();
	Mike.add(this);

	this.on('microphonechange', function () {
		if (this.settings) this.setParam(this.settings);
	});
}

Mike.prototype = {
	parentElement: null,
	domElement: null,
	id: null,
	settings: null,
	index: null,
	swfPath: 'mike.swf',
	objectName: 'Mike',

	createDOM: function () {
		var obj = document.createElement('object');
		obj.innerHTML = '<param name="movie" value="' + this.swfPath + '" />' +
			'<param name="FlashVars" value="id=' + this.id + '&amp;objectName=' +
			this.objectName + '">';

		obj.className = 'mike-js';
		obj.id = this.id;
		obj.type = 'application/x-shockwave-flash';
		obj.data = this.swfPath;

		this.parentElement = this.parentElement || document.body;
		this.domElement = obj;

		this.parentElement.appendChild(obj);

		this.show();
	},

	start: function () {
		return this.domElement.start();
	},

	stop: function () {
		return this.domElement.stop();
	},

	setParam: function (name, value) {
		var k;

		if (arguments.length === 1) {
			for (k in name) {
				if (name.hasOwnProperty(k)) {
					this.setParam(k, name[k]);
				}
			}
		} else {
			switch (name) {
			case 'sampleRate':
				this.domElement.setParam('rate',
					Mike.rates[value]);
				break;
			default:
				this.domElement.setParam(name, value);
			}
		}
	},

	getParam: function (name) {
		switch (name) {
		case 'sampleRate':
			return Mike.sampleRates[this.domElement.getParam('rate')];
		default:
			return this.domElement.getParam(name);
		}
	},

	setLoopBack: function (value) {
		return this.domElement.setLoopBack(value);
	},

	setSilenceLevel: function (value) {
		return this.domElement.setSilenceLevel(value);
	},

	setUseEchoSuppression: function (value) {
		return this.domElement.setUseEchoSuppression(value);
	},

	getMicrophones: function () {
		return this.domElement.getMicrophones();
	},

	setMicrophone: function (index) {
		this.index = null;

		var r = this.domElement.setMicrophone(index);

		if (r === Mike.ERROR_NO_ERROR) {
			this.index = index || 0;

			this.emit('microphonechange', []);
		}

		return r;
	},

	kill: function () {
		Mike.remove(this);
		this.domElement.parentNode.removeChild(this.domElement);
	},

	hide: function () {
		this.domElement.style.width = '0px';
		this.domElement.style.height = '0px';
	},

	show: function () {
		this.domElement.style.width = '215px';
		this.domElement.style.height = '138px';
	}
};

var SoundCodec = {
	NELLYMOSER: 'nellymoser',
	SPEEX: 'speex'
};

var sampleRates = {
	'44': 44100,
	'22': 22050,
	'11': 11025,
	'8': 8000,
	'5': 5512
};

var rates = {
	'44100': 44,
	'22050': 22,
	'11025': 11,
	'8000': 8,
	'5512': 5
};

/* Declare static */
extend(Mike, {
	ERROR_NO_ERROR: 0,
	ERROR_INVALID_VERSION: 1,
	ERROR_NOT_SUPPORTED: 2,
	ERROR_NOT_AVAILABLE: 3,

	list: [],

	SoundCodec: SoundCodec,
	sampleRates: sampleRates,
	rates: rates,

	add: function (mike) {
		this.list.push(mike);
		this.list[mike.id] = mike;
	},

	remove: function (mike) {
		delete this.list[mike.id];

		for (var i=0; i<this.list.length; i++) {
			if (this.list[i] === mike) this.list.splice(i--, 1);
		}
	}
});

EventEmitter(Mike);

/* populate event handlers */

void function (names, i) {

	function eventTransmitter(name) {
		Mike['on' + name] = function (id) {
			try {
				this.list[id].emit(name, [].slice.call(arguments, 1));
			} catch (e) {
				try {
					Mike.emit('error', [e]);
				} catch (ee) {}
			}
		};
	}

	for (i=0; i<names.length; i++) {
		eventTransmitter(names[i]);
	}

	names = null;

}(['error', 'data', 'statechange', 'activity']);

Mike.onready = function (id) {
	setTimeout(function () {
		Mike.list[id].emit('ready', []);
	}, 0);
};

return Mike;

}();
