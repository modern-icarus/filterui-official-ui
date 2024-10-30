document.addEventListener("DOMContentLoaded", function() {
    const scanPageButton = document.getElementById('scanPage');
    const modalContent = document.getElementById("modalContent");

    const scanToggle = document.getElementById("scanToggle");

    const userInput = document.getElementById("user-input");
    const sendMessageButton = document.getElementById("send-message");
    const chatMessages = document.getElementById("chat-messages");

    const strictMode = document.getElementById('strictMode');
    const moderateMode = document.getElementById('moderateMode');
    const freeMode = document.getElementById('freeMode');

    const hideSwitch = document.getElementById('hideSwitch');
    const uncensoredSwitch = document.getElementById('uncensoredSwitch');
    const highlightSwitch = document.getElementById('highlightSwitch');
    var hateSpeechMap = {};
    const defaultFalse = false;


    // if (!scanPageButton || !modalContent || !scanToggle || !userInput || !sendMessageButton || !chatMessages) {
    //     console.error("Some elements not found!");
    //     return;
    // }

     // Listen for changes in mode selection
    document.querySelectorAll('input[name="mode"]').forEach((input) => {
        input.addEventListener('change', (event) => {
            const selectedMode = event.target.value;
            console.log(`Mode selected: ${selectedMode}`);
            chrome.runtime.sendMessage({ action: "setMode", mode: selectedMode });
        });
    });
    

    // Event listener for Scan Page button
    scanPageButton.addEventListener('click', () => {
        // Show loading spinner and message
        showLoadingModal(modalContent);

        // Send message to content script to initiate the scan
        chrome.runtime.sendMessage({ action: "scanPage" }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Error: " + chrome.runtime.lastError.message);
                modalContent.innerHTML = `<p>Could not establish connection. Please refresh the page and try again.</p>`;
            } else {
                hateSpeechMap = response.hateSpeechMap || {};

                handleScanResponse(response, modalContent, hateSpeechMap);

                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    chrome.tabs.sendMessage(tabs[0].id, { action: "scanPage", hateSpeechMap });
                });
            }
        });
    });

    // Event listener for the scanToggle button
    scanToggle.addEventListener('change', (event) => {
        const toggleState = event.target.checked; // true if checked (on), false if unchecked (off)
        console.log(`scanToggle is now ${toggleState ? 'ON' : 'OFF'}`); // Log the toggle state

        // Disable Scan Page button if the toggle is on, enable it back if off
        scanPageButton.disabled = toggleState;

        // Get the active tab and send a message to content script
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs.length === 0) {
                console.error('No active tabs found.');
                return;
            }
            chrome.tabs.sendMessage(tabs[0].id, { action: "toggleObserver", enabled: toggleState });
        });
    });

    hideSwitch.addEventListener('click', () => {  
        const enable = hideSwitch.classList.toggle('enabled');
        const toggleState = event.target.checked;
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { action: "toggleCensorship", toggleState, hateSpeechMap });
        });

        if(highlightSwitch.checked) {
            highlightSwitch.checked = false;
        }
    });

    highlightSwitch.addEventListener('click', () => {
        const enable = highlightSwitch.classList.toggle('enabled');
        const toggleState = event.target.checked;
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { action: "toggleHighlighted", toggleState, hateSpeechMap });
        });
        
        if(hideSwitch.checked) {
            hideSwitch.checked = false;
        }
    });

    // Chatbox functionality
    // Function to display message in the chatbox
    function displayMessage(sender, message) {
        const messageElement = document.createElement("div");
        messageElement.classList.add("chat-message");
        messageElement.classList.add(sender === "user" ? "user" : "bot");
        messageElement.textContent = message;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;  // Scroll to bottom
    }

    async function handleMessage(sentence) {
        // Preprocess the user's input: convert to lowercase
        const processedSentence = sentence.toLowerCase();
    
        // Display user's message in the chat
        displayMessage("user", processedSentence);
        
        try {
            // Send the processed sentence to the background script for processing (prediction)
            chrome.runtime.sendMessage(
                { action: "processChatMessage", sentence: processedSentence },
                (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("Error: " + chrome.runtime.lastError.message);
                        displayMessage("bot", "Sorry, something went wrong. Please try again.");
                    } else {
                        // Display the bot's response with the prediction result
                        const predictions = response.predictionResult || [];
                        if (predictions.length > 0) {
                            // Assume the first prediction is the most confident one
                            const { label, score } = predictions[0];
    
                            // Map label to friendly message
                            const isHateSpeech = label === "LABEL_1" ? "hate speech" : "not hate speech";
    
                            // Construct the message to show
                            const confidence = (score * 100).toFixed(2); // Convert confidence to percentage
                            const botMessage = `I am ${confidence}% confident that your sentence is ${isHateSpeech}.`;
    
                            displayMessage("bot", botMessage);
                        } else {
                            displayMessage("bot", "Sorry, no prediction result was found.");
                        }
                    }
                }
            );
        } catch (error) {
            console.error("Error in handleMessage:", error);
            displayMessage("bot", "Sorry, something went wrong.");
        }
    }
    
    
    

    // Send message on button click
    sendMessageButton.addEventListener("click", function() {
        const sentence = userInput.value.trim();
        if (sentence) {
            handleMessage(sentence);
            userInput.value = "";  // Clear the input field
        }
    });

    // Send message on Enter key press
    userInput.addEventListener("keypress", function(e) {
        if (e.key === "Enter") {
            const sentence = userInput.value.trim();
            if (sentence) {
                handleMessage(sentence);
                userInput.value = "";  // Clear the input field
            }
        }
    });
});

