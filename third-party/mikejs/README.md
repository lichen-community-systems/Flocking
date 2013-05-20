# mike.js

mike.js is a simple JavaScript wrapper around the [Flash Microphone API](http://help.adobe.com/en_US/FlashPlatform/reference/actionscript/3/flash/media/Microphone.html). It was designed to be lightweight and allow JS to access as much of the API as directly as possible. The wrapper has some sugar in it, so at worst setting up a Microphone is as hard as it is in ActionScript.

Creating a Mike instance creates a *visible* Flash object and does pretty much nothing to hide it after it's no longer required to be visible. But hey, this means you can style/hide it any way you want, the object is tagged with the class ```mike-js```.

## Usage

```javascript

var mike = new Mike({
	swfPath: '/path/to/mike.swf',
	parentElement: elementToAppendTo,

	settings: {
		/* settings to be run on the microphone whenever it's changed */
	}
});

mike.on('ready', function () {
	/* this gets called once the Flash interface is ready to be used */
	console.log('Available microphones:', this.getMicrophones().join(', '));

	/*
	 Set up a Microphone.
	 You can choose to pass no arguments and the default microphone will be picked.
	 Note that this function returns error IDs that are of type MIKE.ERROR_*
	 WARNING: Before this is called, most of the methods will throw.
	*/
	this.setMicrophone(0);

	/* Ask the user for approval and start streaming */
	this.start();
});

mike.on('error', function (e) {
	switch (e) {
		case MIKE.ERROR_INVALID_VERSION:
			alert('Sorry, you have an outdated flash version :(');
			break;
		case MIKE.ERROR_NOT_SUPPORTED:
			alert('Microphone not supported on this platform :(');
			break;
		case MIKE.ERROR_NOT_AVAILABLE:
			alert('You seem to have no microphones :(');
			break;
		default:
			alert('Oops, unknown error!');
	}
});

mike.on('statechange', function (e) {
	switch (e.code) {
		case "Microphone.Unmuted":
			/* The user approved the use of the microphone! */
			/* Or just unmuted it... */
			break;
		case "Microphone.Muted":
			/* The user disapproved the use of the microphone :( */
			/* Or just muted it... */
			break;
	}
});

mike.on('microphonechange', function () {
	console.log('New microphone:', this.getMicrophones()[this.index]);
});

mike.on('data', function (data) {
	/* do something with data */
});

```

## License

Licensed under MIT License.

## Credits

Designed and written by Jussi Kalliokoski. Based on the previous work of [Morteza Milani](https://github.com/milani) in [microphone.js](https://github.com/milani/microphone.js). Originally this project started as a fork of microphone.js but I wanted to change the nature of the project too much, so I decided to start from scratch. Big thanks to Morteza! I wouldn't have had any idea where to start without his project.
