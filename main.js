document.addEventListener("DOMContentLoaded", function() {
    const scanPageButton = document.getElementById('scanPage');
    const modalContent = document.getElementById("modalContent");

    if (!scanPageButton || !modalContent) {
        console.error("Button or modal content element not found!");
        return;
    }

    scanPageButton.addEventListener('click', () => {
        // Show loading spinner and message
        modalContent.innerHTML = `
            <div class="d-flex align-items-center">
                <div class="spinner-border" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <div class="ms-2">Scanning the page...</div>
            </div>
        `;

        // Send message to content script to initiate the scan
        chrome.runtime.sendMessage({ action: "scanPage" }, (response) => {
            if (chrome.runtime.lastError) {
                // If there is an error, prompt the user to refresh the page
                console.error("Error: " + chrome.runtime.lastError.message);
                modalContent.innerHTML = `<p>Could not establish connection. Please refresh the page and try again.</p>`;
            } else {
                console.log("Page scan triggered: ", response.status);
                
                let scanResult = ""; // Example default condition, should come dynamically
                let detectedHateSpeeches = 0;
                const englishHateCount = response.englishHateCount || 0;
                const tagalogHateCount = response.tagalogHateCount || 0;

                // Handle the response from the content script or API
                if (response && response.scanResult) {
                    scanResult = response.scanResult; // Assuming response contains scan result
                    detectedHateSpeeches = response.detectedHateSpeeches || 0; // Get detected instances if any
                }

                // Update the modal content based on scan result
                if (scanResult === "coldStart") {
                    modalContent.innerHTML = `
                    <div class="alert alert-danger d-flex align-items-center p-2 me-0" role="alert">
                        <i class='bx bxs-error-circle fs-1'></i>
                        <div class="ms-2 me-2">
                            Cold Start Detected!
                        </div>
                    </div>
                    <p>Cold start occurs when the API fell asleep... it may few seconds for it to wake up</p>
                    `;
                } else if (scanResult === "success") {
                    modalContent.innerHTML = `
                        <div class="alert alert-success d-flex align-items-center p-2 me-0" role="alert">
                            <i class='bx bxs-check-circle fs-1'></i>
                            <div class="ms-2 me-2">
                                Scan Successful!
                            </div>
                        </div>
                        <p> Detected ${response.detectedHateSpeeches} instances of hate speech.</p>
                        <button class="btn btn-primary" type="button" data-bs-toggle="collapse" data-bs-target="#collapseSuccess" aria-expanded="false" aria-controls="collapseSuccess">
                            View Details
                        </button>
                        <div class="collapse mt-3 mb-3" id="collapseSuccess">
                            <div class="card card-body">
                                <p>English Hate Speech: ${englishHateCount}</p>
                                <p>Tagalog Hate Speech: ${tagalogHateCount}</p>
                            </div>
                        </div>
                        `;
                } else if (scanResult === "maxAttempts") {
                    modalContent.innerHTML = `
                    <div class="alert alert-danger d-flex align-items-center p-2 me-0" role="alert">
                        <i class='bx bxs-error-circle fs-1'></i>
                        <div class="ms-2 me-2">
                            Error Occured!
                        </div>
                    </div>
                    <p>This may be due to the cloud running out of attempts. Please try again later!</p>`;
                }
            }
        });
    });
});
