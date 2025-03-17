# Moodle Course Archiver Chrome Extension

## Overview
A Chrome extension that helps you archive and manage your Moodle courses efficiently.

## Features
- Archive Moodle courses with one click
- Easy-to-use popup interface
- Secure and local storage of your preferences

## Project Structure
```

├── manifest.json         # Metadata about the extension
├── background.js         # Background script for handling events
├── popup                 # Directory for the popup interface
│   ├── popup.html        # HTML structure of the popup
│   ├── popup.js          # JavaScript for popup interactions
│   └── popup.css         # Styles for the popup
├── icons                 # Directory for extension icons
│   ├── icon16.png        # 16x16 pixel icon
│   ├── icon48.png        # 48x48 pixel icon
│   └── icon128.png       # 128x128 pixel icon
├── content               # Directory for content scripts
│   ├── content.js        # JavaScript for interacting with web pages
│   └── content.css       # Styles for content scripts
└── README.md             # Documentation for the project
```

## Installation Guide

### Manual Installation (ZIP file)
1. Download the extension as a ZIP file
2. Extract the ZIP file to a folder on your computer
3. Open Google Chrome
4. Type `chrome://extensions/` in the address bar and press Enter
5. Enable "Developer mode" by toggling the switch in the top-right corner
6. Click the "Load unpacked" button that appears
7. Navigate to the folder where you extracted the ZIP file
8. Select the folder and click "Open"
9. The extension should now appear in your Chrome toolbar

### Troubleshooting Installation
- If you don't see the extension icon, click the puzzle piece icon in the Chrome toolbar to find and pin the extension
- If you get an error while loading, make sure you selected the correct folder containing the manifest.json file
- Try refreshing the extensions page if the extension doesn't appear immediately

## Usage
1. Click the extension icon in your Chrome toolbar
2. Select your Moodle course
3. Click "Archive" to save your course content

## Support
If you encounter any issues, please report them in the Issues section of our repository.

## Contributing
Feel free to submit issues or pull requests for improvements and bug fixes. 

## License
This project is licensed under the MIT License.