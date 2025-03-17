document.addEventListener('DOMContentLoaded', () => {
  const archiveButton = document.getElementById('archive-button');
  const directDownloadButton = document.getElementById('download-direct-button');
  const viewArchivesButton = document.getElementById('view-archives');
  const helpLink = document.getElementById('help-link');
  const statusMessage = document.getElementById('status-message');
  const statusIcon = document.querySelector('.status-icon');
  
  // Check if we're on a Moodle course page
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {action: "checkForMoodleCourse"}, (response) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        statusMessage.textContent = "Error detecting Moodle course";
        return;
      }
      
      if (response && response.isMoodleCourse) {
        statusMessage.textContent = "Moodle course detected";
        statusIcon.classList.add('active');
        archiveButton.disabled = false;
        directDownloadButton.disabled = false;
        
        if (response.fileCount > 0) {
          statusMessage.textContent = `Moodle course detected with ${response.fileCount} files`;
        } else {
          statusMessage.textContent = "Moodle course detected (no files found)";
        }
      } else {
        statusMessage.textContent = "No Moodle course detected on this page";
      }
    });
  });
  
  // Archive button click handler
  archiveButton.addEventListener('click', () => {
    const options = { downloadMethod: 'zip' };
    
    // Update status message
    statusMessage.textContent = "Creating archive... This may take a moment";
    archiveButton.disabled = true;
    
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "archiveCourse",
        options: options
      });
      
      // Close the popup to show the download progress on the page
      setTimeout(() => {
        window.close();
      }, 500);
    });
  });
  
  // Direct download button click handler
  directDownloadButton.addEventListener('click', () => {
    // Update status message
    statusMessage.textContent = "Starting direct download...";
    directDownloadButton.disabled = true;
    
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "directDownload"
      });
      
      // Close the popup to show the download progress on the page
      setTimeout(() => {
        window.close();
      }, 500);
    });
  });
  
  // View archives button click handler
  viewArchivesButton.addEventListener('click', () => {
    // Open downloads page
    chrome.tabs.create({url: 'chrome://downloads/'});
  });
  
  // Help link click handler
  helpLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({url: chrome.runtime.getURL('/help/help.html')});
  });
});