// Content script for Moodle Course Archiver

// Global variables
let downloadQueue = [];
let currentDownloads = 0;
const MAX_CONCURRENT_DOWNLOADS = 3;
let totalFiles = 0;
let downloadedFiles = 0;
let courseTitle = '';
let zipMode = false;
let zip = null;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkForMoodleCourse") {
    // Check if we're on a Moodle course page
    const isMoodleCourse = document.querySelector('.course-content') !== null;
    const fileLinks = findFileLinks();
    
    sendResponse({
      isMoodleCourse: isMoodleCourse,
      fileCount: fileLinks.length
    });
  } 
  else if (request.action === "archiveCourse") {
    zipMode = true;
    archiveCourse(request.options);
    sendResponse({ status: 'started' });
  }
  else if (request.action === "directDownload") {
    zipMode = false;
    downloadFilesDirectly();
    sendResponse({ status: 'started' });
  }
  
  return true; // Keep the message channel open for async responses
});

/**
 * Extract file extension from various sources
 */
function getFileExtension(activityElement) {
  let extension = '';
  
  // Try to get extension from accesshide span
  const accesshideSpan = activityElement.querySelector('span.accesshide');
  if (accesshideSpan) {
    const spanText = accesshideSpan.textContent.trim();
    if (spanText.includes('PDF')) extension = 'pdf';
    else if (spanText.includes('PPT')) extension = 'ppt';
    else if (spanText.includes('Word')) extension = 'doc';
    else if (spanText.includes('Excel')) extension = 'xlsx';
    else if (spanText.includes('Zip')) extension = 'zip';
    else if (spanText.includes('Image')) extension = 'jpg';
  }
  
  // If we couldn't determine from accesshide, check the activity icon
  if (!extension) {
    const iconImg = activityElement.querySelector('.activity-icon img, .activityiconcontainer img');
    if (iconImg && iconImg.src) {
      const src = iconImg.src;
      // Extract file type from image URL
      if (src.includes('/f/pdf')) extension = 'pdf';
      else if (src.includes('/f/powerpoint')) extension = 'pptx';
      else if (src.includes('/f/document')) extension = 'docx';
      else if (src.includes('/f/spreadsheet')) extension = 'xlsx';
      else if (src.includes('/f/archive')) extension = 'zip';
      else if (src.includes('/f/image')) extension = 'jpg';
      else if (src.includes('/f/text')) extension = 'txt';
      else if (src.includes('/f/video')) extension = 'mp4';
      else if (src.includes('/f/audio')) extension = 'mp3';
    }
  }
  
  return extension;
}

/**
 * Find all file links on the current page
 */
function findFileLinks() {
  const fileLinks = [];
  const activityElements = document.querySelectorAll('div.activity-instance, div.activityname');

  activityElements.forEach(activityElement => {
    const linkElement = activityElement.querySelector('a.aalink.stretched-link');
    
    if (!linkElement) return;
    
    const href = linkElement.getAttribute('href');
    // Check if this link has the "File" indicator in an accesshide span
    const accesshideSpan = linkElement.querySelector('span.accesshide');
    const isFile = accesshideSpan && accesshideSpan.textContent.trim().includes('File');
    
    if (href && isFile) {
      // Get the activity module element (parent of parent)
      let moduleElement = activityElement;
      while (moduleElement && !moduleElement.id.startsWith('module-')) {
        moduleElement = moduleElement.parentElement;
      }
      
      // Get file extension from various sources
      const extension = moduleElement ? getFileExtension(moduleElement) : '';
      
      // Clean up the name and remove "File" text
      let name = linkElement.textContent.trim().replace(/File/ig, '').trim();
      
      // Ensure name has the correct extension
      if (extension && !name.toLowerCase().endsWith('.' + extension.toLowerCase())) {
        name = name + '.' + extension;
      }
      
      fileLinks.push({
        url: href,
        name: name,
        extension: extension
      });
    }
  });

  return fileLinks;
}

/**
 * Start downloading files directly one by one
 */
function downloadFilesDirectly() {
  const fileLinks = findFileLinks();
  
  if (fileLinks.length === 0) {
    showNotification('No files found on this page', 'error');
    return;
  }
  
  showNotification(`Starting download of ${fileLinks.length} files`, 'info');
  
  fileLinks.forEach(file => {
    const downloadLink = document.createElement('a');
    downloadLink.href = file.url;
    
    // Use file name with proper extension if available
    if (file.name) {
      downloadLink.download = file.name;
    } else {
      let filename = file.url.substring(file.url.lastIndexOf('/') + 1);
      if (file.extension && !filename.toLowerCase().endsWith('.' + file.extension.toLowerCase())) {
        filename += '.' + file.extension;
      }
      downloadLink.download = filename;
    }
    
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  });
  
  showNotification(`${fileLinks.length} files download initiated`, 'success');
}

/**
 * Archive the course content
 */
