// Simple background script for Moodle Course Archiver
chrome.runtime.onInstalled.addListener(() => {
  console.log('Moodle Course File Downloader installed');
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "courseArchived") {
    console.log(`Course archived: ${message.data.title} with ${message.data.fileCount} files`);
  }
});

// Listen for archived course data from content script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "courseArchived") {
        // Store the archived course data
        chrome.storage.local.get('archivedCourses', function(result) {
            const archivedCourses = result.archivedCourses || [];
            archivedCourses.push(request.data);
            
            chrome.storage.local.set({
                'archivedCourses': archivedCourses
            }, function() {
                console.log('Course archived successfully:', request.data.title);
            });
        });
    }
});