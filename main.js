document.addEventListener("DOMContentLoaded", function() {
    const scanPageButton = document.getElementById('scanPage');
    const modalContent = document.getElementById("modalContent");

    if (!scanPageButton || !modalContent) {
        console.error("Button or modal content element not found!");
        return;
    }

    scanPageButton.addEventListener('click', () => {
        // Show loading spinner and message
        showLoadingModal(modalContent);

        // Send message to content script to initiate the scan
        chrome.runtime.sendMessage({ action: "scanPage" }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Error: " + chrome.runtime.lastError.message);
                modalContent.innerHTML = `<p>Could not establish connection. Please refresh the page and try again.</p>`;
            } else {
                handleScanResponse(response, modalContent);
            }
        });
    });
});

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
function handleScanResponse(response, modalContent) {
    let scanResult = response.scanResult || ""; 
    let detectedHateSpeeches = response.detectedHateSpeeches.englishHateCount + response.detectedHateSpeeches.tagalogHateCount || 0;
    const englishHateCount = response.englishHateCount || 0;
    const tagalogHateCount = response.tagalogHateCount || 0;

    if (scanResult === "coldStart") {
        modalContent.innerHTML = `
            <div class="alert alert-danger d-flex align-items-center p-2 me-0" role="alert">
                <i class='bx bxs-error-circle fs-1'></i>
                <div class="ms-2 me-2">
                    Cold Start Detected!
                </div>
            </div>
            <p>Cold start occurs when the API fell asleep... it may take a few seconds for it to wake up</p>
        `;
    } else if (scanResult === "success") {
        modalContent.innerHTML = `
            <div class="alert alert-success d-flex align-items-center p-2 me-0" role="alert">
                <i class='bx bxs-check-circle fs-1'></i>
                <div class="ms-2 me-2">
                    Scan Successful!
                </div>
            </div>
            <p>Detected ${detectedHateSpeeches} instances of hate speech.</p>
            <button class="btn btn-primary justify-content-center- align-items-end" type="button" data-bs-toggle="collapse" data-bs-target="#collapseSuccess" aria-expanded="false" aria-controls="collapseSuccess">
                View Details
            </button>
            <div class="collapse mt-3 mb-3" id="collapseSuccess">
                <div class="card card-body" style="background-color: #423726; color: #AEAAAA">
                    <p>English Hate Speech: ${englishHateCount}</p>
                    <p class="mb-0">Tagalog Hate Speech: ${tagalogHateCount}</p>
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
            <p>Error occured! Please restart the page. If error still occurs please try again later!</p>
        `;
    }
}
