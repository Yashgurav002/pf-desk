"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";

// UI chrome only. Data (names, remarks, rule text, model output) and API payloads stay as they are.
export type Lang = "en" | "hi" | "mr";
const KEY = "pfd.lang";

const en = {
  // shell
  today: "Today", claims: "Claims", employees: "Employees", import: "Import", rules: "Rule Book", label: "Label", cycle: "Monthly cycle",
  logout: "Log out", demo: "Demo data only — synthetic",
  footer: "PF Desk helps consultants prepare and check. It does not file with EPFO, and it is not legal or financial advice. Rules change: always verify with the latest EPFO circulars.",
  loading: "Loading…", copy: "Copy", copied: "Copied ✓", notChecked: "not checked", yes: "Yes", no: "No",
  // today
  nothingHere: "Nothing here. 👍", secFix: "Fix before submitting", secRejected: "Rejected — decode and resubmit", secOverdue: "Overdue — past expected date",
  secSalary: "Salary data not received", secPayments: "PF payments due soon", secQuestions: "Employee questions needing you",
  fix: "Fix", decode: "Decode", open: "Open", copyReminder: "Copy reminder", markPaid: "Mark paid", done: "Done",
  problems: "{n} problem(s)", submittedOn: "submitted {d}", expectedWithin: "expected within {n} days", wageMonth: "wage month", due: "due",
  // claims
  newClaimPre: "To start a new claim, go to", newClaimPost: "and press “New claim”.", status: "Status", all: "All", noClaims: "No claims.",
  // employees
  searchEmp: "Search by name or UAN", allEmployers: "All employers", noEmployees: "No employees found.", leftOn: "left {d}",
  claimCount: "{n} claim(s)", newClaim: "New claim", chooseForm: "Choose form:", creatingClaim: "Creating claim…",
  // import
  importTitle: "Import employees", aadhaarNote: "Full Aadhaar numbers are dropped on import; only the last 4 digits are kept.",
  employer: "Employer", chooseEmployer: "Choose employer…", fileLabel: "Excel or CSV file", preview: "Preview", readingFile: "Reading file…",
  matchColumns: "Match columns", colInFile: "Column in your file", pfField: "PF Desk field", skip: "— skip —", first5: "First 5 rows",
  importBtn: "Import", chooseEmployerFirst: "Choose an employer first", importing: "Importing…",
  imported: "{n} employees imported", rowsSkipped: "{n} rows skipped", aadhaarDropped: "{n} full Aadhaar numbers dropped",
  // rules
  rulesSearch: 'Search, e.g. "10C" or "father name"', search: "Search", newRule: "New rule", noRules: "No rules found.",
  verifiedBy: "verified by {who}", onDate: "on {d}", unverified: "Unverified", match: "match", source: "Source", appliesTo: "applies to",
  edit: "Edit", editRule: "Edit {id}", ruleId: "Rule id (e.g. R-FATHER-NAME)", title: "Title", ruleText: "Rule text",
  sourceLong: 'Source (circular number, URL, or "consultant practice")', appliesLong: "Applies to (comma list, e.g. 19, 10C, 31)",
  params: "Params (JSON, optional)", verifiedByInput: "Mark verified by (your name)", save: "Save", saving: "Saving…", cancel: "Cancel",
  // login
  passcode: "Passcode", demoPasscode: "demo passcode:", checking: "Checking…", login: "Log in", wrongPasscode: "Wrong passcode. Please try again.",
  // claim detail
  purpose: "purpose", epfoRemark: "EPFO remark:", changeStatus: "Change status", markAs: "Mark {s}", pasteRemarkPrompt: "Paste the EPFO rejection remark:",
  precheck: "Pre-check", runPrecheck: "Run Pre-check", checkingRisk: "Checking records and predicting risk… (can take up to a minute)",
  rejectionRisk: "Rejection risk:", likely: "Likely by", range: "range", aboutDays: "about {n} days", noProblems: "No problems found. ✓",
  mustFix: "Must fix", check: "Check", fixColon: "Fix:", rule: "rule", explain: "Explain this to me", explaining: "Gemma is writing an explanation…",
  checkRules: "check against the rules before acting", waTitle: "WhatsApp message to employee", draftWa: "Draft WhatsApp message",
  writingMsg: "Writing the message…", copyWa: "Copy WhatsApp message", langHi: "Hindi", langMr: "Marathi", langEn: "English",
  decoder: "Rejection Decoder", pasteRemark: "Paste the rejection remark from the EPFO portal", readingRemark: "Reading the remark…",
  category: "Category:", fieldsInvolved: "Fields involved", fixSteps: "Fix steps", helpLinkTitle: "Help link for employee",
  helpLinkDesc: "A private page where the employee can ask about this claim in Hindi, Marathi or English.", createLink: "Create help link",
  creatingLink: "Creating link…", expires: "expires {d}", facts: "Employee facts",
  f_employer_name: "Employer", f_uan_masked: "UAN", f_name_uan: "Name (UAN)", f_name_bank: "Name (bank)", f_name_aadhaar: "Name (Aadhaar)",
  f_father_name_uan: "Father's name (UAN)", f_father_name_bank: "Father's name (bank)", f_dob_uan: "Date of birth (UAN)",
  f_dob_aadhaar: "Date of birth (Aadhaar)", f_aadhaar_last4: "Aadhaar (last 4)", f_aadhaar_linked: "Aadhaar linked to UAN", f_bank_ifsc: "IFSC",
  f_account_masked: "Bank account", f_bank_verified: "Bank verified", f_kyc_approved_by_employer: "KYC approved by employer", f_phone_masked: "Phone",
  f_date_of_joining: "Date of joining", f_date_of_exit: "Date of exit", f_preferred_language: "Language",
  // label
  labelTitle: "Label rejection remarks", noPii: "Don't include names, UAN, Aadhaar or bank numbers — remarks only.",
  waitingRemarks: "Remarks waiting for a label", noneWaiting: "None waiting. Type one below.", orType: "Or type / paste a remark from the portal",
  whatReason: "What is the reason?", pickFirst: "Pick a remark (or type one) first.", labelledBy: "Labelled by", yourName: "Your name",
  saveNext: "Save → next", labelledCount: "{n} labelled — aim for 150+", saved: "Saved ✓", del: "Delete",
  // help (employee page)
  hello: "Hello {n}", yourClaims: "Your PF claims", ask: "Type your question…", send: "Send", thinking: "Preparing an answer…",
  escalated: "Your question has been sent to your PF consultant. They will contact you.",
  badLink: "This help link is not valid or has expired. Please ask your PF consultant for a new link.",
  wentWrong: "Something went wrong. Please try again later.", noNet: "Could not connect. Please check your internet and try again.",
  // cycle
  stWaiting: "Waiting for salary sheet", stValidating: "Validating", stAwaiting: "Awaiting payment", stPaid: "Paid",
  uploadSheet: "Upload salary sheet", uploading: "Uploading…", startCycle: "Start cycle", openTasks: "Open tasks", noTasks: "No open tasks.",
  totalPayable: "Total payable", toReview: "{n} to review", showTable: "Show validation", hideTable: "Hide validation",
};
export type Key = keyof typeof en;

