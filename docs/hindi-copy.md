# Hindi copy translation draft

Documentation-only draft for the visible copy on `/`, `/signup`, and `/signin`.
This file does not change the app, configuration, package files, or live copy.

## Scope, status, and labels

- **`[LIVE]`** means the waitlist path and its status messages are implemented and can save a waitlist entry when the deployed waitlist configuration is available. `/signin` is intentionally a stub and sends nothing.
- **`[DEMO]`** means a labelled landing-page demonstration. The sample tip card, sample stream alert, handoff, alert fan, and QR drawing do not take a payment, connect to OBS, generate a live creator QR, or send anything to a stream.
- **`[PLANNED]`** means future product behavior or copy direction: a creator tip page, real UPI/card checkout, an OBS alert link, moderation, text-to-speech, approval, and a creator QR. Do not present these as live features.
- **`[A11Y]`** is an accessibility-only label. It is included for translation coverage but is not normally visible on screen.
- Backticks in the first column preserve the exact current English string. `{amount}`, `{name}`, and `{message}` are current runtime values; the source also supplies the concrete sample values listed in the same row.

## Translation and usage note

Use short, spoken Hindi in Devanagari and conversational Hinglish in Roman script, with an Indian streamer/gamer voice rather than formal textbook Hindi. Keep **Tipsite, UPI, OBS, link, handle, stream, tip, card, email, QR, text-to-speech, creator, approval, Razorpay, YouTube**, URLs, sample names, amounts, and message limits in English/Latin script when that is the clearest UI treatment. `Tipsite` and `tipsite.in` are still placeholders; do not treat either as a finalized brand or domain. Do not translate a handle or URL.

The source copy is an audit of what is currently visible; it is not a claim that every demonstrated flow is live. Keep the sample labels exactly meaningful: `Sample page. No payment is taken.`, `Sample alert. Nothing is sent to a stream.`, `Sample only. No money moved.`, and `Non-scannable sample QR` are **`[DEMO]`** labels. The waitlist success and validation states are **`[LIVE]`**; the sign-in closed state is also live behavior, but it explicitly says that nothing was sent. Product payment, OBS, QR, filtering, approval, and TTS copy outside the waitlist remains **`[PLANNED]`**.

The money facts must not drift in translation: the platform fee is **5% of every tip**; **Razorpay's charge is on top of that 5% and is paid by the creator out of the payout**; on the worked example, **₹100 → ₹92.64**; and fans need **no account and no email**. Keep `₹100.00`, `−₹5.00`, `−₹2.36`, and `₹92.64` together and non-wrapping in UI.

## Current visible copy inventory

Coverage note: `src/components/auth/AuthShell.tsx` is layout-only and adds no visible words. `src/lib/legal.ts` supplies the fee values and operator constants already cited below; `src/lib/waitlist.ts` supplies the waitlist validation/status strings listed below.

### Shared shell, navigation, and footer

| Current English (exact) and source file | Natural Hindi (Devanagari) | Natural Hinglish (Roman) |
|---|---|---|
| `[A11Y]` `Skip to content`<br>Source: `src/app/page.tsx`; `src/components/PageShell.tsx` | `सीधे content पर जाएँ` | `Seedhe content par jaayen` |
| `Tipsite`<br>Source: `src/lib/site.ts`, rendered by `src/components/Nav.tsx`, `src/components/PageShell.tsx`, `src/components/Footer.tsx` | `Tipsite` | `Tipsite` |
| `How it works`<br>Source: `src/components/Nav.tsx`, `src/components/sections/Steps.tsx`, `src/components/Footer.tsx` | `यह कैसे काम करता है` | `Yeh kaise kaam karta hai` |
| `On stream`<br>Source: `src/components/Nav.tsx`, `src/components/Footer.tsx` | `stream पर` | `Stream par` |
| `Why Tipsite`<br>Source: `src/components/Nav.tsx`, `src/components/sections/Differentiators.tsx`, `src/components/Footer.tsx` | `Tipsite क्यों` | `Tipsite kyun` |
| `Fees`<br>Source: `src/components/Nav.tsx`, `src/components/Footer.tsx` | `Fees` | `Fees` |
| `FAQ`<br>Source: `src/components/Nav.tsx`, `src/components/Footer.tsx` | `FAQ` | `FAQ` |
| `Sign in`<br>Source: `src/components/Nav.tsx`, `src/components/auth/SignInForm.tsx` | `Sign in` | `Sign in` |
| `Sign up`<br>Source: `src/components/Nav.tsx`, `src/components/auth/SignInForm.tsx` | `Sign up` | `Sign up` |
| `Back to home`<br>Source: `src/components/PageShell.tsx` | `होम पर वापस जाएँ` | `Home par wapas jaayen` |
| `Tips for Indian YouTube streamers, paid by UPI or card. Not live yet.`<br>Source: `src/components/Footer.tsx` | `Indian YouTube streamers के लिए tips, UPI या card से paid। अभी live नहीं है।` | `Indian YouTube streamers ke liye tips, UPI ya card se paid. Abhi live nahi hai.` |
| `Product`<br>Source: `src/components/Footer.tsx` | `Product` | `Product` |
| `Company`<br>Source: `src/components/Footer.tsx` | `Company` | `Company` |
| `Legal`<br>Source: `src/components/Footer.tsx` | `Legal` | `Legal` |
| `About`<br>Source: `src/components/Footer.tsx` | `About` | `About` |
| `Pricing`<br>Source: `src/components/Footer.tsx` | `Pricing` | `Pricing` |
| `Contact and grievances`<br>Source: `src/components/Footer.tsx` | `Contact और शिकायतें` | `Contact aur shikaayatein` |
| `Terms of service`<br>Source: `src/components/Footer.tsx` | `Terms of service` | `Terms of service` |
| `Privacy policy`<br>Source: `src/components/Footer.tsx`, `src/components/waitlist/useWaitlist.tsx` | `Privacy policy` | `Privacy policy` |
| `Refunds and cancellations`<br>Source: `src/components/Footer.tsx` | `Refunds और cancellations` | `Refunds aur cancellations` |
| `Delivery policy`<br>Source: `src/components/Footer.tsx` | `Delivery policy` | `Delivery policy` |
| `© 2026 Tipsite`<br>Source: `src/components/Footer.tsx`, value from `src/lib/legal.ts`/`src/lib/site.ts` | `© 2026 Tipsite` | `© 2026 Tipsite` |

### Home — hero, sample tip card, sending state, and alert fan

