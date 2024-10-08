chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scanPage") {
    const elements = document.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6');
    const uniqueSentences = new Set();

    const sentences = Array.from(elements)
      .map(el => el.innerText)                // Extract the text content from valid elements
      .filter(text => text.trim().length > 0)  // Filter out empty or whitespace-only text
      .join(' ')                               // Combine all extracted text
      .split(/[.!?]\s+/)                       // Split text into sentences based on punctuation
      .map(text => removeExtraWhitespaces(text)) // Remove extra whitespaces from each sentence
      .map(text => removeHtmlTags(text))         // Remove HTML tags
      .map(text => removeNonAlphanumeric(text))  // Remove non-alphanumeric characters
      .filter(sentence => sentence.trim().length > 0) // Ensure non-empty sentences
      .filter(sentence => {
        const isUnique = !uniqueSentences.has(sentence);
        uniqueSentences.add(sentence);
        return isUnique;
      })
      .map(sentence => sentence.trim().toLowerCase());

    sendResponse({ sentences });
  }
});

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
