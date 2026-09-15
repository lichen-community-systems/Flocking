(function () {

var module = {
    exports: null
};

// For questions about the Kannada hyphenation patterns
// ask Santhosh Thottingal (santhosh dot thottingal at gmail dot com)
module.exports = {
	'id': 'kn',
	'leftmin': 2,
	'rightmin': 2,
	'patterns': {
		2 : "ಅ1ಆ1ಇ1ಈ1ಉ1ಊ1ಋ1ಎ1ಏ1ಐ1ಒ1ಔ1ೀ1ು1ೂ1ೃ1ೆ1ೇ1ೊ1ೋ1ೌ1್2ಃ1ಂ11ಕ1ಗ1ಖ1ಘ1ಙ1ಚ1ಛ1ಜ1ಝ1ಞ1ಟ1ಠ1ಡ1ಢ1ಣ1ತ1ಥ1ದ1ಧ1ನ1ಪ1ಫ1ಬ1ಭ1ಮ1ಯ1ರ1ಲ1ವ1ಶ1ಷ1ಸ1ಹ1ಳ1ಱ",
		3 : "2ಃ12ಂ1"
	}
};
var h = new window['Hypher'](module.exports);

if (typeof module.exports.id === 'string') {
    module.exports.id = [module.exports.id];
}

for (var i = 0; i < module.exports.id.length; i += 1) {
  window['Hypher']['languages'][module.exports.id[i]] = h;
}
}());