| Current English (exact) and source file | Natural Hindi (Devanagari) | Natural Hinglish (Roman) |
|---|---|---|
| `[PLANNED]` `Your link.`<br>Source: `src/components/hero/Hero.tsx` | `आपका link।` | `Aapka link.` |
| `[PLANNED]` `Their UPI.`<br>Source: `src/components/hero/Hero.tsx` | `उनका UPI।` | `Unka UPI.` |
| `[PLANNED]` `Your bank.`<br>Source: `src/components/hero/Hero.tsx` | `आपका bank।` | `Aapka bank.` |
| `[PLANNED]` `Tips for YouTube streamers, with OBS alerts and text-to-speech. Fans pay with UPI or card, no account needed.`<br>Source: `src/components/hero/Hero.tsx` | `YouTube streamers के लिए tips—OBS alerts और text-to-speech के साथ। Fans UPI या card से pay करते हैं; account की ज़रूरत नहीं।` | `YouTube streamers ke liye tips—OBS alerts aur text-to-speech ke saath. Fans UPI ya card se pay karte hain; account ki zaroorat nahi.` |
| `[PLANNED]` `Claim your handle`<br>Source: `src/components/hero/Hero.tsx` | `अपना handle claim करें` | `Apna handle claim karein` |
| `See how it works`<br>Source: `src/components/hero/Hero.tsx` | `यह कैसे काम करता है देखें` | `Yeh kaise kaam karta hai dekhein` |
| `[DEMO]` `Sample page. No payment is taken.`<br>Source: `src/components/hero/TipCard.tsx` | `Sample page। कोई payment नहीं लिया जाता।` | `Sample page. Koi payment nahi liya jaata.` |
| `[DEMO]` `Aarav Plays`<br>Source: `src/components/hero/TipCard.tsx` | `Aarav Plays` | `Aarav Plays` |
| `[DEMO]` `tipsite.in/aarav`<br>Source: `src/components/hero/TipCard.tsx`, values from `src/lib/site.ts` | `tipsite.in/aarav` | `tipsite.in/aarav` |
| `[DEMO]` `Amount`<br>Source: `src/components/hero/TipCard.tsx` | `रकम` | `Rakam` |
| `[DEMO]` `₹50`<br>Source: `src/components/hero/TipCard.tsx` | `₹50` | `₹50` |
| `[DEMO]` `₹100`<br>Source: `src/components/hero/TipCard.tsx` | `₹100` | `₹100` |
| `[DEMO]` `₹250`<br>Source: `src/components/hero/TipCard.tsx` | `₹250` | `₹250` |
| `[DEMO]` `₹500`<br>Source: `src/components/hero/TipCard.tsx` | `₹500` | `₹500` |
| `[DEMO]` `Name (optional)`<br>Source: `src/components/hero/TipCard.tsx` | `नाम (optional)` | `Name (optional)` |
| `[DEMO]` `Anonymous`<br>Source: `src/components/hero/TipCard.tsx` | `Anonymous` | `Anonymous` |
| `[DEMO]` `Your name`<br>Source: `src/components/hero/TipCard.tsx` | `आपका नाम` | `Aapka naam` |
| `[DEMO]` `Message (limit applies)`<br>Source: `src/components/hero/TipCard.tsx` | `Message (limit लागू है)` | `Message (limit laagu hai)` |
| `[DEMO]` `Say something nice`<br>Source: `src/components/hero/TipCard.tsx` | `कुछ अच्छा कहें` | `Kuch achha kahein` |
| `[DEMO]` `Tip anonymously`<br>Source: `src/components/hero/TipCard.tsx` | `Anonymous tip दें` | `Anonymous tip dein` |
| `[DEMO]` `Pay with`<br>Source: `src/components/hero/TipCard.tsx` | `भुगतान करें:` | `Payment karein:` |
| `[DEMO]` `UPI`<br>Source: `src/components/hero/TipCard.tsx`, `src/components/sections/Money.tsx`, `src/components/sections/Differentiators.tsx` | `UPI` | `UPI` |
| `[DEMO]` `Card`<br>Source: `src/components/hero/TipCard.tsx`, `src/components/sections/Differentiators.tsx` | `Card` | `Card` |
| `[DEMO]` `No account or email needed. Messages are screened and only read out after creator approval.`<br>Source: `src/components/hero/TipCard.tsx` | `Account या email की ज़रूरत नहीं। Messages की screening होती है और creator की approval के बाद ही read out किए जाते हैं।` | `Account ya email ki zaroorat nahi. Messages screen hote hain aur creator ki approval ke baad hi read out kiye jaate hain.` |
| `[DEMO]` Rendered submit labels: `Tip ₹50 with UPI`, `Tip ₹100 with UPI`, `Tip ₹250 with UPI`, `Tip ₹500 with UPI`; the same four amounts with `card`<br>Source template: `src/components/hero/TipCard.tsx` | `UPI से ₹{amount} tip दें` / `card से ₹{amount} tip दें` | `UPI se ₹{amount} tip dein` / `card se ₹{amount} tip dein` |
| `[DEMO]` `Sending ₹{amount}` (screen-reader status; rendered as `Sending ₹50`, `Sending ₹100`, `Sending ₹250`, or `Sending ₹500`)<br>Source: `src/components/hero/TipCard.tsx` | `₹{amount} भेजा जा रहा है` | `₹{amount} bheja ja raha hai` |
| `[DEMO]` `SECURE CHANNEL`<br>Source: `src/components/hero/UplinkPanel.tsx` | `सुरक्षित चैनल` | `Surakshit channel` |
| `[DEMO]` `SENDING ₹{amount}`<br>Source: `src/components/hero/UplinkPanel.tsx` | `₹{amount} भेज रहे हैं` | `₹{amount} bhej rahe hain` |
| `[DEMO]` `SECURING UPLINK`<br>Source: `src/components/hero/UplinkPanel.tsx` | `UPLINK सुरक्षित किया जा रहा है` | `UPLINK secure kiya ja raha hai` |
| `[DEMO]` `TIP SENT`<br>Source: `src/components/hero/UplinkPanel.tsx` | `TIP भेज दिया गया` | `TIP bhej diya gaya` |
| `[DEMO]` `Sample alert`<br>Source: `src/components/hero/AlertFan.tsx`, `src/components/sections/Stream.tsx` | `Sample alert` | `Sample alert` |
| `[DEMO]` `{name} tipped` (current samples include `Anonymous tipped`, `Kabir tipped`, and later `Riya tipped`)<br>Source: `src/components/hero/AlertFan.tsx`, value from `src/lib/site.ts` | `{name} ने tip दिया` | `{name} ne tip diya` |
| `[DEMO]` `Love the stream`<br>Source: `src/components/hero/Hero.tsx` | `Stream बहुत बढ़िया है` | `Stream bahut badhiya hai` |
| `[DEMO]` `GG!`<br>Source: `src/components/hero/Hero.tsx` | `GG!` | `GG!` |
| `[DEMO]` `Tip sent to Aarav.`<br>Source: `src/components/hero/TipCard.tsx` | `Aarav को tip भेज दी गई।` | `Aarav ko tip bhej di gayi.` |
| `[DEMO]` `Sample only. No money moved.`<br>Source: `src/components/hero/TipCard.tsx` | `सिर्फ़ sample। कोई पैसा नहीं गया।` | `Sirf sample. Koi paisa nahi gaya.` |
| `[DEMO]` `Tip again`<br>Source: `src/components/hero/TipCard.tsx` | `फिर से tip दें` | `Phir se tip dein` |