const hi: Partial<Record<Key, string>> = {
  today: "आज", claims: "क्लेम", employees: "कर्मचारी", import: "इम्पोर्ट", rules: "रूल बुक", label: "लेबल", cycle: "महीने का काम",
  logout: "लॉग आउट", demo: "सिर्फ डेमो डेटा — असली नहीं",
  footer: "PF Desk सलाहकारों को तैयारी और जाँच में मदद करता है। यह EPFO में कुछ फाइल नहीं करता, और यह कानूनी या पैसों से जुड़ी सलाह नहीं है। नियम बदलते रहते हैं: हमेशा EPFO के नए सर्कुलर से मिलान करें।",
  loading: "लोड हो रहा है…", copy: "कॉपी", copied: "कॉपी हो गया ✓", notChecked: "जाँच नहीं हुई", yes: "हाँ", no: "नहीं",
  nothingHere: "कुछ बाकी नहीं। 👍", secFix: "सबमिट करने से पहले ठीक करें", secRejected: "रिजेक्ट हुए — कारण समझें और फिर से भेजें",
  secOverdue: "देर हो गई — तय तारीख निकल गई", secSalary: "सैलरी डेटा नहीं मिला", secPayments: "PF पेमेंट जल्द भरना है", secQuestions: "कर्मचारियों के सवाल — आपको देखना है",
  fix: "ठीक करें", decode: "कारण समझें", open: "खोलें", copyReminder: "रिमाइंडर कॉपी करें", markPaid: "भर दिया", done: "हो गया",
  problems: "{n} गड़बड़ी", submittedOn: "{d} को सबमिट", expectedWithin: "{n} दिन में आना था", wageMonth: "सैलरी महीना", due: "आखिरी तारीख",
  newClaimPre: "नया क्लेम शुरू करने के लिए", newClaimPost: "पेज पर जाएँ और “नया क्लेम” दबाएँ।", status: "स्टेटस", all: "सभी", noClaims: "कोई क्लेम नहीं।",
  searchEmp: "नाम या UAN से खोजें", allEmployers: "सभी कंपनियाँ", noEmployees: "कोई कर्मचारी नहीं मिला।", leftOn: "{d} को नौकरी छोड़ी",
  claimCount: "{n} क्लेम", newClaim: "नया क्लेम", chooseForm: "फॉर्म चुनें:", creatingClaim: "क्लेम बन रहा है…",
  importTitle: "कर्मचारी इम्पोर्ट करें", aadhaarNote: "इम्पोर्ट में पूरा आधार नंबर हटा दिया जाता है; सिर्फ आखिरी 4 अंक रखे जाते हैं।",
  employer: "कंपनी", chooseEmployer: "कंपनी चुनें…", fileLabel: "Excel या CSV फ़ाइल", preview: "पहले देखें", readingFile: "फ़ाइल पढ़ रहे हैं…",
  matchColumns: "कॉलम मिलाएँ", colInFile: "आपकी फ़ाइल का कॉलम", pfField: "PF Desk फ़ील्ड", skip: "— छोड़ें —", first5: "पहली 5 लाइनें",
  importBtn: "इम्पोर्ट करें", chooseEmployerFirst: "पहले कंपनी चुनें", importing: "इम्पोर्ट हो रहा है…",
  imported: "{n} कर्मचारी इम्पोर्ट हुए", rowsSkipped: "{n} लाइनें छोड़ी गईं", aadhaarDropped: "{n} पूरे आधार नंबर हटाए गए",
  rulesSearch: 'खोजें, जैसे "10C" या "father name"', search: "खोजें", newRule: "नया नियम", noRules: "कोई नियम नहीं मिला।",
  verifiedBy: "{who} ने जाँचा", onDate: "{d} को", unverified: "जाँच बाकी", match: "मेल", source: "स्रोत", appliesTo: "लागू",
  edit: "बदलें", editRule: "{id} बदलें", ruleId: "नियम ID (जैसे R-FATHER-NAME)", title: "शीर्षक", ruleText: "नियम",
  sourceLong: 'स्रोत (सर्कुलर नंबर, URL, या "consultant practice")', appliesLong: "किन फॉर्म पर लागू (कॉमा से अलग, जैसे 19, 10C, 31)",
  params: "Params (JSON, ज़रूरी नहीं)", verifiedByInput: "जाँच करने वाले का नाम (आपका नाम)", save: "सेव करें", saving: "सेव हो रहा है…", cancel: "रद्द करें",
  passcode: "पासकोड", demoPasscode: "डेमो पासकोड:", checking: "जाँच रहे हैं…", login: "लॉग इन", wrongPasscode: "पासकोड गलत है। फिर से कोशिश करें।",
  purpose: "किसलिए", epfoRemark: "EPFO रिमार्क:", changeStatus: "स्टेटस बदलें", markAs: "{s} मार्क करें", pasteRemarkPrompt: "EPFO का रिजेक्शन रिमार्क यहाँ पेस्ट करें:",
  runPrecheck: "Pre-check चलाएँ", checkingRisk: "रिकॉर्ड जाँच रहे हैं और रिस्क देख रहे हैं… (एक मिनट तक लग सकता है)",
  rejectionRisk: "रिजेक्ट होने का खतरा:", likely: "संभावित तारीख", range: "रेंज", aboutDays: "लगभग {n} दिन", noProblems: "कोई गड़बड़ी नहीं मिली। ✓",
  mustFix: "ज़रूर ठीक करें", check: "जाँचें", fixColon: "उपाय:", rule: "नियम", explain: "मुझे समझाइए", explaining: "Gemma समझा रहा है…",
  checkRules: "कुछ करने से पहले नियमों से मिला लें", waTitle: "कर्मचारी को WhatsApp मैसेज", draftWa: "WhatsApp मैसेज बनाएँ",
  writingMsg: "मैसेज लिख रहे हैं…", copyWa: "WhatsApp मैसेज कॉपी करें", langHi: "हिंदी", langMr: "मराठी", langEn: "अंग्रेज़ी",
  decoder: "रिजेक्शन डिकोडर", pasteRemark: "EPFO पोर्टल से रिजेक्शन रिमार्क पेस्ट करें", readingRemark: "रिमार्क पढ़ रहे हैं…",
  category: "कैटेगरी:", fieldsInvolved: "कौन से फ़ील्ड", fixSteps: "ठीक करने के कदम", helpLinkTitle: "कर्मचारी के लिए हेल्प लिंक",
  helpLinkDesc: "एक निजी पेज जहाँ कर्मचारी इस क्लेम के बारे में हिंदी, मराठी या अंग्रेज़ी में पूछ सकते हैं।", createLink: "हेल्प लिंक बनाएँ",
  creatingLink: "लिंक बन रहा है…", expires: "{d} तक चलेगा", facts: "कर्मचारी की जानकारी",
  f_employer_name: "कंपनी", f_name_uan: "नाम (UAN)", f_name_bank: "नाम (बैंक)", f_name_aadhaar: "नाम (आधार)",
  f_father_name_uan: "पिता का नाम (UAN)", f_father_name_bank: "पिता का नाम (बैंक)", f_dob_uan: "जन्म तारीख (UAN)", f_dob_aadhaar: "जन्म तारीख (आधार)",
  f_aadhaar_last4: "आधार (आखिरी 4)", f_aadhaar_linked: "आधार UAN से जुड़ा है", f_account_masked: "बैंक खाता", f_bank_verified: "बैंक वेरिफ़ाइड",
  f_kyc_approved_by_employer: "कंपनी ने KYC मंज़ूर किया", f_phone_masked: "फ़ोन", f_date_of_joining: "जॉइनिंग की तारीख",
  f_date_of_exit: "नौकरी छोड़ने की तारीख", f_preferred_language: "भाषा",
  labelTitle: "रिजेक्शन रिमार्क पर लेबल लगाएँ", noPii: "नाम, UAN, आधार या बैंक नंबर न डालें — सिर्फ रिमार्क।",
  waitingRemarks: "लेबल के इंतज़ार में रिमार्क", noneWaiting: "कोई बाकी नहीं। नीचे लिखें।", orType: "या पोर्टल से रिमार्क लिखें / पेस्ट करें",
  whatReason: "कारण क्या है?", pickFirst: "पहले रिमार्क चुनें (या लिखें)।", labelledBy: "लेबल किसने लगाया", yourName: "आपका नाम",
  saveNext: "सेव करें → अगला", labelledCount: "{n} लेबल हो गए — 150+ का लक्ष्य", saved: "सेव हो गया ✓", del: "हटाएँ",
  hello: "नमस्ते {n} जी", yourClaims: "आपके PF क्लेम", ask: "अपना सवाल लिखें…", send: "भेजें", thinking: "जवाब तैयार हो रहा है…",
  escalated: "आपका सवाल आपके PF सलाहकार को भेज दिया गया है। वे आपसे संपर्क करेंगे।",
  badLink: "यह हेल्प लिंक सही नहीं है या इसकी तारीख निकल गई है। अपने PF सलाहकार से नया लिंक माँगें।",
  wentWrong: "कुछ गड़बड़ हो गई। थोड़ी देर बाद फिर कोशिश करें।", noNet: "कनेक्ट नहीं हो पाया। इंटरनेट चेक करके फिर कोशिश करें।",
  // cycle
  stWaiting: "सैलरी शीट का इंतज़ार", stValidating: "जाँच हो रही है", stAwaiting: "पेमेंट बाकी", stPaid: "पेमेंट हो गया",
  uploadSheet: "सैलरी शीट अपलोड करें", uploading: "अपलोड हो रहा है…", startCycle: "साइकिल शुरू करें", openTasks: "बाकी काम", noTasks: "कोई बाकी काम नहीं।",
  totalPayable: "कुल देय", toReview: "{n} जाँचने हैं", showTable: "जाँच देखें", hideTable: "जाँच छुपाएँ",
};

