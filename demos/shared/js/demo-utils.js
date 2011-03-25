var demo = demo || {};

(function () {
    
    demo.playPauseButton = function(buttonId, synth) {
        // Wire it up to a button on the page.
        var button = document.getElementById(buttonId);
        var isPlaying = false;
        button.addEventListener("click", function (e) {
            if (!isPlaying) {
                button.innerHTML = "Pause";
                synth.play();
                isPlaying = true;
            } else {
                button.innerHTML = "Play";
                synth.stop();
                isPlaying = false;
            }
        }, false);
        
        return button;
    };
    
})();