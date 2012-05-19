(function() {
var people = [
	{
		id: 1
		, name: "Corey Smith"
	}, {
		id: 2
		, name: "Ellyn Todd"
	}, {
		id: 3
		, name: "Sarah Kelly"
	}, {
		id: 4
		, name: "Keith Malcom"
	}, {
		id: 5
		, name: "Karen Collins"
	}, {
		id: 6
		, name: "Eric Marshall"
	}
];

var pics = {
	1: "profile_pics/img_1.png"
	, 2: "profile_pics/img_2.png"
	, 3: "profile_pics/img_3.png"
	, 4: "profile_pics/img_4.png"
	, 5: "profile_pics/img_5.png"
	, 6: "profile_pics/img_6.png"
};

var get_delay = function(minimum, variance) {
	return minimum + Math.random() * variance;
};


var FB = {
	login: function(on_login) {
		window.setTimeout(on_login, get_delay(50, 300));
	}
	, api: function(path, response_fn) {
		if(path === "/me") {
		}
	}
};

window.FB = FB;
}());
