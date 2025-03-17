// ...existing code...

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "checkForMoodleCourse") {
    const onMoodleCourse = isMoodleCourse();
    let fileCount = 0;
    
    if (onMoodleCourse) {
      fileCount = countFileResources();
    }
    
    sendResponse({
      isMoodleCourse: onMoodleCourse,
      fileCount: fileCount
    });
  }
  else if (message.action === "directDownload") {
    // Use the direct download method the user prefers
    downloadCourseFiles();
  }
  else if (message.action === "archiveCourse") {
    if (message.options.includeFiles) {
      if (message.options.downloadMethod === 'direct') {
        downloadCourseFiles();
      } else {
        downloadCourseFilesAsZip();
      }
    }
    
    // Handle other archive options as needed
    if (message.options.includeAssignments) {
      // Archive assignments logic (to be implemented)
    }
    
    if (message.options.includeForums) {
      // Archive forum posts logic (to be implemented)
    }
  }
  
  return true; // Keep the message channel open for async responses
});

// ...existing code...

// Implement direct download functionality using the user's snippet
function downloadCourseFiles() {
  const fileLinks = [];
  const activityLinks = document.querySelectorAll('div.activityname a.aalink.stretched-link');

  activityLinks.forEach(linkElement => {
    const href = linkElement.getAttribute('href');
    const accesshideSpan = linkElement.querySelector('span.accesshide');
    const isFile = accesshideSpan && accesshideSpan.textContent.trim().includes('File');
    
    if (href && isFile) {
      fileLinks.push(href);
    }
  });

  if (fileLinks.length === 0) {
    alert('No file resources found on this page.');
    return;
  }

  // Create status notification
  const notificationDiv = document.createElement('div');
  notificationDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: #4CAF50;
    color: white;
    padding: 15px;
    border-radius: 5px;
    z-index: 10000;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    font-family: Arial, sans-serif;
    font-size: 14px;
  `;
  notificationDiv.textContent = `Starting download of ${fileLinks.length} files...`;
  document.body.appendChild(notificationDiv);

  // Start downloads with a small delay between each to prevent browser throttling
  fileLinks.forEach((fileUrl, index) => {
    setTimeout(() => {
      const downloadLink = document.createElement('a');
      downloadLink.href = fileUrl;
      downloadLink.download = fileUrl.substring(fileUrl.lastIndexOf('/') + 1);
      downloadLink.style.display = 'none';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      // Update notification for last file
      if (index === fileLinks.length - 1) {
        notificationDiv.textContent = `${fileLinks.length} files download started.`;
        // Remove notification after 5 seconds
        setTimeout(() => {
          document.body.removeChild(notificationDiv);
        }, 5000);
      }
    }, index * 300); // 300ms delay between downloads
  });
}

// ...existing code...