### Home — how it works

| Current English (exact) and source file | Natural Hindi (Devanagari) | Natural Hinglish (Roman) |
|---|---|---|
| `[PLANNED]` `How it works`<br>Source: `src/components/sections/Steps.tsx` | `यह कैसे काम करता है` | `Yeh kaise kaam karta hai` |
| `[PLANNED]` `Claim`<br>Source: `src/components/sections/Steps.tsx` | `Handle लें` | `Handle lein` |
| `[PLANNED]` `Pick a handle. Your page lives at tipsite.in/yourname.`<br>Source: `src/components/sections/Steps.tsx`, `src/lib/site.ts` | `एक handle चुनें। आपका page tipsite.in/yourname पर होगा।` | `Ek handle chunein. Aapka page tipsite.in/yourname par hoga.` |
| `[PLANNED]` `Share`<br>Source: `src/components/sections/Steps.tsx` | `Share करें` | `Share karein` |
| `[PLANNED]` `Put the link in your video descriptions, pinned comments and community posts.`<br>Source: `src/components/sections/Steps.tsx` | `Link को अपने video descriptions, pinned comments और community posts में डालें।` | `Link ko apne video descriptions, pinned comments aur community posts mein daalein.` |
| `[PLANNED]` `Go live`<br>Source: `src/components/sections/Steps.tsx` | `Live जाएँ` | `Live jaayen` |
| `[PLANNED]` `Tips show up on your stream as OBS alerts. You choose whether alerts show, whether messages are read out and whether you approve each one first.`<br>Source: `src/components/sections/Steps.tsx` | `Tips आपकी stream पर OBS alerts के रूप में दिखेंगे। Alerts दिखें या नहीं, messages read out हों या नहीं, और हर message को पहले approve करना है या नहीं—यह आप चुनते हैं।` | `Tips aapki stream par OBS alerts ke roop mein dikhenge. Alerts dikhein ya nahi, messages read out hon ya nahi, aur har message ko pehle approve karna hai ya nahi—yeh aap chunte hain.` |
| `[PLANNED]` `Get paid`<br>Source: `src/components/sections/Steps.tsx` | `Payment पाएँ` | `Payment paayen` |
| `[PLANNED]` `Fans pay with UPI or card. Tips are paid out to your bank account in INR.`<br>Source: `src/components/sections/Steps.tsx` | `Fans UPI या card से pay करते हैं। Tips आपके bank account में INR में भेजे जाते हैं।` | `Fans UPI ya card se pay karte hain. Tips aapke bank account mein INR mein bheje jaate hain.` |

### Home — on your stream sample and settings

| Current English (exact) and source file | Natural Hindi (Devanagari) | Natural Hinglish (Roman) |
|---|---|---|
| `[DEMO]` `On your stream`<br>Source: `src/components/sections/Stream.tsx` | `आपकी stream पर` | `Aapki stream par` |
| `[PLANNED]` `OBS alerts.`<br>Source: `src/components/sections/Stream.tsx` | `OBS alerts।` | `OBS alerts.` |
| `[PLANNED]` `Tips can show up on your stream with the fan's optional name, the amount and their message.`<br>Source: `src/components/sections/Stream.tsx` | `Tips आपकी stream पर fan के optional नाम, रकम और message के साथ दिख सकती हैं।` | `Tips aapki stream par fan ke optional naam, amount aur message ke saath dikh sakti hain.` |
| `[PLANNED]` `Safer text-to-speech.`<br>Source: `src/components/sections/Stream.tsx` | `ज़्यादा सुरक्षित text-to-speech (?)।` | `Zyada safe text-to-speech (?)` |
| `[PLANNED]` `Messages are screened first, and with approve-first on, nothing is read out until you okay it.`<br>Source: `src/components/sections/Stream.tsx` | `Messages पहले screen होते हैं और approve-first on होने पर आपकी मंज़ूरी तक कुछ भी read out नहीं होता।` | `Messages pehle screen hote hain, aur approve-first on hone par aapki manzoori tak kuch bhi read out nahi hota.` |
| `[DEMO]` `Sample settings`<br>Source: `src/components/sections/Stream.tsx` | `Sample settings` | `Sample settings` |
| `[DEMO]` `Change them and watch`<br>Source: `src/components/sections/Stream.tsx` | `इन्हें बदलकर देखें` | `Inhein badalkar dekhein` |
| `[DEMO]` `Show alerts on stream`<br>Source: `src/components/sections/Stream.tsx` | `stream पर alerts दिखाएँ` | `Stream par alerts dikhaayen` |
| `[DEMO]` `Each tip pops up on your OBS overlay.`<br>Source: `src/components/sections/Stream.tsx` | `हर tip आपके OBS overlay पर दिखता है।` | `Har tip aapke OBS overlay par dikhta hai.` |
| `[DEMO]` `Read messages aloud`<br>Source: `src/components/sections/Stream.tsx` | `Messages ज़ोर से पढ़ें` | `Messages zor se padhein` |
| `[DEMO]` `Text-to-speech reads the fan's message.`<br>Source: `src/components/sections/Stream.tsx` | `Text-to-speech fan का message पढ़कर सुनाता है।` | `Text-to-speech fan ka message padhkar sunaata hai.` |
| `[DEMO]` `Approve before it plays`<br>Source: `src/components/sections/Stream.tsx` | `चलने से पहले approval दें (?)` | `Play hone se pehle approval dein (?)` |
| `[DEMO]` `Nothing plays until you okay it.`<br>Source: `src/components/sections/Stream.tsx` | `आपकी मंज़ूरी के बिना कुछ नहीं चलता।` | `Aapki manzoori ke bina kuch nahi chalta.` |
| `[DEMO]` `Viewers see the alert and hear the message.`<br>Source: `src/components/sections/Stream.tsx` | `Viewers alert देखते और message सुनते हैं।` | `Viewers alert dekhte aur message sunte hain.` |
| `[DEMO]` `Viewers see the alert. Nothing is read out.`<br>Source: `src/components/sections/Stream.tsx` | `Viewers alert देखते हैं। कुछ read out नहीं होता।` | `Viewers alert dekhte hain. Kuch read out nahi hota.` |
| `[DEMO]` `Viewers hear the message. No alert shows.`<br>Source: `src/components/sections/Stream.tsx` | `Viewers message सुनते हैं। कोई alert नहीं दिखता।` | `Viewers message sunte hain. Koi alert nahi dikhta.` |
| `[DEMO]` `Nothing plays on stream. You still get the tip.`<br>Source: `src/components/sections/Stream.tsx` | `Stream पर कुछ नहीं चलता। Tip फिर भी आपको मिलता है।` | `Stream par kuch nahi chalta. Tip phir bhi aapko milta hai.` |
| `[DEMO]` `Waiting for your approval`<br>Source: `src/components/sections/Stream.tsx` | `आपकी approval का इंतज़ार` | `Aapki approval ka intezaar` |
| `[DEMO]` `{name} · ₹{amount} · “{message}”` (current sample: `Riya · ₹250 · “Great stream today!”`)<br>Source: `src/components/sections/Stream.tsx`, values from `src/lib/site.ts` | `{name} · ₹{amount} · “{message}”` | `{name} · ₹{amount} · “{message}”` |
| `[DEMO]` `Approve`<br>Source: `src/components/sections/Stream.tsx` | `Approve` | `Approve` |
| `[DEMO]` `Send the sample tip again`<br>Source: `src/components/sections/Stream.tsx` | `Sample tip फिर से भेजें` | `Sample tip phir se bhejein` |
| `[DEMO]` `LIVE`<br>Source: `src/components/sections/Stream.tsx` | `LIVE` | `LIVE` |
| `[DEMO]` `Sample stream`<br>Source: `src/components/sections/Stream.tsx` | `Sample stream` | `Sample stream` |
| `[DEMO]` `Sample alert. Nothing is sent to a stream.`<br>Source: `src/components/sections/Stream.tsx` | `Sample alert। Stream पर कुछ नहीं भेजा जाता।` | `Sample alert. Stream par kuch nahi bheja jaata.` |
| `[DEMO]` `Riya tipped`<br>Source: `src/components/sections/Stream.tsx`, value from `src/lib/site.ts` | `Riya ने tip दिया` | `Riya ne tip diya` |
| `[DEMO]` `Great stream today!`<br>Source: `src/lib/site.ts`, rendered by `src/components/hero/TipCard.tsx` and `src/components/sections/Stream.tsx` | `आज stream शानदार है!` | `Aaj stream shandaar hai!` |
| `[DEMO]` `Audio only. No alert on screen. Sample.`<br>Source: `src/components/sections/Stream.tsx` | `सिर्फ़ audio। Screen पर कोई alert नहीं। Sample।` | `Sirf audio. Screen par koi alert nahi. Sample.` |
| `[DEMO]` `Nothing shows or plays on stream. The tip still reaches you.`<br>Source: `src/components/sections/Stream.tsx` | `Stream पर कुछ दिखता या चलता नहीं। Tip फिर भी आप तक पहुँचता है।` | `Stream par kuch dikhta ya chalta nahi. Tip phir bhi aap tak pahunchta hai.` |
| `[DEMO]` `Waiting for your approval. Viewers see nothing yet.`<br>Source: `src/components/sections/Stream.tsx` | `आपकी approval का इंतज़ार। अभी viewers को कुछ नहीं दिखता।` | `Aapki approval ka intezaar. Abhi viewers ko kuch nahi dikhta.` |