const mr: Partial<Record<Key, string>> = {
  today: "आज", claims: "क्लेम", employees: "कर्मचारी", import: "इम्पोर्ट", rules: "रूल बुक", label: "लेबल", cycle: "महिन्याचे काम",
  logout: "लॉग आउट", demo: "फक्त डेमो डेटा — खरा नाही",
  footer: "PF Desk सल्लागारांना तयारी आणि तपासणीत मदत करते. हे EPFO मध्ये काहीही फाइल करत नाही, आणि हा कायदेशीर किंवा पैशांबाबतचा सल्ला नाही. नियम बदलत असतात: नेहमी EPFO चे नवीन सर्क्युलर तपासा.",
  loading: "लोड होत आहे…", copy: "कॉपी", copied: "कॉपी झाले ✓", notChecked: "तपासले नाही", yes: "हो", no: "नाही",
  nothingHere: "काही बाकी नाही. 👍", secFix: "सबमिट करण्याआधी दुरुस्त करा", secRejected: "रिजेक्ट झालेले — कारण समजून पुन्हा पाठवा",
  secOverdue: "उशीर झाला — अपेक्षित तारीख उलटली", secSalary: "पगाराचा डेटा मिळाला नाही", secPayments: "PF पेमेंट लवकर भरायचे आहे", secQuestions: "कर्मचाऱ्यांचे प्रश्न — तुम्ही पाहायचे आहेत",
  fix: "दुरुस्त करा", decode: "कारण समजून घ्या", open: "उघडा", copyReminder: "रिमाइंडर कॉपी करा", markPaid: "भरले", done: "झाले",
  problems: "{n} अडचणी", submittedOn: "{d} ला सबमिट", expectedWithin: "{n} दिवसांत यायला हवा होता", wageMonth: "पगार महिना", due: "शेवटची तारीख",
  newClaimPre: "नवीन क्लेम सुरू करण्यासाठी", newClaimPost: "पेजवर जा आणि “नवीन क्लेम” दाबा.", status: "स्टेटस", all: "सर्व", noClaims: "एकही क्लेम नाही.",
  searchEmp: "नाव किंवा UAN ने शोधा", allEmployers: "सर्व कंपन्या", noEmployees: "एकही कर्मचारी सापडला नाही.", leftOn: "{d} ला नोकरी सोडली",
  claimCount: "{n} क्लेम", newClaim: "नवीन क्लेम", chooseForm: "फॉर्म निवडा:", creatingClaim: "क्लेम तयार होत आहे…",
  importTitle: "कर्मचारी इम्पोर्ट करा", aadhaarNote: "इम्पोर्ट करताना पूर्ण आधार नंबर काढून टाकला जातो; फक्त शेवटचे 4 अंक ठेवले जातात.",
  employer: "कंपनी", chooseEmployer: "कंपनी निवडा…", fileLabel: "Excel किंवा CSV फाइल", preview: "आधी पाहा", readingFile: "फाइल वाचत आहे…",
  matchColumns: "कॉलम जुळवा", colInFile: "तुमच्या फाइलमधील कॉलम", pfField: "PF Desk फील्ड", skip: "— वगळा —", first5: "पहिल्या 5 ओळी",
  importBtn: "इम्पोर्ट करा", chooseEmployerFirst: "आधी कंपनी निवडा", importing: "इम्पोर्ट होत आहे…",
  imported: "{n} कर्मचारी इम्पोर्ट झाले", rowsSkipped: "{n} ओळी वगळल्या", aadhaarDropped: "{n} पूर्ण आधार नंबर काढले",
  rulesSearch: 'शोधा, उदा. "10C" किंवा "father name"', search: "शोधा", newRule: "नवीन नियम", noRules: "एकही नियम सापडला नाही.",
  verifiedBy: "{who} यांनी तपासले", onDate: "{d} रोजी", unverified: "तपासणी बाकी", match: "जुळणी", source: "स्रोत", appliesTo: "लागू",
  edit: "बदला", editRule: "{id} बदला", ruleId: "नियम ID (उदा. R-FATHER-NAME)", title: "शीर्षक", ruleText: "नियमाचा मजकूर",
  sourceLong: 'स्रोत (सर्क्युलर नंबर, URL, किंवा "consultant practice")', appliesLong: "कोणत्या फॉर्मला लागू (कॉमाने वेगळे, उदा. 19, 10C, 31)",
  params: "Params (JSON, गरज असल्यास)", verifiedByInput: "तपासणाऱ्याचे नाव (तुमचे नाव)", save: "सेव करा", saving: "सेव होत आहे…", cancel: "रद्द करा",
  passcode: "पासकोड", demoPasscode: "डेमो पासकोड:", checking: "तपासत आहे…", login: "लॉग इन", wrongPasscode: "पासकोड चुकीचा आहे. पुन्हा प्रयत्न करा.",
  purpose: "कशासाठी", epfoRemark: "EPFO रिमार्क:", changeStatus: "स्टेटस बदला", markAs: "{s} मार्क करा", pasteRemarkPrompt: "EPFO चा रिजेक्शन रिमार्क इथे पेस्ट करा:",
  runPrecheck: "Pre-check चालवा", checkingRisk: "रेकॉर्ड तपासत आहे आणि रिस्क पाहत आहे… (एक मिनिट लागू शकतो)",
  rejectionRisk: "रिजेक्ट होण्याचा धोका:", likely: "अपेक्षित तारीख", range: "रेंज", aboutDays: "साधारण {n} दिवस", noProblems: "काही अडचण सापडली नाही. ✓",
  mustFix: "नक्की दुरुस्त करा", check: "तपासा", fixColon: "उपाय:", rule: "नियम", explain: "मला समजावून सांगा", explaining: "Gemma समजावून लिहित आहे…",
  checkRules: "काही करण्याआधी नियमांशी जुळवून पाहा", waTitle: "कर्मचाऱ्याला WhatsApp मेसेज", draftWa: "WhatsApp मेसेज तयार करा",
  writingMsg: "मेसेज लिहित आहे…", copyWa: "WhatsApp मेसेज कॉपी करा", langHi: "हिंदी", langMr: "मराठी", langEn: "इंग्रजी",
  decoder: "रिजेक्शन डिकोडर", pasteRemark: "EPFO पोर्टलवरचा रिजेक्शन रिमार्क पेस्ट करा", readingRemark: "रिमार्क वाचत आहे…",
  category: "कॅटेगरी:", fieldsInvolved: "कोणते फील्ड", fixSteps: "दुरुस्त करण्याच्या पायऱ्या", helpLinkTitle: "कर्मचाऱ्यासाठी हेल्प लिंक",
  helpLinkDesc: "एक खाजगी पेज जिथे कर्मचारी या क्लेमबद्दल हिंदी, मराठी किंवा इंग्रजीत विचारू शकतात.", createLink: "हेल्प लिंक तयार करा",
  creatingLink: "लिंक तयार होत आहे…", expires: "{d} पर्यंत चालेल", facts: "कर्मचाऱ्याची माहिती",
  f_employer_name: "कंपनी", f_name_uan: "नाव (UAN)", f_name_bank: "नाव (बँक)", f_name_aadhaar: "नाव (आधार)",
  f_father_name_uan: "वडिलांचे नाव (UAN)", f_father_name_bank: "वडिलांचे नाव (बँक)", f_dob_uan: "जन्मतारीख (UAN)", f_dob_aadhaar: "जन्मतारीख (आधार)",
  f_aadhaar_last4: "आधार (शेवटचे 4)", f_aadhaar_linked: "आधार UAN शी जोडलेले", f_account_masked: "बँक खाते", f_bank_verified: "बँक व्हेरिफाइड",
  f_kyc_approved_by_employer: "कंपनीने KYC मंजूर केले", f_phone_masked: "फोन", f_date_of_joining: "जॉइनिंग तारीख",
  f_date_of_exit: "नोकरी सोडल्याची तारीख", f_preferred_language: "भाषा",
  labelTitle: "रिजेक्शन रिमार्कला लेबल लावा", noPii: "नाव, UAN, आधार किंवा बँक नंबर टाकू नका — फक्त रिमार्क.",
  waitingRemarks: "लेबलची वाट पाहणारे रिमार्क", noneWaiting: "काही बाकी नाही. खाली लिहा.", orType: "किंवा पोर्टलवरचा रिमार्क लिहा / पेस्ट करा",
  whatReason: "कारण काय आहे?", pickFirst: "आधी रिमार्क निवडा (किंवा लिहा).", labelledBy: "लेबल कोणी लावले", yourName: "तुमचे नाव",
  saveNext: "सेव करा → पुढचा", labelledCount: "{n} लेबल झाले — 150+ चे लक्ष्य", saved: "सेव झाले ✓", del: "काढा",
  hello: "नमस्कार {n}", yourClaims: "तुमचे PF क्लेम", ask: "तुमचा प्रश्न लिहा…", send: "पाठवा", thinking: "उत्तर तयार होत आहे…",
  escalated: "तुमचा प्रश्न तुमच्या PF सल्लागारांना पाठवला आहे. ते तुमच्याशी संपर्क करतील.",
  badLink: "ही हेल्प लिंक बरोबर नाही किंवा तिची मुदत संपली आहे. तुमच्या PF सल्लागारांकडून नवीन लिंक मागा.",
  wentWrong: "काहीतरी चुकले. थोड्या वेळाने पुन्हा प्रयत्न करा.", noNet: "कनेक्ट होऊ शकले नाही. इंटरनेट तपासून पुन्हा प्रयत्न करा.",
  // cycle
  stWaiting: "पगार शीटची वाट", stValidating: "तपासणी सुरू", stAwaiting: "पेमेंट बाकी", stPaid: "पेमेंट झाले",
  uploadSheet: "पगार शीट अपलोड करा", uploading: "अपलोड होत आहे…", startCycle: "सायकल सुरू करा", openTasks: "बाकी कामे", noTasks: "कोणतेही बाकी काम नाही.",
  totalPayable: "एकूण देय", toReview: "{n} तपासायचे", showTable: "तपासणी पहा", hideTable: "तपासणी लपवा",
};