function archiveCourse(options) {
  courseTitle = document.querySelector('h1').textContent.trim() || 'Moodle_Course';
  const sanitizedTitle = courseTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  
  // Initialize JSZip
  zip = new JSZip();
  
  // Create a folder structure
  const mainFolder = zip.folder(sanitizedTitle);
  const filesFolder = mainFolder.folder('files');
  
  // Find all file links
  const fileLinks = findFileLinks();
  totalFiles = fileLinks.length;
  
  if (totalFiles === 0) {
    showNotification('No files found on this page', 'error');
    return;
  }
  
  showNotification(`Starting to archive ${totalFiles} files`, 'info');
  showProgressBar(0, totalFiles);
  
  // Process each file
  downloadQueue = [...fileLinks];
  currentDownloads = 0;
  downloadedFiles = 0;
  
  // Start downloading files
  processDownloadQueue(filesFolder);
}

/**
 * Process the download queue with concurrent downloads
 */
function processDownloadQueue(folder) {
  while (currentDownloads < MAX_CONCURRENT_DOWNLOADS && downloadQueue.length > 0) {
    const file = downloadQueue.shift();
    currentDownloads++;
    
    fetchFile(file.url)
      .then(data => {
        // Get clean filename with proper extension
        let filename;
        if (file.name) {
          filename = file.name;
        } else {
          filename = file.url.substring(file.url.lastIndexOf('/') + 1);
          if (file.extension && !filename.toLowerCase().endsWith('.' + file.extension.toLowerCase())) {
            filename += '.' + file.extension;
          }
        }
        
        // Sanitize filename for zip
        filename = filename.replace(/[^a-z0-9. _-]/gi, '_');
        
        // Add file to zip
        folder.file(filename, data);
        
        // Update progress
        downloadedFiles++;
        updateProgress(downloadedFiles, totalFiles);
        
        // Continue processing
        currentDownloads--;
        processDownloadQueue(folder);
        
        // If all downloads are completed, finalize the zip
        if (downloadedFiles === totalFiles && currentDownloads === 0) {
          finalizeZip();
        }
      })
      .catch(error => {
        console.error(`Error downloading ${file.url}:`, error);
        
        // Update progress even for failed downloads
        downloadedFiles++;
        updateProgress(downloadedFiles, totalFiles);
        
        // Continue processing
        currentDownloads--;
        processDownloadQueue(folder);
        
        // If all downloads are completed, finalize the zip
        if (downloadedFiles === totalFiles && currentDownloads === 0) {
          finalizeZip();
        }
      });
  }
}

/**
 * Detect file type from HTTP headers or URL
 */
function detectFileType(response, url) {
  // Try to get content type from headers
  const contentType = response.headers.get('Content-Type');
  
  if (contentType) {
    if (contentType.includes('pdf')) return 'pdf';
    if (contentType.includes('powerpoint') || contentType.includes('presentation')) return 'pptx';
    if (contentType.includes('word') || contentType.includes('document')) return 'docx';
    if (contentType.includes('excel') || contentType.includes('spreadsheet')) return 'xlsx';
    if (contentType.includes('zip') || contentType.includes('archive')) return 'zip';
    if (contentType.includes('image/jpeg')) return 'jpg';
    if (contentType.includes('image/png')) return 'png';
    if (contentType.includes('text/plain')) return 'txt';
    if (contentType.includes('video')) return 'mp4';
    if (contentType.includes('audio')) return 'mp3';
  }
  
  // Try to extract extension from filename in Content-Disposition
  const disposition = response.headers.get('Content-Disposition');
  if (disposition && disposition.includes('filename=')) {
    const filenameMatch = disposition.match(/filename=["']?([^"']+)["']?/);
    if (filenameMatch && filenameMatch[1]) {
      const parts = filenameMatch[1].split('.');
      if (parts.length > 1) {
        return parts[parts.length - 1].toLowerCase();
      }
    }
  }
  
  // Try to extract extension from URL
  const urlParts = url.split('.');
  if (urlParts.length > 1) {
    const potentialExt = urlParts[urlParts.length - 1].toLowerCase();
    if (potentialExt.length < 5) {  // Most extensions are 2-4 characters
      return potentialExt;
    }
  }
  
  return '';
}

/**
 * Fetch a file from a URL
 */
function fetchFile(url) {
  return fetch(url)
    .then(response => {
      // If it's a direct file, return the blob
      if (!response.url.includes('mod/resource/view.php')) {
        // Get the file type
        const fileType = detectFileType(response, response.url);
        return response.blob().then(blob => {
          // Tag the blob with the detected file type
          blob.fileType = fileType;
          return blob;
        });
      }
      
      // If it's a resource view page, parse it to find the file link
      return response.text().then(html => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const fileLink = doc.querySelector('.resourceworkaround a');
        
        if (fileLink) {
          return fetch(fileLink.href).then(res => {
            const fileType = detectFileType(res, fileLink.href);
            return res.blob().then(blob => {
              // Tag the blob with the detected file type
              blob.fileType = fileType;
              return blob;
            });
          });
        }
        
        // If we can't find a direct link, return the original response
        return response.blob();
      });
    });
}