### Home — Why Tipsite

| Current English (exact) and source file | Natural Hindi (Devanagari) | Natural Hinglish (Roman) |
|---|---|---|
| `[PLANNED]` `Why Tipsite`<br>Source: `src/components/sections/Differentiators.tsx` | `Tipsite क्यों` | `Tipsite kyun` |
| `[PLANNED]` `Less friction for fans. More control for you.`<br>Source: `src/components/sections/Differentiators.tsx` | `Fans के लिए कम रुकावट। आपके लिए ज़्यादा control।` | `Fans ke liye kam rukaavat. Aapke liye zyada control.` |
| `[PLANNED]` `One tip link built around the way a live stream actually works: quick for viewers, visible on screen and careful with what gets spoken.`<br>Source: `src/components/sections/Differentiators.tsx` | `एक tip link, जो live stream के असली flow के हिसाब से बना है: viewers के लिए तेज़, screen पर साफ़ और बोले जाने वाले content पर सावधान।` | `Ek tip link, jo live stream ke asli flow ke hisaab se bana hai: viewers ke liye tez, screen par saaf aur bole jaane wale content par saavdhaan.` |
| `[PLANNED]` `For fans`<br>Source: `src/components/sections/Differentiators.tsx` | `Fans के लिए` | `Fans ke liye` |
| `[PLANNED]` `No account. No email.`<br>Source: `src/components/sections/Differentiators.tsx` | `No account। No email।` | `No account. No email.` |
| `[PLANNED]` `Open the link, choose an amount and pay with UPI or card. Leave the optional name blank to tip anonymously.`<br>Source: `src/components/sections/Differentiators.tsx` | `Link खोलें, रकम चुनें और UPI या card से pay करें। Optional नाम खाली छोड़कर anonymous tip दें।` | `Link kholen, amount chunein aur UPI ya card se pay karein. Optional naam khaali chhodkar anonymous tip dein.` |
| `[PLANNED]` `No fan account`<br>Source: `src/components/sections/Differentiators.tsx` | `Fan account नहीं` | `Fan account nahi` |
| `[PLANNED]` `No email field`<br>Source: `src/components/sections/Differentiators.tsx` | `Email field नहीं` | `Email field nahi` |
| `[PLANNED]` `Anonymous by choice`<br>Source: `src/components/sections/Differentiators.tsx` | `अपनी choice से anonymous` | `Apni choice se anonymous` |
| `[PLANNED]` `One payment flow`<br>Source: `src/components/sections/Differentiators.tsx` | `एक payment flow` | `Ek payment flow` |
| `[PLANNED]` `UPI + card.`<br>Source: `src/components/sections/Differentiators.tsx` | `UPI + card।` | `UPI + card.` |
| `[PLANNED]` `Both payment options live on the same tip page, so fans pick what works without finding a second link.`<br>Source: `src/components/sections/Differentiators.tsx` | `दोनों payment options उसी tip page पर हैं, इसलिए fans दूसरा link खोजे बिना अपनी सुविधा का option चुन सकते हैं।` | `Dono payment options usi tip page par hain, isliye fans doosra link khoje bina apni suvidha ka option chun sakte hain.` |
| `[PLANNED]` `QR-first sharing`<br>Source: `src/components/sections/Differentiators.tsx` | `QR-first sharing` | `QR-first sharing` |
| `[PLANNED]` `Keep the link on screen.`<br>Source: `src/components/sections/Differentiators.tsx` | `Link को screen पर रखें।` | `Link ko screen par rakhein.` |
| `[PLANNED]` `Put a QR-led tip link on your stream. Viewers can open the same page without hunting through chat.`<br>Source: `src/components/sections/Differentiators.tsx` | `अपनी stream पर QR वाला tip link दिखाएँ। Viewers chat में खोजे बिना वही page खोल सकते हैं।` | `Apni stream par QR wala tip link dikhaayen. Viewers chat mein khoje bina wahi page khol sakte hain.` |
| `[DEMO]` `Non-scannable sample QR`<br>Source: `src/components/sections/Differentiators.tsx` | `Non-scannable sample QR` | `Non-scannable sample QR` |
| `[PLANNED]` `Safer text-to-speech`<br>Source: `src/components/sections/Differentiators.tsx` | `ज़्यादा सुरक्षित text-to-speech (?)` | `Zyada safe text-to-speech (?)` |
| `[PLANNED]` `Nothing speaks before you approve it.`<br>Source: `src/components/sections/Differentiators.tsx` | `आपकी approval से पहले कुछ भी read out नहीं होता।` | `Aapki approval se pehle kuch bhi read out nahi hota.` |
| `[PLANNED]` `Messages stay within a limit, get screened for profanity and banned words, then wait for your approval before playback.`<br>Source: `src/components/sections/Differentiators.tsx` | `Messages एक limit में रहते हैं, profanity और banned words के लिए screen होते हैं, फिर playback से पहले आपकी approval का इंतज़ार करते हैं।` | `Messages ek limit mein rehte hain, profanity aur banned words ke liye screen hote hain, phir playback se pehle aapki approval ka intezaar karte hain.` |
| `[PLANNED]` `Message limit`<br>Source: `src/components/sections/Differentiators.tsx` | `Message की सीमा (?)` | `Message ki limit (?)` |
| `[PLANNED]` `Keep live alerts short and easy to follow.`<br>Source: `src/components/sections/Differentiators.tsx` | `Live alerts छोटे और आसानी से follow करने लायक रखें।` | `Live alerts chhote aur aasaani se follow karne laayak rakhein.` |
| `[PLANNED]` `Word screening`<br>Source: `src/components/sections/Differentiators.tsx` | `Words की screening` | `Words ki screening` |
| `[PLANNED]` `Profanity and banned-word checks happen before speech.`<br>Source: `src/components/sections/Differentiators.tsx` | `Speech से पहले profanity और banned words की जाँच होती है।` | `Speech se pehle profanity aur banned words ki jaanch hoti hai.` |
| `[PLANNED]` `Creator approval`<br>Source: `src/components/sections/Differentiators.tsx` | `Creator की approval` | `Creator ki approval` |
| `[PLANNED]` `You decide what gets read out on your stream.`<br>Source: `src/components/sections/Differentiators.tsx` | `आप तय करते हैं कि आपकी stream पर क्या read out होगा।` | `Aap tay karte hain ki aapki stream par kya read out hoga.` |

