// Function to inject the content script into a tab
function injectContentScript(tabId) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['content.js']
  }, () => {
    if (chrome.runtime.lastError) {
      console.error("Script injection failed: ", chrome.runtime.lastError);
    } else {
      console.log("Content script injected successfully.");
    }
  });
}

// Listen for when any tab is updated (reloaded or navigated)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && /^https?:\/\//.test(tab.url)) {
    injectContentScript(tabId);
  }
});

// Listen for when the user switches to a different tab
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url && /^https?:\/\//.test(tab.url)) {
      injectContentScript(tab.id);
    }
  });
});

// Inject content script into all active tabs when the extension is loaded or installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    tabs.forEach(tab => {
      if (tab.url && /^https?:\/\//.test(tab.url)) {
        injectContentScript(tab.id);
      }
    });
  });
});

// Handling messages and scanning the page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scanPage") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "scanPage" }, (response) => {
        if (response) {
          console.log("Collected sentences: ", response.sentences);
          // You can add further processing or send the sentences to the API here
          // sendToApi(response.sentences);
        } else {
          console.error("No response from content script");
        }
      });
    });
    sendResponse({ status: 'Message sent to content script' });
  }
});
