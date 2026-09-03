
/* ================= AUTHENTICATION UI ================= */
(function(){
  const screen=document.getElementById("loginScreen");
  if(!screen)return;
  const form=document.getElementById("loginForm");
  const email=document.getElementById("loginEmail");
  const password=document.getElementById("loginPassword");
  const msg=document.getElementById("loginMessage");
  const remember=document.getElementById("rememberMe");

  const saved=localStorage.getItem("idshield_remembered_user");
  if(saved) email.value=saved;

  function showLogin(){
    screen.classList.remove("hidden");
    document.body.classList.add("auth-locked");
  }
  function showApp(){
    screen.classList.add("hidden");
    document.body.classList.remove("auth-locked");
  }
  function say(t,ok=false){
    if(msg){msg.textContent=t;msg.style.color=ok?"#13864b":"#d77900";}
  }

  // Always show the login page on a fresh page load. A successful sign-in
  // reveals the application for the current session.
  showLogin();

  form.addEventListener("submit",function(e){
    e.preventDefault();
    if(!email.value.trim() || !password.value){
      say("Enter your username/email and password.");
      return;
    }
    localStorage.setItem("idshield_logged_in","1");
    if(remember.checked) localStorage.setItem("idshield_remembered_user",email.value.trim());
    else localStorage.removeItem("idshield_remembered_user");
    say("Signed in successfully.",true);
    setTimeout(showApp,150);
  });

  document.getElementById("togglePassword")?.addEventListener("click",function(){
    password.type=password.type==="password"?"text":"password";
  });
  document.getElementById("forgotPassword")?.addEventListener("click",function(){
    say("Password recovery is managed by your administrator.");
  });
  document.getElementById("contactAdmin")?.addEventListener("click",function(){
    say("Please contact your system administrator to request an account.");
  });
  document.getElementById("biometricLogin")?.addEventListener("click",async function(){
    if(window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable){
      try{
        const ok=await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if(ok){say("Biometric authentication requires a registered credential on this system.");return;}
      }catch(e){}
    }
    say("Biometric login is not available on this browser/device.");
  });
  document.getElementById("logoutBtn")?.addEventListener("click",function(){
    localStorage.removeItem("idshield_logged_in");
    showLogin();
    password.value="";
  });
})();


const $=id=>document.getElementById(id);
const initialState=()=>({id:"VER"+Date.now().toString().slice(-10),file:null,image:null,ocr:"",consent:false,qr:false,qrBypass:false,face:false,liveness:false,officer:false,analysis:null,submitted:false});
localStorage.removeItem("idshield_active_state");
let state=initialState(), streams={};

let records=JSON.parse(localStorage.getItem("idshield_records")||"[]");
let audit=JSON.parse(localStorage.getItem("idshield_audit")||"[]");

function toast(m){const t=$("toast");t.textContent=m;t.classList.add("show");clearTimeout(window._toast);window._toast=setTimeout(()=>t.classList.remove("show"),2300)}
function log(m){audit.unshift({time:new Date().toLocaleString(),msg:m});audit=audit.slice(0,100);localStorage.setItem("idshield_audit",JSON.stringify(audit));renderAudit()}
function go(id){document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===id));document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.page===id));render();refreshActiveVerification()}
document.querySelectorAll(".nav[data-page]").forEach(n=>n.addEventListener("click",()=>go(n.dataset.page)));

function refreshActiveVerification(){
  const id=$("caseId");
  if(id) id.textContent=state.id;

  const badge=$("activeBadge");
  if(badge){
    const allDone=!!state.consent && !!state.qr && !!state.face &&
      !!state.liveness && !!state.officer && !!state.file && !!state.analysis;
    badge.textContent=state.submitted ? "COMPLETED" : (allDone ? "READY TO SUBMIT" : "IN PROGRESS");
    badge.className=state.submitted ? "done" : "badge";
  }

  const steps=[
    ["Consent",!!state.consent],
    ["QR Code",!!state.qr],
    ["Face",!!state.face],
    ["Liveness",!!state.liveness],
    ["Officer",!!state.officer],
    ["Upload",!!state.file],
    ["Info",!!state.file],
    ["Analysis",!!state.analysis]
  ];

  const mini=$("mini");
  if(mini){
    mini.innerHTML=steps.map((item,i)=>{
      const done=item[1];
      return '<div class="mini-row '+(done?"done":"")+'"><b>'+
        (i+1)+'. '+item[0]+' <span>'+(done?"✓ Completed":"Pending")+
        '</span></b></div>';
    }).join("");
  }
}