### Home — payments, fees, and worked example

| Current English (exact) and source file | Natural Hindi (Devanagari) | Natural Hinglish (Roman) |
|---|---|---|
| `[PLANNED]` `Payments and fees`<br>Source: `src/components/sections/Money.tsx` | `Payments और fees` | `Payments aur fees` |
| `[PLANNED]` `Fans pay with the UPI app already on their phone.`<br>Source: `src/components/sections/Money.tsx` | `Fans अपने phone में मौजूद UPI app से pay करते हैं।` | `Fans apne phone mein maujood UPI app se pay karte hain.` |
| `[PLANNED]` `Cards`<br>Source: `src/components/sections/Money.tsx` | `Cards` | `Cards` |
| `[PLANNED]` `Fans can also pay by card, from the same page.`<br>Source: `src/components/sections/Money.tsx` | `Fans उसी page से card से भी pay कर सकते हैं।` | `Fans usi page se card se bhi pay kar sakte hain.` |
| `[PLANNED]` `What it costs`<br>Source: `src/components/sections/Money.tsx` | `इसकी लागत` | `Iski laagat` |
| `[PLANNED]` `We take 5% of every tip. Razorpay's payment charge comes out of the payout too; fans pay exactly the tip.`<br>Source: `src/components/sections/Money.tsx`, fee constants from `src/lib/legal.ts` | `हम हर tip का 5% लेते हैं। Razorpay का charge इस 5% के ऊपर है और creator के payout में से कटता है; fans सिर्फ़ tip की रकम pay करते हैं।` | `Hum har tip ka 5% lete hain. Razorpay ka charge is 5% ke upar hai aur creator ke payout mein se katta hai; fans sirf tip ki rakam pay karte hain.` |
| `[PLANNED]` `Fan tips` — `₹100.00`<br>Source: `src/components/sections/Money.tsx`, `src/lib/legal.ts` | `Fan की tip` — `₹100.00` | `Fan ki tip` — `₹100.00` |
| `[PLANNED]` `Our fee (5%)` — `−₹5.00`<br>Source: `src/components/sections/Money.tsx`, `src/lib/legal.ts` | `हमारी fee (5%)` — `−₹5.00` | `Hamari fee (5%)` — `−₹5.00` |
| `[PLANNED]` `Razorpay (2% + GST)` — `−₹2.36`<br>Source: `src/components/sections/Money.tsx`, `src/lib/legal.ts` | `Razorpay (2% + GST)` — `−₹2.36` | `Razorpay (2% + GST)` — `−₹2.36` |
| `[PLANNED]` `You get` — `₹92.64`<br>Source: `src/components/sections/Money.tsx`, `src/lib/legal.ts` | `आपको मिलता है` — `₹92.64` | `Aapko milta hai` — `₹92.64` |
| `[PLANNED]` `Example on a ₹100 UPI or Indian card tip at Razorpay's standard rate. International cards cost more.`<br>Source: `src/components/sections/Money.tsx`, rate note from `src/lib/legal.ts` | `Razorpay की standard rate पर ₹100 UPI या Indian card tip का example। International cards की cost ज़्यादा है।` | `Razorpay ki standard rate par ₹100 UPI ya Indian card tip ka example. International cards ki cost zyada hai.` |

### Home — FAQ

