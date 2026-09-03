# IDShield AI — Fully Working Demo

## Run
Open with a local server, for example:
`python -m http.server 5500`

Then visit `http://localhost:5500`.

Camera features require localhost or HTTPS.

## Working flow
Consent Information → QR Verification (or Bypass if no QR) → Face Verification → Liveness → Officer Photo → Upload Document → Information & Extraction → AI Analysis → Result → Submit.

The browser demo uses localStorage for history/audit and Tesseract.js/jsQR for browser OCR/QR when their CDNs are available. The AI score is a clearly preliminary demo score unless a production authorized AI endpoint is connected.

Government databases and biometric identity verification are not simulated as official verification. Use authorized integrations only.