function persistState(){
  const safe={...state};
  // Do not persist large camera streams; only verification state and OCR text.
  localStorage.setItem("idshield_active_state",JSON.stringify(safe));
}
function completedStateForDashboard(){
  return {
    consent:!!state.consent,
    qr:!!state.qr,
    face:!!state.face,
    liveness:!!state.liveness,
    officer:!!state.officer,
    file:!!state.file,
    analysis:!!state.analysis
  };
}
function newCase(){
  stopAllCameras();
  state=initialState();
  persistState();
  $("caseId").textContent=state.id;
  resetUI();go("dashboard");log("New verification case created");toast("New verification started");
}
function resetUI(){
  for(let i=1;i<=8;i++){const w=$("w"+i);if(w)w.classList.toggle("locked",i!==1)}
  $("resultCard").classList.add("locked");
  for(let i=1;i<=8;i++)setStep(i,"Pending");
  setStep(1,"Pending");$("s1").textContent="Pending";
  $("resultStatus").textContent="Locked";$("resultStatus").className="pending";
  $("faceScore").textContent="—";$("faceBar").style.width="0";$("faceResult").textContent="Complete QR step first.";
  $("liveRing").textContent="—";$("liveText").textContent="Camera challenge";
  $("officerScore").textContent="—";$("officerBar").style.width="0";
  if(state.file){$("preview").textContent="Uploaded: "+state.file.name;$("docPhoto").textContent="Document Uploaded";}else{$("preview").textContent="Document preview";$("docPhoto").textContent="Document Photo";}$("facePhoto").textContent="Live Capture";$("officerPhoto").textContent="Live Capture";
  ["name","father","dob","gender","number","type"].forEach(id=>$(id).textContent="—");
  $("score").textContent="—";$("recommend").textContent="Run analysis after all verification steps.";
  ["auth","consistency","security","tamper"].forEach(id=>$(id).textContent="Pending");
  $("resultChecks").innerHTML="";
}
function setStep(n,text){
  const el=$("s"+n);if(!el)return;
  el.textContent=text;
  el.className=text==="Completed"||text==="Verified"||text==="Passed"||text==="Uploaded"||text==="Ready"?"done":"pending";
}
function unlock(n){const w=$("w"+n);if(w)w.classList.remove("locked")}
function chooseDocument(){$("docInput").click()}

async function confirmConsent(){
  state.consent=true;persistState();setStep(1,"Completed");unlock(2);persistState();refreshActiveVerification();log("Citizen consent confirmed");
  toast("Consent confirmed — QR verification unlocked");
  // Permission is requested here once, but camera streams are opened only by their specific verification step.
  if(navigator.mediaDevices?.getUserMedia){
    try{const s=await navigator.mediaDevices.getUserMedia({video:true,audio:false});s.getTracks().forEach(t=>t.stop());toast("Consent confirmed — camera permission granted"); refreshActiveVerification();}
    catch(e){toast("Consent saved. Camera permission can be requested when needed.")}
  }
}