| Current English (exact) and source file | Natural Hindi (Devanagari) | Natural Hinglish (Roman) |
|---|---|---|
| `[PLANNED]` `Common questions`<br>Source: `src/components/sections/Faq.tsx` | `आम सवाल` | `Aam sawaal` |
| `[PLANNED]` `Do fans need an account or email?`<br>Source: `src/components/sections/Faq.tsx` | `क्या fans को account या email चाहिए?` | `Kya fans ko account ya email chahiye?` |
| `[PLANNED]` `No. A fan opens your link, picks an amount and pays with UPI or card. Name is optional, so they can leave it blank and tip anonymously.`<br>Source: `src/components/sections/Faq.tsx` | `नहीं। Fan आपका link खोलकर रकम चुनता है और UPI या card से pay करता है। नाम optional है, इसलिए उसे खाली छोड़कर anonymous tip दी जा सकती है।` | `Nahi. Fan aapka link kholkar amount chunta hai aur UPI ya card se pay karta hai. Naam optional hai, isliye use khaali chhodkar anonymous tip di ja sakti hai.` |
| `[PLANNED]` `Can fans pay by card?`<br>Source: `src/components/sections/Faq.tsx` | `क्या fans card से pay कर सकते हैं?` | `Kya fans card se pay kar sakte hain?` |
| `[PLANNED]` `Yes. UPI and card sit in the same tip flow, so a fan who doesn't use UPI can still tip.`<br>Source: `src/components/sections/Faq.tsx` | `हाँ। UPI और card एक ही tip flow में हैं, इसलिए जो fan UPI इस्तेमाल नहीं करता वह भी tip दे सकता है।` | `Haan. UPI aur card ek hi tip flow mein hain, isliye jo fan UPI use nahi karta woh bhi tip de sakta hai.` |
| `[PLANNED]` `What does it cost?`<br>Source: `src/components/sections/Faq.tsx` | `इसकी cost क्या है?` | `Iski cost kya hai?` |
| `[PLANNED]` `We take 5% of every tip. Razorpay's payment charge (2% plus 18% GST on that charge, at its standard rate) also comes out of your payout. On a ₹100 tip you get ₹92.64. Fans pay exactly the amount they choose, with nothing added. International cards cost more.`<br>Source: `src/components/sections/Faq.tsx`, fee constants from `src/lib/legal.ts` | `हम हर tip का 5% लेते हैं। Razorpay का payment charge (उस charge पर standard rate में 2% और 18% GST) हमारे 5% के ऊपर है और आपके payout में से भी कटता है। ₹100 की tip पर आपको ₹92.64 मिलते हैं। Fans अपनी चुनी रकम ही pay करते हैं, कुछ extra नहीं जुड़ता। International cards की cost ज़्यादा है।` | `Hum har tip ka 5% lete hain. Razorpay ka payment charge (us charge par standard rate mein 2% aur 18% GST) hamare 5% ke upar hai aur aapke payout mein se bhi katta hai. ₹100 ki tip par aapko ₹92.64 milte hain. Fans apni chuni rakam hi pay karte hain, kuch extra nahi judta. International cards ki cost zyada hai.` |
| `[PLANNED]` `How do I get paid?`<br>Source: `src/components/sections/Faq.tsx` | `मुझे payment कैसे मिलेगा?` | `Mujhe payment kaise milega?` |
| `[PLANNED]` `Payouts go to your bank account in INR. Payout timing will be published at launch.`<br>Source: `src/components/sections/Faq.tsx` | `Payout आपके bank account में INR में जाते हैं। Payout timing launch पर बताई जाएगी।` | `Payout aapke bank account mein INR mein jaate hain. Payout timing launch par bataayi jaayegi.` |
| `[PLANNED]` `How do tips show up on my stream?`<br>Source: `src/components/sections/Faq.tsx` | `Tips मेरी stream पर कैसे दिखेंगी?` | `Tips meri stream par kaise dikhegi?` |
| `[PLANNED]` `You get an alert link to add to OBS as a browser source. Each tip then shows the fan's name, the amount and their message on stream.`<br>Source: `src/components/sections/Faq.tsx` | `आपको एक alert link मिलता है जिसे OBS में browser source की तरह जोड़ सकते हैं। फिर हर tip fan का नाम, रकम और message stream पर दिखाती है।` | `Aapko ek alert link milta hai jise OBS mein browser source ki tarah jod sakte hain. Phir har tip fan ka naam, amount aur message stream par dikhaati hai.` |
| `[PLANNED]` `When does text-to-speech play?`<br>Source: `src/components/sections/Faq.tsx` | `text-to-speech कब चलता है?` | `Text-to-speech kab chalta hai?` |
| `[PLANNED]` `Only messages within the message limit that pass profanity and banned-word screening can be read out. With approve-first on, which is the default, each one also waits for your okay. You can turn approve-first, text-to-speech or on-stream alerts off.`<br>Source: `src/components/sections/Faq.tsx` | `सिर्फ़ message limit के भीतर और profanity तथा banned-word screening पास करने वाले messages read out हो सकते हैं। Approve-first on होने पर, जो default है, हर message आपकी approval का भी इंतज़ार करता है। आप approve-first, text-to-speech या on-stream alerts बंद कर सकते हैं।` | `Sirf message limit ke andar aur profanity aur banned-word screening pass karne wale messages read out ho sakte hain. Approve-first on hone par, jo default hai, har message aapki approval ka bhi intezaar karta hai. Aap approve-first, text-to-speech ya on-stream alerts off kar sakte hain.` |
| `[PLANNED]` `What is the QR code for?`<br>Source: `src/components/sections/Faq.tsx` | `QR code किस काम का है?` | `QR code kis kaam ka hai?` |
| `[PLANNED]` `Your page gets a QR code you can show on stream. Viewers scan it with their phone and land straight on your tip page.`<br>Source: `src/components/sections/Faq.tsx` | `आपके page को एक QR code मिलता है जिसे आप stream पर दिखा सकते हैं। Viewers phone से scan करके सीधे आपके tip page पर पहुँचते हैं।` | `Aapke page ko ek QR code milta hai jise aap stream par dikha sakte hain. Viewers phone se scan karke seedhe aapke tip page par pahunchte hain.` |
| `[SOURCE AUDIT ONLY — OMIT FROM LOCALIZED COPY]` `How is this different from Super Chat?`<br>Source: `src/components/sections/Faq.tsx` | `इस comparison को localized copy में शामिल न करें।` | `Is comparison ko localized copy mein include na karein.` |
| `[SOURCE AUDIT ONLY — OMIT FROM LOCALIZED COPY]` `Super Chat happens inside YouTube. Tips here come through your own link, which you can share anywhere.`<br>Source: `src/components/sections/Faq.tsx` | `इस comparison को localized copy में शामिल न करें।` | `Is comparison ko localized copy mein include na karein.` |
| `[DEMO]` `Is it live yet?`<br>Source: `src/components/sections/Faq.tsx` | `क्या यह अभी live है?` | `Kya yeh abhi live hai?` |
| `[DEMO]` `Not yet. This page previews the product. The sample tip card and the sample alert are demos, not connected to payments or to a stream.`<br>Source: `src/components/sections/Faq.tsx` | `अभी नहीं। यह page product का preview है। Sample tip card और sample alert demo हैं; वे payments या stream से जुड़े नहीं हैं।` | `Abhi nahi. Yeh page product ka preview hai. Sample tip card aur sample alert demo hain; woh payments ya stream se jude nahi hain.` |

### Home — closing waitlist

