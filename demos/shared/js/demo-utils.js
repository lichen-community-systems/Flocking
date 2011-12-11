var demo = demo || {};

(function () {
    
    demo.toggleButtonView = function(synth, options) {
        var that = {
            model: {
                isPlaying: false
            },
            
            synth: synth,
            button: document.querySelector(typeof (options) === "string" ? options : options.selectors.button),
            onPlay: options.onPlay,
            onPause: options.onPause
        };
        
        // Wire it up to a button on the page.
        that.button.addEventListener("click", function (e) {
            if (!that.model.isPlaying) {
                if (that.onPlay) {
                    that.onPlay(that.button);
                }
                
                that.button.innerHTML = "Pause";
                that.button.className = "playing";
                that.synth.play();
                that.model.isPlaying = true;
            } else {
                if (that.onPause) {
                    that.onPause(that.button);
                }
                
                that.button.innerHTML = "Play";
                that.button.className = "paused";
                that.synth.stop();
                that.model.isPlaying = false;
            }
        }, false);
        
        return that;
    };
    
    demo.fileSelectorView = function(synth, options) {
        var that = {
            input: document.querySelector(options.selectors.input),
            button: document.querySelector(options.selectors.button),
            fileName: document.querySelector(options.selectors.fileName)
        };
        
        that.input.addEventListener("change", function () {
            if (that.fileName) {
                that.fileName.innerHTML = that.input.files[0].name;
            }
            synth.input(options.playerId).onInputChanged();
        });
		
        // On Firefox, bind a click event to the browse button, which delegates to the hidden (ugly) file input element.
        if (window.navigator.userAgent.indexOf("Firefox") !== -1) {
            that.button.addEventListener("click", function (e) {
                that.input.click();
                e.preventDefault();
            }, false);
        } else {
            // On Chrome, show the ugly file input element.
            that.input.style.display = "inline";
            that.button.style.display = "none";
            if (that.fileName) {
                that.fileName.style.display = "none";
            }
        }
    };
    
})();