console.log('Content script listener is ready.');

let observer; // Declare the observer variable globally so we can stop it later

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scanPage") {
    const postElements = document.querySelectorAll('div[dir="auto"], span[dir="auto"]');
    const uniqueSentences = new Set();

    const sentences = Array.from(postElements)
      .filter(el => el.innerText.trim().length > 0)
      .filter(el => el.closest('nav, footer, button') === null)
      .filter(el => !containsNestedText(el))
      .flatMap(el => el.innerText.split(/[.!?]\s*/))
      .map(text => text.trim())
      .filter(text => text.length > 0)
      .map(text => cleanRepetitiveWords(removeNonAlphanumeric(removeExtraWhitespaces(removeHtmlTags(text)))))
      .filter(sentence => isValidSentence(sentence))
      .filter(sentence => sentence.trim().length > 0)
      .filter(sentence => {
        const isUnique = !uniqueSentences.has(sentence);
        uniqueSentences.add(sentence);
        return isUnique;
      })
      .map(sentence => sentence.trim().toLowerCase());

    console.log(`Scanned and found ${sentences.length} unique sentences.`); // Log the sentence count
    sendResponse({ sentences });
  }

  // Start or stop the Mutation Observer based on toggle state
  if (request.action === "toggleObserver") {
    if (request.enabled) {
      console.log('Mutation Observer is now ON.'); // Log when observer is turned on
      startObserver();
    } else {
      if (observer) {
        observer.disconnect();
        observer = null;
        console.log('Mutation Observer is now OFF.'); // Log when observer is turned off
      }
    }
  }
});

// Function to start the Mutation Observer
function startObserver() {
  const targetNode = document.body; // Watch the entire body
  const config = { childList: true, subtree: true }; // Observe additions/removals in the DOM

  // Callback function for MutationObserver
  const callback = function(mutationsList) {
    for (let mutation of mutationsList) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) { // Check if it's an element
            extractTextContent(node); // Extract text content for new nodes

            // If the new node has children, check them too
            node.querySelectorAll('div[dir="auto"], span[dir="auto"]').forEach(childNode => {
              extractTextContent(childNode); // Extract text content for child elements
            });
          }
        });
      }
    }
  };

  // Create a new MutationObserver instance
  observer = new MutationObserver(callback);

  // Start observing the target node
  observer.observe(targetNode, config);
  console.log('Mutation Observer started and watching for changes in the body.'); // Log when the observer starts
}

// Function to extract text content from a node and its relevant children
function extractTextContent(node) {
  const relevantElements = node.querySelectorAll('div[dir="auto"], span[dir="auto"]');

  relevantElements.forEach(el => {
    const textContent = el.innerText.trim();
    if (textContent) {
      console.log('Extracted text:', textContent); // Log the extracted text
    }
  });
}

// Function to check if a sentence is valid (has two or more words)
function isValidSentence(sentence) {
  const words = sentence.trim().split(/\s+/);
  return words.length >= 3;
}

// Function to remove extra whitespaces
function removeExtraWhitespaces(text) {
  return text.replace(/\s+/g, ' ');
}

// Function to remove HTML tags
function removeHtmlTags(html) {
  return html.replace(/<.*?>/g, ' ');
}

// Function to remove non-alphanumeric characters
function removeNonAlphanumeric(text) {
  return text.replace(/[^a-zA-Z0-9\s]/g, '');
}

// Function to clean repetitive words
function cleanRepetitiveWords(sentence) {
  const words = sentence.split(/\s+/);
  const cleanedWords = [];
  const wordCount = {};

  words.forEach(word => {
    const lowerWord = word.toLowerCase();
    if (!wordCount[lowerWord] || wordCount[lowerWord] < 1) {
      cleanedWords.push(word);
      wordCount[lowerWord] = 1;
    }
  });

  return cleanedWords.join(' ');
}

// Function to check if the element contains nested text content
function containsNestedText(el) {
  return Array.from(el.children).some(child => child.innerText.trim().length > 0);
}