| Current English (exact) and source file | Natural Hindi (Devanagari) | Natural Hinglish (Roman) |
|---|---|---|
| `[LIVE]` `Your handle is your link.`<br>Source: `src/components/sections/Closer.tsx` | `आपका handle ही आपका link है।` | `Aapka handle hi aapka link hai.` |
| `[LIVE]` `Pick the name your fans will type and join the waitlist. We'll email you when sign‑up opens; handles aren't reserved until then.`<br>Source: `src/components/sections/Closer.tsx` | `वह नाम चुनें जिसे आपके fans type करेंगे और waitlist में शामिल हों। Sign-up खुलने पर हम आपको email करेंगे; तब तक handles reserved नहीं हैं।` | `Woh naam chunein jise aapke fans type karenge aur waitlist mein shaamil hon. Sign-up khulne par hum aapko email karenge; tab tak handles reserved nahi hain.` |
| `[LIVE]` `The handle you want` plus `(optional)`<br>Source: `src/components/sections/Closer.tsx`, `src/components/auth/SignUpForm.tsx` | `आप जो handle चाहते हैं (optional)` | `Aap jo handle chahte hain (optional)` |
| `[LIVE]` `Email`<br>Source: `src/components/sections/Closer.tsx`, `src/components/auth/SignUpForm.tsx`, `src/components/auth/SignInForm.tsx` | `Email` | `Email` |
| `[LIVE]` `you@example.com`<br>Source: `src/components/sections/Closer.tsx`, `src/components/auth/SignUpForm.tsx`, `src/components/auth/SignInForm.tsx` | `you@example.com` | `you@example.com` |
| `[LIVE]` `Join the waitlist`<br>Source: `src/components/sections/Closer.tsx`, `src/components/auth/SignUpForm.tsx` | `Waitlist में शामिल हों` | `Waitlist mein shaamil hon` |
| `[LIVE]` `Joining`<br>Source: `src/components/sections/Closer.tsx`, `src/components/auth/SignUpForm.tsx` | `शामिल हो रहे हैं` | `Shaamil ho rahe hain` |
| `[LIVE]` `By joining, you agree that we can email you about the launch. See how we use your details in our privacy policy.`<br>Source: `src/components/waitlist/useWaitlist.tsx` | `शामिल होकर आप सहमत होते हैं कि launch के बारे में हम आपको email कर सकते हैं। हम आपकी details कैसे इस्तेमाल करते हैं, यह हमारी privacy policy में देखें।` | `Shaamil hokar aap sehmat hote hain ki launch ke baare mein hum aapko email kar sakte hain. Hum aapki details kaise istemaal karte hain, yeh hamari privacy policy mein dekhein.` |

### Shared handle field

| Current English (exact) and source file | Natural Hindi (Devanagari) | Natural Hinglish (Roman) |
|---|---|---|
| `[LIVE]` `yourname` (placeholder and empty-field sample)<br>Source: `src/components/ui/HandleField.tsx` | `yourname` | `yourname` |
| `[LIVE]` `tipsite.in/` plus a typed handle; empty sample `tipsite.in/yourname`<br>Source: `src/components/ui/HandleField.tsx`, `src/lib/site.ts` | `tipsite.in/` + typed handle; sample `tipsite.in/yourname` | `tipsite.in/` + typed handle; sample `tipsite.in/yourname` |
| `[LIVE]` Animated empty-field samples: `yourname`, `gamingwithriya`, `kabirplays`, `desi_speedrun`, `meera_live`<br>Source: `src/components/ui/HandleField.tsx` | Handles जस के तस रखें: `yourname`, `gamingwithriya`, `kabirplays`, `desi_speedrun`, `meera_live` | Handles ko jaisa hai waisa rakhein: `yourname`, `gamingwithriya`, `kabirplays`, `desi_speedrun`, `meera_live` |
| `[LIVE]` `Valid handle format`<br>Source: `src/components/ui/HandleField.tsx` | `Handle format मान्य है` | `Handle format maanya hai` |
| `[LIVE]` `3 to 20 letters, numbers or _`<br>Source: `src/components/ui/HandleField.tsx`, validation from `src/lib/waitlist.ts` | `3 से 20 letters, numbers या _` | `3 se 20 letters, numbers ya _` |

### Waitlist status, validation, error, and success states

| Current English (exact) and source file | Natural Hindi (Devanagari) | Natural Hinglish (Roman) |
|---|---|---|
| `[LIVE]` `Adding you to the waitlist…`<br>Source: `src/components/waitlist/useWaitlist.tsx` | `आपको waitlist में जोड़ा जा रहा है…` | `Aapko waitlist mein joda ja raha hai…` |
| `[LIVE]` `You're on the list. We'll email you when sign-up opens.`<br>Source: `src/lib/waitlist.ts` | `आप list में हैं। Sign-up खुलने पर हम आपको email करेंगे।` | `Aap list mein hain. Sign-up khulne par hum aapko email karenge.` |
| `[LIVE]` `Enter a valid email address.`<br>Source: `src/lib/waitlist.ts`, `src/components/auth/SignInForm.tsx` | `मान्य email address दर्ज करें।` | `Maanya email address darj karein.` |
| `[LIVE]` `Handles use 3 to 20 letters, numbers or underscores.`<br>Source: `src/lib/waitlist.ts` | `Handles में 3 से 20 letters, numbers या underscores होते हैं।` | `Handles mein 3 se 20 letters, numbers ya underscores hote hain.` |
| `[LIVE]` `Use your YouTube channel link, like youtube.com/@yourchannel.`<br>Source: `src/lib/waitlist.ts` | `अपने YouTube channel का link इस्तेमाल करें, जैसे youtube.com/@yourchannel।` | `Apne YouTube channel ka link istemaal karein, jaise youtube.com/@yourchannel.` |
| `[LIVE]` `Too many tries from this network. Please try again in an hour.`<br>Source: `src/lib/waitlist.ts` | `इस network से बहुत ज़्यादा कोशिशें हो चुकी हैं। कृपया एक घंटे बाद फिर कोशिश करें।` | `Is network se bahut zyada koshishein ho chuki hain. Kripya ek ghante baad phir koshish karein.` |
| `[LIVE]` `The waitlist isn't working right now. Please try again later.`<br>Source: `src/lib/waitlist.ts` | `Waitlist अभी काम नहीं कर रही। कृपया बाद में फिर कोशिश करें।` | `Waitlist abhi kaam nahi kar rahi. Kripya baad mein phir koshish karein.` |

### `/signup`

