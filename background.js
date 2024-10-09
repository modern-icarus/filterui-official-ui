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
        const truncatedSentence = truncateToMaxTokens(sentence, MAX_TOKEN_LENGTH);
        console.log(`Sending request to model: ${model}`, { inputs: truncatedSentence });

        const response = await fetch(`${HUGGINGFACE_API_URL}${model}`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${API_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ inputs: truncatedSentence }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log(`Response from model: ${model}`, result);
        return result && result[0] ? result[0] : null;
    } catch (error) {
        console.error("API request failed: ", error.message);
        throw error;
    }
}

// Function to truncate the sentence to the max token limit
function truncateToMaxTokens(text, maxLength) {
    const words = text.split(/\s+/);
    return words.length > maxLength ? words.slice(0, maxLength).join(' ') : text;
}

// Throttling: Send a limited number of concurrent requests
async function throttlePromises(tasks, concurrencyLimit) {
    const results = [];
    const executing = [];

    for (const task of tasks) {
        const p = task().then(result => {
            executing.splice(executing.indexOf(p), 1);
            return result;
        });
        results.push(p);
        executing.push(p);

        if (executing.length >= concurrencyLimit) {
            await Promise.race(executing);
        }
    }

    return Promise.all(results);
}

// Detect language of a sentence
async function detectLanguage(sentence) {
    const result = await callHuggingFaceAPI(LANGUAGE_DETECTION_MODEL, sentence);
    if (result && result.length > 0) {
        if (result[0].label === "eng_Latn") return "english";
        if (result[0].label === "tgl_Latn") return "tagalog";
    }
    return "english"; // Default to English
}

// Group sentences by detected language
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

// Analyze hate speech with throttling
async function analyzeHateSpeechWithThrottling(group, model, concurrencyLimit) {
    const tasks = group.map(sentence => async () => {
        const prediction = await callHuggingFaceAPI(model, sentence);
        console.log(`Sentence: "${sentence}"`, `Prediction:`, prediction);
        return prediction;
    });

    return throttlePromises(tasks, concurrencyLimit);
}

// Analyze hate speech in grouped sentences
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

  // Count hate speeches in both languages
  const englishHateCount = results.english.filter(prediction => prediction.label === "HATE").length;
  const tagalogHateCount = results.tagalog.filter(prediction => prediction.label === "HATE").length;

  console.log("English hate speech analysis results: ", results.english);
  console.log("Tagalog hate speech analysis results: ", results.tagalog);

  // Return the counts to the caller
  return {
    englishHateCount,
    tagalogHateCount,
  };
}


// Handle waiting (cold start delay)
async function handleColdStart() {
    console.log("Cold start detected, retrying...");
    await wait(COLD_START_RETRY_DELAY);
    return { scanResult: "coldStart", detectedHateSpeeches: 0 };
}

// Check if the error is due to a cold start
function isColdStartError(error) {
    const coldStartErrors = ["503", "timeout", "Gateway Timeout"];
    return coldStartErrors.some(err => error.message.includes(err));
}

// Process sentences collected from content script
async function processSentences(sentences) {
  const { englishGroup, tagalogGroup } = await groupByLanguage(sentences);
  const { englishHateCount, tagalogHateCount } = await analyzeHateSpeech(englishGroup, tagalogGroup);
  
  // Combine the counts
  const detectedHateSpeeches = englishHateCount + tagalogHateCount;

  return { detectedHateSpeeches, englishHateCount, tagalogHateCount }; // Return counts as an object
}



// Wait function
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Listen for messages and process collected sentences
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scanPage") {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { action: "scanPage" }, async (response) => {
                if (response && response.sentences) {
                    console.log("Collected sentences: ", response.sentences);
                    try {
                        const hateSpeechCount = await processSentences(response.sentences);
                        sendResponse({ scanResult: "success", detectedHateSpeeches: hateSpeechCount });
                    } catch (error) {
                        if (isColdStartError(error)) {
                            const coldStartResponse = await handleColdStart();
                            sendResponse(coldStartResponse);
                        } else {
                            console.error("Error processing sentences: ", error.message);
                            sendResponse({ scanResult: "maxAttempts", detectedHateSpeeches: 0 });
                        }
                    }
                } else {
                    console.error("No response from content script");
                    sendResponse({ scanResult: "maxAttempts", detectedHateSpeeches: 0 });
                }
            });
        });
        return true; // Indicates async response
    }
});
