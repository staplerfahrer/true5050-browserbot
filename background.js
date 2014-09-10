// test url: http://true5050.com/CkIWA


/*
 * Find the index of a value in an array, 
 * or find the value of a certain property of an object in the arary 
 */
function Contains(arr, obj, opt_property) { 
	"use strict";
	for (var i = 0; i < arr.length; i++) {
		if ((opt_property 
				? arr[i][opt_property] 
				: arr[i]) === obj) return i; 
	} 
	return -1; 
}


var T5050urlHandler = (function () {
	"use strict";
	/* array of known True5050 objects with url and results */
	var knownT5050Urls = [];

	/* the url handling stuff */
	function getT5050UrlMatch(url) {
		return url.match(/http:\/\/true5050.com\/[^\/]+$/i);
	}

	function hasT5050Url(url) {
		return Contains(knownT5050Urls, url, 'url') > -1;
	}

	function addT5050Url(url) {
		if (hasT5050Url(url)) {
			throw 'addT5050Url(): True5050 URL already known';
		}

		knownT5050Urls.push({
			url: url,
			results: []
		});
	}

	function hasT5050Result(t5050Url, result) {
		if (!hasT5050Url(t5050Url)) {
			throw 'hasT5050Result(): unknown True5050 URL';
		}

		var idx = Contains(knownT5050Urls, t5050Url, 'url');

		return knownT5050Urls[idx].results.indexOf(result) > -1;
	}

	function addT5050Result(t5050Url, result) {
		if (!hasT5050Url(t5050Url)) {
			throw 'addT5050Result(): unknown True5050 URL';
		}

		if (hasT5050Result(t5050Url, result)) {
			throw 'addT5050Result(): result ' + result + ' already known';
		}

		var idx = Contains(knownT5050Urls, t5050Url, 'url');

		knownT5050Urls[idx].results.push(result);
	}

	function getT5050Results(t5050Url) {
		if (!hasT5050Url(t5050Url)) {
			throw 'getT5050Result(): unknown True5050 URL';
		}

		var idx = Contains(knownT5050Urls, t5050Url, 'url');

		return knownT5050Urls[idx].results;
	}

	/* The window and tab handling stuff */
	/*function closeFirstTab(windowId) {
		// we're assuming Chrome is fast enough to end up here in time
		// for the active tab to be the correct tab,
		// i. e. the tab that opened the original True5050 url.
		chrome.tabs.query({
			active: true, 
			windowId: windowId
		}, function (tabs) {
			if (tabs.length !== 1) {
				throw 'closeFirstTab(): incorrect number (' +tabs.length + ') of tabs found';
			}

			chrome.tabs.remove([tabs[0].id]);
		});
	}*/

	/* Open new tabs until both t5050 urls are found. */
	function discoverT5050Results(windowId, t5050Url) {
		// Someone, somewhere, claimed that True5050 changes
		// the returned URL every 90 seconds, but I'm not
		// taking any chances. 

		var newTabInterval = 5000;
		var tryAttempts = 40;
		var resultsExpected = 2; // it's called 50/50 after all
		var discoverTimeouts = [];
		for (var i = 1; i < tryAttempts; i++) {
			(function(tryCount) {
				var to = setTimeout(function () {
					if (getT5050Results(t5050Url).length === resultsExpected) {
						console.log('discoverT5050Results() found: ' + getT5050Results(t5050Url));
						// cancel all timeouts
						for (var cancel = 0; cancel < discoverTimeouts.length; cancel++) {
							clearTimeout(discoverTimeouts[cancel]);
						}
						return; // We found them all, don't open any more tabs.
					}
					console.log('discoverT5050Results() attempt ' + tryCount);
					createT5050Tab(windowId, t5050Url);
				}, newTabInterval * i);
				
				discoverTimeouts.push(to);
			})(i + 1);
		}
	}

	function createT5050Tab(windowId, t5050Url) {
		chrome.tabs.create({
			windowId: windowId,
			url: t5050Url,
			active: false // don't focus on every new tab, it gets annoying
		}, function (newTab) {
			// At this pint tab hasn't loaded yet.
			// The tab URL is the t5050Url.

			var tabCheckDelay = 500;
			var tabCheckCount = 0;
			var tabCheckCountMax = 10;
			var tabCheckInterval = window.setInterval(function () {
				if (newTab === undefined) {
					stopTrying();
					throw 'newTab is undefined, what the hell is wrong with you';
				}

				chrome.tabs.get(newTab.id, function (updatedTab) {
					// With the updated tab, we can get the url and store
					// the found True5050 url as a result.
					var resultUrl = updatedTab.url;

					tabCheckCount++;
					if (tabCheckCount === tabCheckCountMax) {
						// Stop trying after checking x times.
						stopTrying();
					}

					if (hasT5050Result(t5050Url, resultUrl)) {
						// Close this tab if the URL is a known result.
						console.log('existing resultUrl found: ' + resultUrl);
						stopTrying();
						chrome.tabs.remove([updatedTab.id]);
					} else if (t5050Url !== resultUrl) {
						// Add the new result.
						console.log('new resultUrl found: ' + resultUrl);
						stopTrying();
						addT5050Result(t5050Url, resultUrl);
					}
				});
			}, tabCheckDelay);

			function stopTrying() {
				window.clearInterval(tabCheckInterval);
			};
		});
	}

	function handleRequest(requestData) {
		// skip non-t5050 requests
		var urlMatch = getT5050UrlMatch(requestData.url);
		if (!urlMatch) return;

		// this is the True5050 request url
		var url = urlMatch[0];

		// prevent an infinite loop
		if (hasT5050Url(url)) return;

		// add to known urls
		addT5050Url(url);

		// get the window ID of the window that was active
		// when the True5050 url was opened
		chrome.windows.getCurrent(function (currentWnd) {
			var currentWndId = currentWnd.id;

			discoverT5050Results(currentWndId, url);
		});
	}

	return {
		HandleRequest: function (requestData) {
			return handleRequest(requestData);
		}
	};
})();

function HeadersReceived(requestData) {
	T5050urlHandler.HandleRequest(requestData);
}


/* Chrome request event handler assignment */
var requestFilter = {"urls": ["*://*/*"], "types":["main_frame"]};
var opt_extraInfoSpec = [];
chrome.webRequest.onHeadersReceived.addListener(HeadersReceived, requestFilter, opt_extraInfoSpec);
