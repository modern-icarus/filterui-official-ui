const HUGGINGFACE_API_URL = "https://api-inference.huggingface.co/models/";
const LANGUAGE_DETECTION_MODEL = "facebook/fasttext-language-identification";
const ENGLISH_HATE_SPEECH_MODEL = "Hate-speech-CNERG/dehatebert-mono-english";
const TAGALOG_HATE_SPEECH_MODEL = "ggpt1006/tl-hatespeech-detection";
const API_TOKEN = "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";
const COLD_START_RETRY_DELAY = 30000; // 30 seconds delay for cold start retries
const MAX_TOKEN_LENGTH = 512; // Maximum length allowed for the models
const CONCURRENCY_LIMIT = 5; // Limit for concurrent requests

// Helper function to call Hugging Face API
async function callHuggingFaceAPI(model, sentence) {
  try {
    // Truncate the sentence if it exceeds the token limit
    const truncatedSentence = truncateToMaxTokens(sentence, MAX_TOKEN_LENGTH);

    const response = await fetch(`${HUGGINGFACE_API_URL}${model}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: truncatedSentence }),
    });

    if (!response.ok) {
      const errorText = await response.text(); // Get the error message from the response
      throw new Error(`Error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return result && result[0] ? result[0] : null;
  } catch (error) {
    console.error("API request failed: ", error.message); // Log more detailed error
    throw error; // Rethrow the error to be handled elsewhere
  }
}

// Function to truncate the sentence to the max token limit
function truncateToMaxTokens(text, maxLength) {
  const words = text.split(/\s+/); // Split the text into words based on whitespace
  if (words.length > maxLength) {
    return words.slice(0, maxLength).join(' '); // Return truncated text
  }
  return text;
}

// Throttling: Send a limited number of concurrent requests
async function throttlePromises(tasks, concurrencyLimit) {
  const results = [];
  const executing = [];

  for (const task of tasks) {
    const p = task().then((result) => {
      executing.splice(executing.indexOf(p), 1); // Remove completed task
      return result;
    });
    results.push(p);
    executing.push(p);

    if (executing.length >= concurrencyLimit) {
      await Promise.race(executing); // Wait for the first to finish
    }
  }

  return Promise.all(results);
}

// detect language call
async function detectLanguage(sentence) {
  const result = await callHuggingFaceAPI(LANGUAGE_DETECTION_MODEL, sentence);

  // Log the full response from the language detection API for debugging or tracking
  console.log("Language detection result[0]: ", result[0]);

  // Extract the highest scored language from the API response
  if (result && result[0].length > 0) {
    const detectedLanguage = result[0][0].label;

    if (detectedLanguage === "eng_Latn") return "english";
    if (detectedLanguage === "tgl_Latn") return "tagalog";
  }

  // Default to English if the language is undetected or uncertain
  return "english";
}

// group sentences by detected language
async function groupByLanguage(sentences) {
  const englishGroup = [];
  const tagalogGroup = [];

  for (const sentence of sentences) {
    const language = await detectLanguage(sentence);
    if (language === "english") {
      englishGroup.push(sentence);
    } else {
      tagalogGroup.push(sentence);
    }
  }

  return { englishGroup, tagalogGroup };
}

// Send sentences in parallel with a concurrency limit
async function analyzeHateSpeechWithThrottling(group, model, concurrencyLimit) {
  const tasks = group.map((sentence) => () => callHuggingFaceAPI(model, sentence));
  return throttlePromises(tasks, concurrencyLimit);
}

// send grouped sentences to hate speech detection models
async function analyzeHateSpeech(englishGroup, tagalogGroup) {
  const results = { english: [], tagalog: [] };

  if (englishGroup.length > 0) {
    console.log("Sending English sentences for hate speech detection...");
    results.english = await analyzeHateSpeechWithThrottling(
      englishGroup,
      ENGLISH_HATE_SPEECH_MODEL,
      CONCURRENCY_LIMIT
    );
  }

  if (tagalogGroup.length > 0) {
    console.log("Sending Tagalog sentences for hate speech detection...");
    results.tagalog = await analyzeHateSpeechWithThrottling(
      tagalogGroup,
      TAGALOG_HATE_SPEECH_MODEL,
      CONCURRENCY_LIMIT
    );
  }

  console.log("English hate speech analysis results: ", results.english);
  console.log("Tagalog hate speech analysis results: ", results.tagalog);
}

// handle waiting (cold start delay)
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// check if the error is due to a cold start (e.g., timeout, 503 error)
function isColdStartError(error) {
  const coldStartErrors = ["503", "timeout", "Gateway Timeout"];
  return coldStartErrors.some(err => error.message.includes(err));
}

// process sentences collected from content script
async function processSentences(sentences) {
  const { englishGroup, tagalogGroup } = await groupByLanguage(sentences);
  await analyzeHateSpeech(englishGroup, tagalogGroup);
}

// Listen for messages and process collected sentences
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scanPage") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "scanPage" }, (response) => {
        if (response && response.sentences) {
          console.log("Collected sentences: ", response.sentences);
          // Process the collected sentences
          processSentences(response.sentences);
        } else {
          console.error("No response from content script");
        }
      });
    });
    sendResponse({ status: 'Message sent to content script' });
  }
});
