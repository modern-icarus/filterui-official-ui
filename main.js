document.getElementById('scanPage').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: "scanPage" }, (response) => {
      if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError.message);
      } else {
          console.log("Page scan triggered: ", response.status);
      }
  });
});