| Current English (exact) and source file | Natural Hindi (Devanagari) | Natural Hinglish (Roman) |
|---|---|---|
| `[LIVE]` `Sign-up opens soon`<br>Source: `src/components/auth/SignUpForm.tsx` | `Sign-up जल्द खुलेगा` | `Sign-up jald khulega` |
| `[LIVE]` `Join the waitlist and we'll email you when it opens. Add the handle you want too; handles aren't reserved until then.`<br>Source: `src/components/auth/SignUpForm.tsx` | `Waitlist में शामिल हों; खुलने पर हम आपको email करेंगे। अपना पसंदीदा handle भी जोड़ें—तब तक handles reserved नहीं हैं।` | `Waitlist mein shaamil hon; khulne par hum aapko email karenge. Apna pasandeeda handle bhi jodein—tab tak handles reserved nahi hain.` |
| `[LIVE]` `YouTube channel (optional)`<br>Source: `src/components/auth/SignUpForm.tsx` | `YouTube channel (optional)` | `YouTube channel (optional)` |
| `[LIVE]` `youtube.com/@yourchannel`<br>Source: `src/components/auth/SignUpForm.tsx` | `youtube.com/@yourchannel` | `youtube.com/@yourchannel` |
| `[LIVE]` `Already have an account?`<br>Source: `src/components/auth/SignUpForm.tsx` | `पहले से account है?` | `Pehle se account hai?` |

### `/signin`

| Current English (exact) and source file | Natural Hindi (Devanagari) | Natural Hinglish (Roman) |
|---|---|---|
| `[LIVE]` `Welcome back`<br>Source: `src/components/auth/SignInForm.tsx` | `वापसी पर स्वागत है` | `Welcome back` |
| `[LIVE]` `Sign-in opens together with sign-up. There are no accounts yet.`<br>Source: `src/components/auth/SignInForm.tsx` | `Sign-in, sign-up के साथ खुलेगा। अभी कोई account नहीं है।` | `Sign-in, sign-up ke saath khulega. Abhi koi account nahi hai.` |
| `[LIVE]` `Sign-in isn't open yet, so nothing was sent.`<br>Source: `src/components/auth/SignInForm.tsx` | `Sign-in अभी खुला नहीं है, इसलिए कुछ भी नहीं भेजा गया।` | `Sign-in abhi khula nahi hai, isliye kuch bhi nahi bheja gaya.` |
| `[LIVE]` `New here?`<br>Source: `src/components/auth/SignInForm.tsx` | `यहाँ नए हैं?` | `Yahan naye hain?` |

### Accessibility-only labels (not normally visible)

| Current English (exact) and source file | Natural Hindi (Devanagari) | Natural Hinglish (Roman) |
|---|---|---|
| `[A11Y]` `Sample tip page`<br>Source: `src/components/hero/TipCard.tsx` | `Sample tip page` | `Sample tip page` |
| `[A11Y]` `Sample stream alert`<br>Source: `src/components/sections/Stream.tsx` | `Sample stream alert` | `Sample stream alert` |
| `[A11Y]` `Payment options`<br>Source: `src/components/sections/Differentiators.tsx` | `Payment options` | `Payment options` |
| `[A11Y]` `Non-scannable sample QR illustration`<br>Source: `src/components/sections/Differentiators.tsx` | `Non-scannable sample QR illustration` | `Non-scannable sample QR illustration` |
| `[A11Y]` `Text-to-speech safety steps`<br>Source: `src/components/sections/Differentiators.tsx` | `Text-to-speech safety steps` | `Text-to-speech safety steps` |
| `[A11Y]` `Read aloud` / `Not read aloud`<br>Source: `src/components/sections/Stream.tsx` | `Read aloud` / `Read aloud नहीं` | `Read aloud` / `Read aloud nahi` |

## Planned TTS and alert templates

These are **`[PLANNED]`** templates for the future creator tip page and stream integration. They are not the current demo's live behavior and should not be described as a completed backend. The alert should show the first line; TTS should use the second line only when the message passes the limit and screening and, by default, after creator approval.

### Planned on-screen alert templates

| State / sample label | Devanagari Hindi template | Hinglish Roman template |
|---|---|---|
| `[PLANNED]` Named tip — `Riya`, `₹250`, `Great stream today!` | `Riya ने ₹250 का tip दिया`<br>`Great stream today!` | `Riya ne ₹250 ka tip diya`<br>`Great stream today!` |
| `[PLANNED]` Anonymous tip — `₹100`, `Love the stream` | `Anonymous ने ₹100 का tip दिया`<br>`Stream बहुत बढ़िया है` | `Anonymous ne ₹100 ka tip diya`<br>`Love the stream` |
| `[PLANNED]` Filtered message — no unsafe message text shown | `Message filter किया गया`<br>`यह message stream पर read out नहीं होगा` | `Message filter kiya gaya`<br>`Yeh message stream par read out nahi hoga` |
| `[PLANNED]` Approval waiting — named tip | `Riya का ₹250 tip आपकी approval का इंतज़ार कर रहा है`<br>Button: `Approve` | `Riya ka ₹250 tip aapki approval ka intezaar kar raha hai`<br>Button: `Approve` |
| `[PLANNED]` Approval waiting — anonymous tip | `Anonymous का ₹100 tip आपकी approval का इंतज़ार कर रहा है`<br>Button: `Approve` | `Anonymous ka ₹100 tip aapki approval ka intezaar kar raha hai`<br>Button: `Approve` |

### Planned TTS templates

| State / playback rule | Devanagari Hindi template | Hinglish Roman template |
|---|---|---|
| `[PLANNED]` Named tip after approval | `Riya ने ₹250 का tip दिया: Great stream today!` | `Riya ne ₹250 ka tip diya: Great stream today!` |
| `[PLANNED]` Anonymous tip after approval | `Anonymous ने ₹100 का tip दिया: Stream बहुत बढ़िया है।` | `Anonymous ne ₹100 ka tip diya: Love the stream.` |
| `[PLANNED]` Filtered message — do not play the submitted message | `इस message को filter किया गया है; इसे stream पर पढ़कर नहीं सुनाया जाएगा।` | `Is message ko filter kiya gaya hai; ise stream par read out nahi kiya jaayega.` |
| `[PLANNED]` Approval waiting — do not play until creator approval | `यह tip आपकी approval का इंतज़ार कर रही है; approval मिलने तक इसे read out नहीं किया जाएगा।` | `Yeh tip aapki approval ka intezaar kar rahi hai; approval milne tak ise read out nahi kiya jaayega.` |

## Uncertainties to resolve before shipping

- **`(?)` on `Safer text-to-speech`:** “Safer” is a comparative product-positioning phrase. `ज़्यादा सुरक्षित text-to-speech` is the working Hindi, but a native-speaker review should choose between that and a shorter `सुरक्षित text-to-speech` label without weakening the screening/approval meaning.
- **`(?)` on `Approve before it plays` and `Message limit`:** the UI may intentionally keep the English tokens `approval` and `message limit`; `मंज़ूरी` and `Message limit` are natural working choices, but the final button and settings vocabulary should be checked for consistency across Devanagari and Hinglish.
- The two FAQ comparison rows are marked **`SOURCE AUDIT ONLY — OMIT FROM LOCALIZED COPY`** because they are visible in the current source but the localized draft must not introduce competitor references. The Hindi and Hinglish columns deliberately give an omission instruction rather than a translation. If the English source is later changed, remove these audit rows from this draft as well.
