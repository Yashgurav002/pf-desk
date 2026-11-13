// Shell + shared component strings (lib/ui.tsx, app/shell.tsx).
export const en = {
  navWork: "Work", navClients: "Clients", navTools: "Tools",
  companies: "Companies & workers", decodeRemark: "Decode a remark", decodeShort: "Decode", cycleShort: "Cycle", settings: "Settings", newClaim: "New claim",
  searchPlaceholder: "Find a worker by name or UAN…", help: "Help", startTour: "Show me around",
  riskHigh: "High", riskMedium: "Medium", riskLow: "Low", why: "Why?",
  st_draft: "Draft", st_checked: "Checked", st_submitted: "Submitted", st_under_process: "In process", st_resubmitted: "Resubmitted",
  st_settled: "Settled", st_rejected: "Rejected", st_closed: "Closed",
  demoStrip: "Demo · every person here is made up", wakingTitle: "Waking up the demo", wakingBody: "The free server sleeps when nobody uses it. This takes about a minute — the page will continue by itself.",
  bootFailed: "The server could not start", retry: "Try again", menu: "Menu", close: "Close", account: "Consultant",
} as const;
export const hi: Partial<Record<keyof typeof en, string>> = {
  navWork: "काम", navClients: "क्लाइंट", navTools: "टूल्स",
  companies: "कंपनियाँ और कर्मचारी", decodeRemark: "रिमार्क समझें", decodeShort: "रिमार्क", cycleShort: "महीना", settings: "सेटिंग्स", newClaim: "नया क्लेम",
  searchPlaceholder: "नाम या UAN से कर्मचारी खोजें…", help: "मदद", startTour: "मुझे दिखाइए कैसे चलता है",
  riskHigh: "ज़्यादा", riskMedium: "मध्यम", riskLow: "कम", why: "क्यों?",
  st_draft: "ड्राफ्ट", st_checked: "जाँचा गया", st_submitted: "जमा", st_under_process: "प्रोसेस में", st_resubmitted: "दोबारा जमा",
  st_settled: "सेटल", st_rejected: "रिजेक्ट", st_closed: "बंद",
  demoStrip: "डेमो · यहाँ सभी लोग काल्पनिक हैं", wakingTitle: "डेमो चालू हो रहा है", wakingBody: "कोई इस्तेमाल न करे तो फ्री सर्वर सो जाता है। लगभग एक मिनट लगेगा — पेज अपने-आप आगे बढ़ेगा।",
  bootFailed: "सर्वर चालू नहीं हो पाया", retry: "फिर कोशिश करें", menu: "मेनू", close: "बंद करें", account: "सलाहकार",
};
export const mr: Partial<Record<keyof typeof en, string>> = {
  navWork: "काम", navClients: "क्लायंट", navTools: "टूल्स",
  companies: "कंपन्या आणि कर्मचारी", decodeRemark: "रिमार्क समजून घ्या", decodeShort: "रिमार्क", cycleShort: "महिना", settings: "सेटिंग्ज", newClaim: "नवीन क्लेम",
  searchPlaceholder: "नाव किंवा UAN ने कर्मचारी शोधा…", help: "मदत", startTour: "कसे वापरायचे ते दाखवा",
  riskHigh: "जास्त", riskMedium: "मध्यम", riskLow: "कमी", why: "का?",
  st_draft: "ड्राफ्ट", st_checked: "तपासले", st_submitted: "जमा", st_under_process: "प्रक्रियेत", st_resubmitted: "पुन्हा जमा",
  st_settled: "सेटल", st_rejected: "रिजेक्ट", st_closed: "बंद",
  demoStrip: "डेमो · येथील सर्व व्यक्ती काल्पनिक आहेत", wakingTitle: "डेमो सुरू होत आहे", wakingBody: "कोणी वापरत नसेल तर फ्री सर्व्हर झोपतो. साधारण एक मिनिट लागेल — पेज आपोआप पुढे जाईल.",
  bootFailed: "सर्व्हर सुरू होऊ शकला नाही", retry: "पुन्हा प्रयत्न करा", menu: "मेनू", close: "बंद करा", account: "सल्लागार",
};
