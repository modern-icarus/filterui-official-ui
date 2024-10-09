chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scanPage") {
    const postElements = document.querySelectorAll('div[dir="auto"], span[dir="auto"]'); // Target elements based on general attributes
    const uniqueSentences = new Set();

    const sentences = Array.from(postElements)
      .filter(el => el.innerText.trim().length > 0)             // Exclude empty or whitespace-only elements
      .filter(el => el.closest('nav, footer, button') === null)  // Exclude elements inside <nav>, <footer>, <button>
      .filter(el => !containsNestedText(el))                     // Exclude elements with nested text content
      .flatMap(el => el.innerText.split(/[.!?]\s*/))             // Split text by sentence-ending punctuation
      .map(text => text.trim())                                  // Trim the text for each sentence
      .filter(text => text.length > 0)                           // Filter out empty or whitespace-only text
      .map(text => cleanRepetitiveWords(removeNonAlphanumeric(removeExtraWhitespaces(removeHtmlTags(text)))))  // Process text
      .filter(sentence => isValidSentence(sentence))             // Only keep valid sentences
      .filter(sentence => sentence.trim().length > 0)            // Ensure non-empty sentences
      .filter(sentence => {
        const isUnique = !uniqueSentences.has(sentence);
        uniqueSentences.add(sentence);
        return isUnique;
      })
      .map(sentence => sentence.trim().toLowerCase());            // Normalize text to lowercase

    sendResponse({ sentences });
  }
});

// Function to check if a sentence is valid (has two or more words)
function isValidSentence(sentence) {
  const words = sentence.trim().split(/\s+/); // Split the sentence into words
  return words.length >= 3;                   // Valid if two or more words
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
  // Returns true if the element has child nodes with actual text content, indicating nested text
  return Array.from(el.children).some(child => child.innerText.trim().length > 0);
}