const DICT: Record<Lang, Partial<Record<Key, string>>> = { en, hi, mr };

type Ctx = { lang: Lang; setLang: (l: Lang) => void; setDefault: (l: Lang) => void; t: (k: Key, v?: Record<string, string | number>) => string };
const LangCtx = createContext<Ctx | null>(null);

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setL] = useState<Lang>("en");
  const chosen = useRef(false); // true once the viewer picked a language (now or on an earlier visit)
  useEffect(() => {
    try {
      const s = localStorage.getItem(KEY);
      if (s === "en" || s === "hi" || s === "mr") { chosen.current = true; setL(s); }
    } catch {}
  }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const setLang = (l: Lang) => { chosen.current = true; setL(l); try { localStorage.setItem(KEY, l); } catch {} };
  // A page's own default (e.g. the employee's preferred language); ignored once the viewer has picked one.
  const setDefault = (l: Lang) => { if (!chosen.current) setL(l); };
  const t: Ctx["t"] = (k, v) => {
    let s = DICT[lang][k] ?? en[k] ?? k;
    for (const [name, val] of Object.entries(v ?? {})) s = s.replace(`{${name}}`, String(val));
    return s;
  };
  return <LangCtx.Provider value={{ lang, setLang, setDefault, t }}>{children}</LangCtx.Provider>;
}

export function useT() {
  const c = useContext(LangCtx);
  if (!c) throw new Error("useT needs <LangProvider>");
  return c;
}

export function LangToggle() {
  const { lang, setLang } = useT();
  return (
    <div className="flex gap-1" role="group" aria-label="Language">
      {(["en", "hi", "mr"] as const).map((l) => (
        <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l}
          className={`min-h-11 min-w-11 rounded-lg px-3 py-2 font-semibold ${lang === l ? "bg-blue-700 text-white" : "border-2 border-gray-500 bg-white text-gray-900"}`}>
          {{ en: "EN", hi: "हिं", mr: "मरा" }[l]}
        </button>
      ))}
    </div>
  );
}
