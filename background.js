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