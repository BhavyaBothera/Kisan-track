const {onCall,HttpsError}=require("firebase-functions/v2/https");
const {defineSecret}=require("firebase-functions/params");
const {initializeApp}=require("firebase-admin/app");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const {getStorage}=require("firebase-admin/storage");
initializeApp();
const db=getFirestore(), bucket=getStorage().bucket(), GEMINI_API_KEY=defineSecret("GEMINI_API_KEY");
const MODEL="gemini-2.0-flash";
function clean(v,n=1000){return typeof v==="string"?v.trim().slice(0,n):"";}
function validate(r){
 const score=Number(r?.healthScore), severity=String(r?.severity||"").toUpperCase();
 if(!Number.isFinite(score)||score<0||score>10||!["HEALTHY","WARNING","CRITICAL"].includes(severity)) throw new Error("Invalid AI result");
 const list=v=>Array.isArray(v)?v.filter(x=>typeof x==="string").map(x=>x.trim().slice(0,300)).filter(Boolean).slice(0,20):[];
 const hs=Array.isArray(r.hotspots)?r.hotspots.slice(0,20).map(h=>({x:Number(h?.x),y:Number(h?.y),label:clean(h?.label,120),confidence:Number(h?.confidence)})).filter(h=>h.label&&h.x>=0&&h.x<=100&&h.y>=0&&h.y<=100&&h.confidence>=0&&h.confidence<=1):[];
 return {healthScore:Number(score.toFixed(1)),severity,conditions:list(r.conditions),observations:list(r.observations),farmerTip:clean(r.farmerTip,800),summary:clean(r.summary,1000),hotspots:hs,analysisType:"AI-assisted visual screening",model:MODEL};
}
exports.analyzeAnimalImage=onCall({region:"asia-south1",timeoutSeconds:60,memory:"512MiB",secrets:[GEMINI_API_KEY]},async request=>{
 const uid=request.auth?.uid;if(!uid)throw new HttpsError("unauthenticated","Sign in before analysing an image.");
 const {captureId,storagePath,animalId}=request.data||{};
 if(typeof captureId!=="string"||!/^capture_[A-Za-z0-9_-]{1,70}$/.test(captureId)||typeof storagePath!=="string"||!storagePath.startsWith(`camera-captures/${uid}/`))throw new HttpsError("invalid-argument","Invalid capture reference.");
 const file=bucket.file(storagePath),[meta]=await file.getMetadata();
 if(Number(meta.size)>10*1024*1024||!String(meta.contentType||"").startsWith("image/"))throw new HttpsError("invalid-argument","Invalid image.");
 const [buf]=await file.download();
 const prompt=`You are an AI-assisted livestock health screening system. Analyze only visible evidence. Do not diagnose disease. Return JSON only: {"healthScore":0-10,"severity":"HEALTHY"|"WARNING"|"CRITICAL","conditions":[],"observations":[],"farmerTip":"brief cautious advice in English and Hindi","summary":"evidence-based screening summary","hotspots":[{"x":0-100,"y":0-100,"label":"visible issue","confidence":0-1}]}. If image quality is insufficient, say so and recommend veterinary review for concerning findings.`;
 const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY.value())}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt},{inline_data:{mime_type:meta.contentType,data:buf.toString("base64")}}]}],generationConfig:{responseMimeType:"application/json",temperature:.1}})});
 if(!response.ok)throw new HttpsError("unavailable","AI screening service is temporarily unavailable.");
 const data=await response.json(),text=data?.candidates?.[0]?.content?.parts?.[0]?.text;if(!text)throw new HttpsError("data-loss","AI screening returned no usable result.");
 let parsed;try{parsed=JSON.parse(text)}catch(_){throw new HttpsError("data-loss","AI screening returned invalid JSON.");}
 let analysis;try{analysis=validate(parsed)}catch(_){throw new HttpsError("data-loss","AI screening returned an invalid result.");}
 const capture={farmerId:uid,animalId:clean(animalId,120)||"HERD-GENERIC",imagePath:storagePath,timestamp:FieldValue.serverTimestamp(),...analysis};
 const batch=db.batch(),ref=db.collection("cameraCaptures").doc(captureId);batch.set(ref,capture);
 if(analysis.healthScore<6||analysis.severity==="CRITICAL")batch.set(db.collection("alerts").doc(),{farmerId:uid,animalId:capture.animalId,parameter:"AI Visual Screening",readingValue:`${analysis.healthScore}/10`,alertType:"AI Visual Anomaly",severity:analysis.severity,confidenceScore:analysis.hotspots.length?Math.round(Math.max(...analysis.hotspots.map(h=>h.confidence))*100):null,message:analysis.summary,timestamp:FieldValue.serverTimestamp(),resolved:false,source:"Nexus AI"});
 await batch.commit();return {capture:{id:captureId,...capture,timestamp:new Date().toISOString()}};
});