/**
 * Finalize and download the zip file
 */
function finalizeZip() {
  if (!zip) return;
  
  const sanitizedTitle = courseTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  
  zip.generateAsync({ type: 'blob' })
    .then(blob => {
      // Create download link and trigger download
      const zipUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = zipUrl;
      downloadLink.download = `${sanitizedTitle}_archive.zip`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      // Cleanup
      setTimeout(() => URL.revokeObjectURL(zipUrl), 1000);
      
      // Show completion notification
      showNotification(`Archive created with ${totalFiles} files`, 'success');
      removeProgressBar();
      
      // Send message to background script for tracking
      chrome.runtime.sendMessage({
        action: "courseArchived",
        data: {
          title: courseTitle,
          fileCount: totalFiles,
          date: new Date().toISOString()
        }
      });
    })
    .catch(error => {
      console.error('Error generating ZIP file:', error);
      showNotification('Error creating archive', 'error');
      removeProgressBar();
    });
}

/**
 * Show a notification on the page
 */
function showNotification(message, type = 'info') {
  // Remove existing notification if present
  const existingNotification = document.getElementById('moodle-archiver-notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  // Create new notification
  const notification = document.createElement('div');
  notification.id = 'moodle-archiver-notification';
  notification.className = `moodle-archiver-notification ${type}`;
  notification.textContent = message;
  
  // Add close button
  const closeButton = document.createElement('span');
  closeButton.className = 'close-notification';
  closeButton.innerHTML = '&times;';
  closeButton.onclick = () => notification.remove();
  notification.appendChild(closeButton);
  
  // Add to page
  document.body.appendChild(notification);
  
  // Auto-hide after 5 seconds unless it's an error
  if (type !== 'error') {
    setTimeout(() => {
      notification.remove();
    }, 5000);
  }
}

/**
 * Show a progress bar on the page
 */
function showProgressBar(current, total) {
  // Remove existing progress bar if present
  removeProgressBar();
  
  // Create progress container
  const progressContainer = document.createElement('div');
  progressContainer.id = 'moodle-archiver-progress';
  progressContainer.className = 'moodle-archiver-progress';
  
  // Create label
  const label = document.createElement('div');
  label.className = 'progress-label';
  label.textContent = `Downloading ${current} of ${total} files`;
  progressContainer.appendChild(label);
  
  // Create progress bar
  const progressBar = document.createElement('div');
  progressBar.className = 'progress-bar';
  
  const progressFill = document.createElement('div');
  progressFill.className = 'progress-fill';
  progressFill.style.width = `${(current / total) * 100}%`;
  
  progressBar.appendChild(progressFill);
  progressContainer.appendChild(progressBar);
  
  // Add to page
  document.body.appendChild(progressContainer);
}

/**
 * Update the progress bar
 */
function updateProgress(current, total) {
  const progressContainer = document.getElementById('moodle-archiver-progress');
  if (!progressContainer) return;
  
  const label = progressContainer.querySelector('.progress-label');
  const progressFill = progressContainer.querySelector('.progress-fill');
  
  label.textContent = `Downloading ${current} of ${total} files`;
  progressFill.style.width = `${(current / total) * 100}%`;
}

/**
 * Remove the progress bar
 */
function removeProgressBar() {
  const progressContainer = document.getElementById('moodle-archiver-progress');
  if (progressContainer) {
    progressContainer.remove();
  }
}

// Add CSS styles for notifications and progress bar
const styles = `
.moodle-archiver-notification {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 15px;
  border-radius: 5px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  z-index: 9999;
  min-width: 250px;
  max-width: 400px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.moodle-archiver-notification.info {
  background-color: #e3f2fd;
  color: #0d47a1;
  border-left: 4px solid #2196f3;
}

.moodle-archiver-notification.success {
  background-color: #e8f5e9;
  color: #1b5e20;
  border-left: 4px solid #4caf50;
}

.moodle-archiver-notification.error {
  background-color: #ffebee;
  color: #b71c1c;
  border-left: 4px solid #f44336;
}

.close-notification {
  cursor: pointer;
  margin-left: 10px;
  font-size: 20px;
  font-weight: bold;
}

.moodle-archiver-progress {
  position: fixed;
  bottom: 20px;
  left: 20px;
  padding: 15px;
  border-radius: 5px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  z-index: 9999;
  min-width: 300px;
  background-color: white;
}

.progress-label {
  margin-bottom: 8px;
  font-weight: bold;
}

.progress-bar {
  height: 10px;
  background-color: #e0e0e0;
  border-radius: 5px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: #4caf50;
  border-radius: 5px;
  transition: width 0.3s ease;
}
`;

const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);