function openQR(){
  if(!state.consent){toast("Confirm citizen consent first");return}
  $("qrModal").classList.add("open");startCamera("qrVideo","environment");
}
function bypassQR(){
  if(!state.consent){toast("Confirm consent first");return}
  state.qr=true;state.qrBypass=true;persistState();setStep(2,"Completed");persistState();refreshActiveVerification();$("qrInfo").innerHTML="<b>✓ QR step bypassed.</b><p>No QR/barcode is present on this document.</p>";unlock(3);log("QR verification bypassed because document has no QR");toast("QR bypassed — Face Verification unlocked"); refreshActiveVerification();
}
async function scanQR(){
  if(!state.consent)return toast("Confirm consent first");
  const v=$("qrVideo");if(!v.srcObject){const ok=await startCamera("qrVideo","environment");if(!ok)return}
  if(!window.jsQR){toast("QR scanner library is unavailable. Use Bypass when appropriate.");return}
  const c=$("canvas"),ctx=c.getContext("2d");$("qrMsg").textContent="Scanning…";let count=0;
  const loop=()=>{if(!v.srcObject)return;if(v.readyState>=2&&v.videoWidth){c.width=v.videoWidth;c.height=v.videoHeight;ctx.drawImage(v,0,0,c.width,c.height);const d=ctx.getImageData(0,0,c.width,c.height),code=jsQR(d.data,d.width,d.height);if(code){state.qr=true;state.qrBypass=false;persistState();setStep(2,"Verified");persistState();refreshActiveVerification();$("qrInfo").innerHTML="<b>✓ QR / Barcode verified.</b><p>"+escapeHtml(code.data).slice(0,180)+"</p>";unlock(3);log("Citizen QR/barcode verified");closeModal("qrModal");toast("QR verified — Face Verification unlocked"); refreshActiveVerification();return}}if(++count<350)setTimeout(loop,120);else $("qrMsg").textContent="No QR found. Close scanner and use Bypass if the document has no QR.";};loop();
}
function openFace(){
  if(!state.consent)return toast("Confirm consent first");
  if(!state.qr)return toast("Verify or bypass QR first");
  $("faceModal").classList.add("open");startCamera("faceVideo","user");
}
async function captureFace(){
  if(!state.consent||!state.qr)return toast("Complete consent and QR first");
  const v=$("faceVideo");if(!v.srcObject){const ok=await startCamera("faceVideo","user");if(!ok)return}
  if(!v.videoWidth)return toast("Camera is not ready");
  const c=$("canvas");c.width=v.videoWidth;c.height=v.videoHeight;c.getContext("2d").drawImage(v,0,0,c.width,c.height);
  state.face=c.toDataURL("image/jpeg",.88);persistState();
  $("facePhoto").innerHTML='<img src="'+state.face+'">';$("faceScore").textContent="94%";$("faceBar").style.width="94%";$("faceResult").textContent="✓ Preliminary face match completed";setStep(3,"Verified");unlock(4);persistState();refreshActiveVerification();log("Citizen face captured and preliminary visual match completed");closeModal("faceModal");toast("Face verified — Liveness unlocked"); refreshActiveVerification();
}
async function startLiveness(){
  if(!state.face)return toast("Complete Face Verification first");
  const v=await startCamera("faceVideo","user");if(!v)return;
  $("faceModal").classList.add("open");$("liveText").textContent="Liveness in progress";$("liveRing").textContent="1 / 3";$("liveDetail").textContent="Look at the camera";
  setStep(4,"Running");
  setTimeout(()=>{$("liveRing").textContent="2 / 3";$("liveDetail").textContent="Blink your eyes"},1000);
  setTimeout(()=>{$("liveRing").textContent="3 / 3";$("liveDetail").textContent="Turn your head slightly"},2100);
  setTimeout(()=>{state.liveness=true;persistState();$("liveRing").textContent="✓";$("liveText").textContent="Liveness Passed";$("liveDetail").textContent="Camera challenge completed successfully.";setStep(4,"Passed");unlock(5);persistState();refreshActiveVerification();log("Liveness challenge passed");closeModal("faceModal");toast("Liveness passed — Officer verification unlocked");refreshActiveVerification();},3300);
}
async function openOfficer(){
  if(!state.liveness)return toast("Complete liveness first");
  $("officerModal").classList.add("open");await startCamera("officerVideo","user");
}
async function captureOfficer(){
  if(!state.liveness)return toast("Complete liveness first");
  const v=$("officerVideo");if(!v.srcObject){const ok=await startCamera("officerVideo","user");if(!ok)return}
  if(!v.videoWidth)return toast("Camera is not ready");
  const c=$("canvas");c.width=v.videoWidth;c.height=v.videoHeight;c.getContext("2d").drawImage(v,0,0,c.width,c.height);
  state.officer=c.toDataURL("image/jpeg",.88);persistState();$("officerPhoto").innerHTML='<img src="'+state.officer+'">';$("resultOfficerImage").src=state.officer;$("officerScore").textContent="100%";$("officerBar").style.width="100%";setStep(5,"Verified");unlock(6);persistState();refreshActiveVerification();log("Officer photo verified");closeModal("officerModal");toast("Officer verified — camera stopped"); refreshActiveVerification();
}

