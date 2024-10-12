console.log('Content script listener is ready.');

const excludedPatterns = [
  // Exact sentence patterns
  "view more answers",
  "new message requests",
  "view more comments",
  "come share your findings in the comments",
  "reacted to your message",

  // Regular expressions
  /^view all \d+ replies$/i,
  /^view \d+ reply$/i,
  /^photos from .* post$/i,
  /\b\d+\s*h\b|\b\d+\s+hours?\s+ago\b/i,
  /(?:\d+\s*d|\d+\s+days?\s+ago)/i,
  /\b\d+\s*m\b|\b\d+\s+minutes?\s+ago\b/i,
  /\b\d+h\d+\s+hours?\s+ago\b/i,
  /\b\d+m\s+a\s+few\s+seconds?\s+ago\b/i,
  /.*\s+unsent\s+a\s+message\s*\(.*?\)/i,
  /click on the video to admire its majestic appearance more benefits prepared by \(.*?\) for everyone please check \(.+?\)/i
];

let observer;
const loggedSentences = new Set(); // Track logged sentences

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scanPage") {
    const sentences = extractValidSentences();
    console.log(`Scanned and found ${sentences.length} unique sentences.`);
    sendResponse({ sentences });
  }

  if (request.action === "toggleObserver") {
    if (request.enabled) {
      console.log('Mutation Observer is now ON.');
      startObserver();
    } else {
      if (observer) {
        observer.disconnect();
        observer = null;
        console.log('Mutation Observer is now OFF.');
      }
    }
  }
});

// Check if a sentence matches any excluded patterns (string or regex)
function isExcludedSentence(sentence) {
  return excludedPatterns.some(pattern => {
    if (typeof pattern === 'string') {
      return pattern.toLowerCase() === sentence.toLowerCase(); // Exact match for strings
    } else if (pattern instanceof RegExp) {
      return pattern.test(sentence); // Regex match for patterns
    }
    return false;
  });
}

// Extract and process valid sentences from the page
function extractValidSentences() {
  const postElements = document.querySelectorAll('div[dir="auto"], span[dir="auto"]');
  const uniqueSentences = new Set();

  return Array.from(postElements)
    .filter(el => el.innerText.trim().length > 0)
    .filter(el => el.closest('nav, footer, button') === null)
    .filter(el => !containsNestedText(el))
    .flatMap(el => el.innerText.split(/[.!?]+/))
    .map(text => preprocessSentence(text))  // Preprocessing applied here
    .filter(text => text.length > 0 && !isExcludedSentence(text)) // Exclusion check after preprocessing
    .filter(sentence => isValidSentence(sentence) && !uniqueSentences.has(sentence))
    .map(sentence => {
      uniqueSentences.add(sentence);
      return sentence.toLowerCase(); // Ensure the sentence is in lowercase
    });
}

// Function to preprocess sentence
function preprocessSentence(sentence) {
  return cleanRepetitiveWords(
    removeNonAlphanumeric(
      removeExtraWhitespaces(
        removeHtmlTags(sentence.trim().toLowerCase()) // Convert to lowercase
      )
    )
  );
}

// Start the Mutation Observer
function startObserver() {
  const targetNode = document.body;
  const config = { childList: true, subtree: true };

  const callback = function(mutationsList) {
    for (let mutation of mutationsList) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            processNodeText(node);
            node.querySelectorAll('div[dir="auto"], span[dir="auto"]').forEach(childNode => {
              processNodeText(childNode);
            });
          }
        });
      }
    }
  };

  observer = new MutationObserver(callback);
  observer.observe(targetNode, config);
  console.log('Mutation Observer started and watching for changes in the body.');
}

// Process text content from a node
function processNodeText(node) {
  const relevantElements = node.querySelectorAll('div[dir="auto"], span[dir="auto"]');

  relevantElements.forEach(el => {
    const textContent = el.innerText.trim();
    if (textContent) {
      const sentences = extractValidSentencesFromText(textContent);
      sentences.forEach(sentence => {
        if (!loggedSentences.has(sentence)) { // Check if sentence is already logged
          loggedSentences.add(sentence); // Add to logged sentences set
          console.log('Valid sentence extracted:', sentence);
          // Send valid sentence to the background for processing
          chrome.runtime.sendMessage({ action: "processSentence", sentence });
        }
      });
    }
  });
}

// Extract valid sentences from a given text
function extractValidSentencesFromText(text) {
  return text
    .split(/[.!?]+/)
    .map(sentence => preprocessSentence(sentence))  // Preprocessing applied here
    .filter(sentence => sentence.length > 0 && !isExcludedSentence(sentence))
    .filter(sentence => isValidSentence(sentence));
}

// Check if the sentence is valid (three or more words)
function isValidSentence(sentence) {
  const words = sentence.trim().split(/\s+/);
  return words.length >= 3;
}

// Helper Functions
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
