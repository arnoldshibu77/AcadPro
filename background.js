// Background Service Worker for AcadPro

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default storage configurations
    chrome.storage.local.set({
      ratingMode: 'excellent', // 'excellent', 'good', 'neutral', 'varied'
      commentMode: 'preset',  // 'preset', 'custom', 'smart'
      customComment: 'The teaching methodology is excellent and concepts are explained thoroughly with practical examples.',
      presetComments: [
        "The professor explains concepts thoroughly with practical real-world examples.",
        "Very interactive sessions, approachable faculty, and prompt doubt resolution.",
        "Course material, lab exercises, and assignment instructions were clear and structured.",
        "Excellent teaching quality and great learning environment provided throughout the semester.",
        "Overall experience has been very satisfactory and insightful."
      ],
      autoSubmit: false
    });
    console.log("AcadPro installed with default settings.");
  }
});
