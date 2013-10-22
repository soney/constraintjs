chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
	console.log(arguments);
    if(request.action) {
		alert('The response is : ' + request.action);
	}
});

window.addEventListener("message", function(event) {
    // We only accept messages from ourselves
    if (event.source != window) { return; }

    if (event.data.type && (event.data.type == "FROM_PAGE")) {
		var command = event.data.command;
		chrome.extension.sendRequest(event.data, function(response) {
			window.postMessage({ id: event.data.id, type: "FROM_EXTENSION", response: response }, "*");
		});
    }
}, false);
