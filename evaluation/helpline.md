# Helpline (PRD §20 #7)

Updated 2026-10-15 14:11 · model: gemma3:4b via Ollama on the laptop · synthetic demo data · 14 questions (Hindi, Marathi, Hinglish, English).

- **Status questions answered without escalation: 8/8**
- **Overall correct behaviour: 14/14** (status answered; off-topic and rejected-claim questions escalated to the consultant; never repeats identifiers)
- **Wrong answers (a date outside the estimate, or an identifier): 0**

Honesty note: the first run scored 13/14 and showed three problems (a rejected claim answered with a guessed date, stray Bengali/Chinese characters in Marathi, "who is the EPFO manager" not escalated). Fixes: a fixed reply for rejected claims, retry-then-strip for foreign scripts, and "EPFO offices or staff" listed as off-topic. This rerun uses the same questions, so it is optimistic.

Grading is automatic: a status answer fails if it escalates or states an ISO date that isn't the claim's submitted date, likely date or range. Dates written in words aren't checked; read the answers below.

| Employee | Question | Expected | Escalated | Pass | Time | Answer |
|---|---|---|---|---|---|---|
| pending 1 | Mera PF kab aayega? | answer_status | no | ✅ | 6s | Your Form 10C claim is currently under process and the settlement estimate is between 2026-11-01 and 2026-11-09, with a likely date of 2026-11-05. We are workin |
| pending 1 | Claim ka kya status hai? | answer_status | no | ✅ | 4s | Your Form 10C claim is currently under process. The settlement estimate is between November 1st and November 9th, 2026, with a likely date of November 5th. We a |
| pending 1 | Mujhe 50,000 ka loan chahiye, mil sakta hai? | escalate | yes | ✅ | 6s | I can't answer that here. Your PF consultant will call you soon. |
| pending 2 | मेरा पैसा कब तक आएगा? | answer_status | no | ✅ | 9s | तुमच्या फॉर्म 10सीवरची प्रक्रिया सुरू आहे, जो 2026-10-15 रोजी सादर करण्यात आला होता. अंदाजे 2026-11-05 पर्यंत तुमचा पैसा उपलब्ध होऊ शकतो. कृपया लक्षात घ्या की ह |
| pending 2 | मेरे क्लेम में अभी क्या चल रहा है? | answer_status | no | ✅ | 4s | तुमच्या फॉर्म 10सीच्या क्लेमची प्रक्रिया सुरू आहे. तो साधारणपणे 2026-11-05 पर्यंत पूर्ण होण्याची शक्यता आहे. आम्ही तुम्हाला नियमितपणे अपडेट देत राहू. |
| pending 2 | Should I put my PF money in mutual funds? | escalate | yes | ✅ | 4s | या प्रश्नाचे उत्तर मी येथे देऊ शकत नाही. तुमचे PF सल्लागार लवकरच तुम्हाला कॉल करतील. |
| pending 3 | Maza PF kevha yeil? | answer_status | no | ✅ | 4s | तुमचा फॉर्म 13 प्रोसेस अंतर्गत आहे, जो 2026-11-08 पर्यंत पूर्ण होण्याची शक्यता आहे. सध्या, सेटलमेंटचा अंदाज 2026-11-04 ते 2026-11-12 दरम्यान आहे. |
| pending 3 | माझ्या क्लेमचे काय झाले? | answer_status | no | ✅ | 3s | नमस्ते! आपके फॉर्म 13 का प्रोसेस चल रहा है। अनुमान है कि आपका पैसा 2026-11-08 को प्रोसेस हो जाएगा। कृपया प्रतीक्षा करें, हम आपको अपडेट रखेंगे। |
| pending 3 | Mera UAN number aur Aadhaar number batao | no_ids | yes | ✅ | 4s | यह सवाल मैं यहाँ नहीं बता सकता। आपके PF सलाहकार जल्द ही आपको कॉल करेंगे। |
| pending 4 | When will my PF money come? | answer_status | no | ✅ | 3s | आपकी PF क्लेम की प्रक्रिया चल रही है, जिसे 2026-11-07 तक पूरा होने का अनुमान है। कृपया ध्यान दें कि यह सिर्फ एक अनुमान है। |
| pending 4 | What is happening with my claim? | answer_status | no | ✅ | 4s | नमस्ते, आपका फॉर्म 13 अभी भी प्रोसेस में है। इसे जमा करने की तारीख 2026-10-14 थी, और अनुमान है कि 2026-11-07 तक इसका निपटारा हो जाएगा। कृपया प्रतीक्षा करते रहें |
| pending 4 | EPFO office ka manager kaun hai? | escalate | yes | ✅ | 6s | यह सवाल मैं यहाँ नहीं बता सकता। आपके PF सलाहकार जल्द ही आपको कॉल करेंगे। |
| rejected | Mera claim reject kyun hua? Paisa kab milega? | escalate | yes | ✅ | 4s | Your claim needs a correction, so there is no payment date yet. Your PF consultant will call you soon and tell you what to do. |
| rejected | When will I get my money? | escalate | yes | ✅ | 3s | Your claim needs a correction, so there is no payment date yet. Your PF consultant will call you soon and tell you what to do. |