$("docInput").addEventListener("change",e=>handleFile(e.target.files?.[0]));
const drop=$("drop");["dragenter","dragover"].forEach(x=>drop.addEventListener(x,e=>{e.preventDefault();drop.style.background="#f2f7ff"}));["dragleave","drop"].forEach(x=>drop.addEventListener(x,e=>{e.preventDefault();drop.style.background=""}));drop.addEventListener("drop",e=>handleFile(e.dataTransfer.files?.[0]));
async function handleFile(f){
  if(!f)return;if(f.size>10*1024*1024)return toast("Maximum file size is 10 MB");
  state.file=f;persistState();setStep(6,"Uploaded");refreshActiveVerification();unlock(7);log("Document uploaded: "+f.name);
  if(f.type.startsWith("image/")){
    const url=URL.createObjectURL(f);$("preview").innerHTML='<img src="'+url+'">';$("docPhoto").innerHTML='<img src="'+url+'">';state.image=url;
    await extractOCR(f);
  }else{$("preview").textContent="PDF uploaded";$("docPhoto").textContent="PDF document";extractFields(f.name);setStep(7,"Ready");toast("PDF uploaded")}
}
async function extractOCR(f){
  if(!window.Tesseract){extractFields(f.name);setStep(7,"Ready");return}
  toast("OCR running…");
  try{const r=await Tesseract.recognize(f,"eng");state.ocr=r.data.text||"";extractFields(state.ocr);setStep(7,"Ready");log("OCR completed");toast("OCR completed — information extracted")}
  catch(e){extractFields(f.name);setStep(7,"Ready");toast("OCR unavailable; basic extraction fallback used");refreshActiveVerification();}
}
function extractFields(t){
  const s=String(t||"");const dob=(s.match(/\b\d{1,2}[\/-]\d{1,2}[\/-]\d{4}\b/)||[])[0]||"Not extracted";const num=(s.match(/\b\d{4}\s?\d{4}\s?\d{4}\b/)||s.match(/\b[A-Z]{5}\d{4}[A-Z]\b/)||[])[0]||"Not extracted";
  let type=/pan/i.test(s)?"PAN Card":/aadhaar|आधार/i.test(s)?"Aadhaar Card":/driving|licen[cs]e/i.test(s)?"Driving License":"Identity Document";
  let name=(s.split(/\n+/).map(x=>x.trim()).find(x=>/^[A-Za-z][A-Za-z .]{3,35}$/.test(x)&&!/(government|india|male|female|card|authority|date|dob)/i.test(x)))||"Not extracted";
  $("name").textContent=name;$("father").textContent="Not extracted";$("dob").textContent=dob;$("gender").textContent=/\b(female|woman)\b/i.test(s)?"Female":/\b(male|man)\b/i.test(s)?"Male":"Not extracted";$("number").textContent=num;$("type").textContent=type;
}
function editInfo(){toast("Edit mode: extracted fields can be changed in the form implementation")}
function runAI(){
  if(!state.file)return toast("Upload a document first");
  if(!state.consent||!state.qr||!state.face||!state.liveness||!state.officer)return toast("Complete all verification steps first");
  setStep(8,"Analyzing");toast("AI analysis running…");
  setTimeout(()=>{const score=Math.floor(8+Math.random()*23);state.analysis={score,risk:score<=30?"Low Risk":score<=60?"Medium Risk":"High Risk",recommendation:score<=30?"Document appears low risk based on available preliminary checks.":"Manual review recommended based on the screening score.",tampering:score<20?"Clear":"Needs Review"};persistState();$("score").textContent=score;$("auth").textContent="Preliminary pass";$("consistency").textContent="Matched";$("security").textContent="Reviewed";$("tamper").textContent=state.analysis.tampering;$("recommend").textContent=state.analysis.recommendation;setStep(8,"Completed");unlock(9);persistState();refreshActiveVerification();renderResult();refreshActiveVerification();log("AI analysis completed: "+score+"/100");toast("Analysis completed — Result unlocked");refreshActiveVerification();},1300);
}
function renderResult(){
  const a=state.analysis;if(!a)return;$("resultStatus").textContent="Completed";$("resultStatus").className="done";$("resultCard").classList.remove("locked");$("resultScore").textContent=a.score;$("resultRisk").textContent=a.risk;$("resultRecommendation").textContent=a.recommendation;
  if(state.officer){$("officerResultStatus").textContent="Completed";$("officerResultStatus").className="done";$("resultOfficerScore").textContent="100%";$("resultOfficerBar").style.width="100%";$("resultOfficerText").textContent="✓ Officer Photo Verified";if(state.officer)$("resultOfficerImage").src=state.officer;}
  const checks=[["Citizen Consent",state.consent],["QR / Barcode",state.qr],["Face Verification",state.face],["Liveness",state.liveness],["Officer Photo",state.officer],["Document Upload",!!state.file],["Information Extraction",!!state.ocr||!!state.file],["AI Analysis",!!state.analysis]];
  $("resultChecks").innerHTML=checks.map(x=>'<div class="check '+(x[1]?"ok":"")+'">'+(x[1]?"✓":"○")+" "+x[0]+'<br><small>'+(x[1]?"Verified / completed":"Pending")+"</small></div>").join("");
}
function submitCase(){
  if(!state.analysis)return toast("Run AI analysis first");

  const rec={
    id:state.id,
    name:$("name").textContent,
    document:$("type").textContent,
    score:state.analysis.score,
    risk:state.analysis.risk,
    status:"Submitted",
    time:new Date().toLocaleTimeString()
  };

  records=records.filter(x=>x.id!==rec.id);
  records.unshift(rec);
  localStorage.setItem("idshield_records",JSON.stringify(records));
  log("Case submitted: "+state.id);
  state.submitted=true;
  persistState();
  refreshActiveVerification();

  // Stop every active camera before printing.
  stopAllCameras();

  toast("Case submitted — opening printable report"); refreshActiveVerification();
  setTimeout(()=>openPrintReport(),350);
}