// Function to toggle off other checkboxes when one is selected
function toggleMode(selectedMode) {
    if (selectedMode === strictMode) {
        moderateMode.checked = false;
        freeMode.checked = false;
    } else if (selectedMode === moderateMode) {
        strictMode.checked = false;
        freeMode.checked = false;
    } else if (selectedMode === freeMode) {
        strictMode.checked = false;
        moderateMode.checked = false;
    }
}

// Add event listeners to checkboxes
strictMode.addEventListener('change', () => toggleMode(strictMode));
moderateMode.addEventListener('change', () => toggleMode(moderateMode));
freeMode.addEventListener('change', () => toggleMode(freeMode));

// Function to toggle off other checkboxes when one is selected
function toggleSwitch(selectedSwitch) {
    if (selectedSwitch === hideSwitch) {
        uncensoredSwitch.checked = false;
        highlightSwitch.checked = false;
    } else if (selectedSwitch === uncensoredSwitch) {
        hideSwitch.checked = false;
        highlightSwitch.checked = false;
    } else if (selectedSwitch === highlightSwitch) {
        hideSwitch.checked = false;
        uncensoredSwitch.checked = false;
    }
}

// Add event listeners to checkboxes
hideSwitch.addEventListener('change', () => toggleSwitch(hideSwitch));
uncensoredSwitch.addEventListener('change', () => toggleSwitch(uncensoredSwitch));
highlightSwitch.addEventListener('change', () => toggleSwitch(highlightSwitch));

// Helper function to show loading spinner
function showLoadingModal(modalContent) {
    modalContent.innerHTML = `
        <div class="d-flex align-items-center">
            <div class="spinner-border" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <div class="ms-2">Scanning the page...</div>
        </div>
    `;
}

// Helper function to handle the scan response
function handleScanResponse(response, modalContent, hateSpeechMap) {
    console.log("Response object:", response);

    const scanResult = response.scanResult || ""; 
    const detectedHateSpeeches = response.detectedHateSpeeches.englishHateCount + response.detectedHateSpeeches.tagalogHateCount;
    const englishHateCount = response.detectedHateSpeeches.englishHateCount || 0;
    const tagalogHateCount = response.detectedHateSpeeches.tagalogHateCount || 0;
    

    if (scanResult === "coldStart") {
        modalContent.innerHTML = `
            <div class="alert alert-danger d-flex align-items-center p-2 me-0" role="alert">
                <i class='bx bxs-error-circle fs-1'></i>
                <div class="ms-2 me-2">
                    Cold Start Detected!
                </div>
            </div>
            <p>Cold start occurs when the API fell asleep... please try again after a few seconds</p>
        `;
    } else if (scanResult === "success") {

        // Dito ko tinetesting 

        let hateSpeechDetails = '';

        // List hate speeches from the hateSpeechMap
        for (const [sentence, predictions] of Object.entries(hateSpeechMap)) {
            hateSpeechDetails += `<p><strong>Sentence:</strong> "${sentence}"<br>`;
            hateSpeechDetails += `<strong>Predictions:</strong> ${predictions.map(pred => `${pred.label} (Score: ${pred.score})`).join(', ')}</p>`;
        
            replaceHateSpeech(sentence);
        }

        modalContent.innerHTML = `
            <div class="alert alert-success d-flex align-items-center p-2 me-0" role="alert">
                <i class='bx bxs-check-circle fs-1'></i>
                <div class="ms-2 me-2">
                    Scan Successful!
                </div>
            </div>
            <p>Detected ${detectedHateSpeeches} instances of hate speech. Total sentences processed: ${Object.keys(hateSpeechMap).length}</p>
            <button class="btn btn-primary justify-content-center- align-items-end" type="button" data-bs-toggle="collapse" data-bs-target="#collapseSuccess" aria-expanded="false" aria-controls="collapseSuccess">
                View Details
            </button>
            <div class="collapse mt-3 mb-3" id="collapseSuccess">
                <div class="card card-body" style="background-color: #423726; color: #AEAAAA max-height: 20vh; overflow-y: auto;">
                    <p>English Hate Speech: ${englishHateCount}</p>
                    <p>Tagalog Hate Speech: ${tagalogHateCount}</p>
                    <p>Hate Speech Details:</p>
                    ${hateSpeechDetails}
                </div>
            </div>
        `;
    } else if (scanResult === "maxAttempts") {
        modalContent.innerHTML = `
            <div class="alert alert-danger d-flex align-items-center p-2 me-0" role="alert">
                <i class='bx bxs-error-circle fs-1'></i>
                <div class="ms-2 me-2">
                    Error Occurred!
                </div>
            </div>
            <p>Error occurred! Please restart the page. If error still occurs please try again later!</p>
        `;
    }
}


function replaceHateSpeech(data) {
    
}