chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scanPage") {
    const elements = document.querySelectorAll('p, div');
    const uniqueSentences = new Set();

    const sentences = Array.from(elements)
      .map(el => el.innerText)
      .join(' ')
      .split('.')
      .map(sentence => cleanRepetitiveWords(sentence))
      .filter(sentence => sentence.length > 3 && isValidSentence(sentence))
      .filter(sentence => {
        const isUnique = !uniqueSentences.has(sentence);
        uniqueSentences.add(sentence);
        return isUnique;
      })
      .map(sentence => sentence.trim().toLowerCase());

    sendResponse({ sentences });
  }
});

function cleanRepetitiveWords(sentence) {
  const words = sentence.split(/\s+/);
  const cleanedWords = [];
  const wordCount = {};

  // Loop through words and add to cleanedWords if not a consecutive duplicate
  words.forEach(word => {
    const lowerWord = word.toLowerCase();
    // Track word occurrences, limit to 1 occurrence per word
    if (!wordCount[lowerWord] || wordCount[lowerWord] < 1) {
      cleanedWords.push(word);
      wordCount[lowerWord] = 1;
    }
  });

  return cleanedWords.join(' ');
}

function isValidSentence(sentence) {
  const nonAlphaCount = sentence.replace(/[a-zA-Z\s]/g, '').length;
  const words = sentence.split(' ');
  const repeatedWordThreshold = 5;
  const uniqueWords = [...new Set(words)];

  // Check if the sentence has more than 3 words, less than 30% non-alphabet characters,
  // and doesn't have excessive word repetition
  return (
    words.length > 3 &&
    nonAlphaCount < sentence.length * 0.3 &&
    (words.length - uniqueWords.length) < repeatedWordThreshold &&
    !isInvalidWord(sentence) // Added check for invalid words
  );
}

// Function to check for invalid words
function isInvalidWord(sentence) {
  // This regex checks for a sequence of non-proper words (like random character strings)
  const invalidWordPattern = /\b[0-9a-zA-Z]{10,}\b/; // Match alphanumeric sequences of 10 or more characters
  return invalidWordPattern.test(sentence);
}