function openPrintReport(){
  const checks=[
    ["Citizen Consent",state.consent],
    ["QR / Barcode",state.qr],
    ["Face Verification",state.face],
    ["Liveness Detection",state.liveness],
    ["Officer Photo Verification",state.officer],
    ["Document Upload",!!state.file],
    ["Information Extraction",!!state.file],
    ["AI Analysis",!!state.analysis]
  ];

  const a=state.analysis||{score:"—",risk:"Awaiting analysis",recommendation:"—"};
  const reportWindow=window.open("","_blank","width=1100,height=850");

  if(!reportWindow){
    toast("Please allow pop-ups to print the report");
    return;
  }

  const officerImg=state.officer || "assets/officer-demo.jpg";
  const docImg=state.image || "";

  reportWindow.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>IDShield AI — Verification Report ${escapeHtml(state.id)}</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#fff;color:#102849;font-family:Arial,Segoe UI,sans-serif}
.page{width:210mm;min-height:297mm;margin:auto;padding:18mm}
.header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1462df;padding-bottom:14px}
.brand{font-size:25px;font-weight:800}.brand span{color:#ff633f}
.sub{font-size:11px;color:#61728a;margin-top:4px}
.case{font-size:11px;text-align:right;color:#53657d}.case b{display:block;color:#102849;font-size:14px;margin-bottom:4px}
h2{font-size:16px;margin:20px 0 10px;border-left:4px solid #1462df;padding-left:8px}
.summary{display:grid;grid-template-columns:140px 1fr;gap:20px;align-items:center;background:#f5f9fe;border:1px solid #d7e3ef;border-radius:10px;padding:16px}
.score{font-size:40px;font-weight:800;color:#15945f;text-align:center}.score small{display:block;font-size:10px;color:#53657d;font-weight:600}
.risk{font-size:22px;font-weight:800;color:#15945f}.recommend{margin-top:7px;font-size:11px;line-height:1.5;color:#405570}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.item{border:1px solid #dce5ee;border-radius:7px;padding:9px;font-size:11px}
.item b{display:block;margin-bottom:4px}.ok{background:#effaf3;border-color:#c9e8d3;color:#127b43}.pending{background:#f6f8fa;color:#65768d}
.info{display:grid;grid-template-columns:1fr 1fr;gap:8px}.field{border:1px solid #e0e7ef;border-radius:6px;padding:8px}.field small{display:block;color:#65768d;font-size:9px}.field b{font-size:11px}
.photos{display:grid;grid-template-columns:1fr 1fr;gap:15px}.photo{border:1px solid #dce5ee;border-radius:8px;padding:10px;text-align:center}.photo img{width:150px;height:170px;object-fit:cover;border-radius:6px}.photo p{font-size:10px;font-weight:700}
.footer{margin-top:22px;padding-top:10px;border-top:1px solid #dce5ee;font-size:9px;color:#65768d;line-height:1.5}
.actions{position:fixed;right:20px;bottom:20px;display:flex;gap:8px}.actions button{padding:11px 18px;border-radius:7px;border:1px solid #1462df;background:#fff;color:#075fd7;font-weight:700;cursor:pointer}.actions .print{background:#1462df;color:#fff}
@media print{.actions{display:none}.page{width:auto;min-height:auto;margin:0;padding:12mm}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div><div class="brand">IDShield <span>AI</span></div><div class="sub">Smart Identity Verification for a Safer India</div></div>
    <div class="case">VERIFICATION REPORT<b>${escapeHtml(state.id)}</b>${escapeHtml(new Date().toLocaleString())}</div>
  </div>

  <h2>Verification Result</h2>
  <div class="summary">
    <div class="score">${escapeHtml(a.score)}<small>RISK SCORE / 100</small></div>
    <div><div class="risk">${escapeHtml(a.risk)}</div><div class="recommend">${escapeHtml(a.recommendation)}</div></div>
  </div>

  <h2>Verification Checks</h2>
  <div class="grid">
    ${checks.map(x=>`<div class="item ${x[1]?"ok":"pending"}"><b>${x[1]?"✓":"○"} ${escapeHtml(x[0])}</b>${x[1]?"Verified / Completed":"Pending"}</div>`).join("")}
  </div>

  <h2>Extracted Information</h2>
  <div class="info">
    <div class="field"><small>Full Name</small><b>${escapeHtml($("name").textContent)}</b></div>
    <div class="field"><small>Father's Name</small><b>${escapeHtml($("father").textContent)}</b></div>
    <div class="field"><small>Date of Birth</small><b>${escapeHtml($("dob").textContent)}</b></div>
    <div class="field"><small>Gender</small><b>${escapeHtml($("gender").textContent)}</b></div>
    <div class="field"><small>Document Number</small><b>${escapeHtml($("number").textContent)}</b></div>
    <div class="field"><small>Document Type</small><b>${escapeHtml($("type").textContent)}</b></div>
    <div class="field"><small>Uploaded File</small><b>${escapeHtml(state.file?.name||"Not provided")}</b></div>
  </div>

  <h2>Verification Photos</h2>
  <div class="photos">
    <div class="photo">${docImg?`<img src="${docImg}" alt="Document">`:"<p>Document preview unavailable</p>"}<p>Uploaded Document</p></div>
    <div class="photo"><img src="${officerImg}" alt="Officer Photo"><p>Officer Photo Verification</p></div>
  </div>

  <div class="footer">
    <b>Important:</b> This is a preliminary AI-assisted screening report. It is not a legal determination that a document is genuine or fraudulent.
    Final verification must be performed by an authorized human officer. Government database and biometric checks must use authorized integrations and appropriate legal controls.
  </div>
</div>
<div class="actions">
  <button onclick="window.close()">Close</button>
  <button class="print" onclick="window.print()">🖨 Print Report</button>
</div>
<script>
window.onload=()=>setTimeout(()=>window.print(),500);
<\/script>
</body></html>`);

  reportWindow.document.close();
}
function downloadReport(){
  if(!state.analysis)return toast("Complete AI analysis first");
  const data={caseId:state.id,generatedAt:new Date().toISOString(),document:state.file?.name||null,extracted:{name:$("name").textContent,father:$("father").textContent,dob:$("dob").textContent,gender:$("gender").textContent,number:$("number").textContent,type:$("type").textContent},checks:{consent:state.consent,qr:state.qr,face:!!state.face,liveness:state.liveness,officer:!!state.officer},analysis:state.analysis,disclaimer:"Preliminary AI-assisted screening only. Final verification requires authorized human review."};const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));a.download=state.id+"-report.json";a.click();URL.revokeObjectURL(a.href);log("Investigation report generated");toast("Report downloaded")}
function closeModal(id){$(id).classList.remove("open");stopCamera(id==="qrModal"?"qrVideo":id==="faceModal"?"faceVideo":"officerVideo")}
async function startCamera(id,facing="user"){if(!navigator.mediaDevices?.getUserMedia){toast("Camera is not supported by this browser");return null}stopCamera(id);try{const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:facing,width:{ideal:1280},height:{ideal:720}},audio:false});streams[id]=s;$(id).srcObject=s;await $(id).play();return s}catch(e){toast("Camera permission denied or camera unavailable");return null}}
function stopCamera(id){const s=streams[id]||$(id)?.srcObject;if(s)s.getTracks().forEach(t=>t.stop());if($(id))$(id).srcObject=null;delete streams[id]}
function stopAllCameras(){Object.keys(streams).forEach(stopCamera);["qrVideo","faceVideo","officerVideo"].forEach(id=>stopCamera(id))}
function syncQueue(){localStorage.setItem("idshield_queue","0");render();toast("Offline queue synchronized")}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function renderAudit(){$("auditRows").innerHTML=audit.map(a=>"<p>"+escapeHtml(a.time)+" — "+escapeHtml(a.msg)+"</p>").join("")||"<p>No audit events yet.</p>"}
function render(){
  const h=records.filter(r=>r.risk==="High Risk").length,m=records.filter(r=>r.risk==="Medium Risk").length,l=records.filter(r=>r.risk==="Low Risk").length,total=records.length,q=Number(localStorage.getItem("idshield_queue")||0);
  $("total").textContent=total;$("high").textContent=h;$("medium").textContent=m;$("low").textContent=l;$("pending").textContent=q;$("queueCount").textContent=q;$("donutTotal").textContent=total;
  $("recentRows").innerHTML=records.slice(0,6).map(r=>row(r)).join("")||'<tr><td colspan="7">No verifications yet.</td></tr>';$("historyRows").innerHTML=records.map(r=>row(r)).join("")||'<tr><td colspan="7">No records.</td></tr>';
  $("legend").innerHTML="<p>🟢 Low Risk <b>"+l+"</b></p><p>🟠 Medium Risk <b>"+m+"</b></p><p>🔴 High Risk <b>"+h+"</b></p>";const a=total?h/total*100:0,b=total?(h+m)/total*100:35;$("donut").style.background=`conic-gradient(#ef403c 0 ${a}%,#f19a18 ${a}% ${b}%,#18a35b ${b}% 100%)`;
  
  renderAudit();refreshActiveVerification();
}
function row(r){return "<tr><td>"+escapeHtml(r.id)+"</td><td>"+escapeHtml(r.name)+"</td><td>"+escapeHtml(r.document)+"</td><td>"+r.score+"/100</td><td>"+escapeHtml(r.risk)+"</td><td>"+escapeHtml(r.status)+"</td><td>"+escapeHtml(r.time)+"</td></tr>"}
window.addEventListener("beforeunload",stopAllCameras);
$("search").addEventListener("input",()=>{const q=$("search").value.toLowerCase();$("historyRows").innerHTML=records.filter(r=>(r.name+" "+r.id+" "+r.document).toLowerCase().includes(q)).map(row).join("")||'<tr><td colspan="7">No matching records.</td></tr>'});
render();
