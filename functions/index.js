const {onCall,HttpsError}=require("firebase-functions/v2/https");
const {onSchedule}=require("firebase-functions/v2/scheduler");
const {onDocumentWritten}=require("firebase-functions/v2/firestore");
const {defineSecret}=require("firebase-functions/params");
const {initializeApp}=require("firebase-admin/app");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const {getStorage}=require("firebase-admin/storage");
initializeApp();
const db=getFirestore(), bucket=getStorage().bucket(), GEMINI_API_KEY=defineSecret("GEMINI_API_KEY");
const MODEL="gemini-2.0-flash";
const CAMERA_RETENTION_DAYS=3;
async function incrementAiMetric(uid,field){const day=new Date().toISOString().slice(0,10);const ref=db.collection("systemMetrics").doc("ai_"+day);await ref.set({scope:"ai",date:day,[field+"Count"]:FieldValue.increment(1),updatedAt:FieldValue.serverTimestamp()},{merge:true});}
async function cleanupExpiredCaptures() {
  // expiresAt is the actual retention deadline (createdAt + 3 days); compare it to now.
  const now = new Date();
  const snap = await db.collection("cameraCaptures").where("expiresAt", "<=", now).limit(100).get();
  let deleted = 0;
  for (const doc of snap.docs) {
    const storagePath = String(doc.data().imagePath || "");
    const segments = storagePath.split("/");
    if (segments.length === 3 && segments[0] === "camera-captures" && segments[1] && segments[2]) {
      try {
        await bucket.file(storagePath).delete({ ignoreNotFound: true });
      } catch (error) {
        console.warn("Retention cleanup storage delete failed", doc.id, error.message);
      }
    }
    await doc.ref.delete();
    deleted++;
  }
  console.log(JSON.stringify({ event: "camera_retention_cleanup", deleted, cutoff: now.toISOString() }));
  return deleted;
}
function clean(v,n=1000){return typeof v==="string"?v.trim().slice(0,n):"";}
function validate(r){
 const score=Number(r?.healthScore), severity=String(r?.severity||"").toUpperCase();
 if(!Number.isFinite(score)||score<0||score>10||!["HEALTHY","WARNING","CRITICAL"].includes(severity)) throw new Error("Invalid AI result");
 const list=v=>Array.isArray(v)?v.filter(x=>typeof x==="string").map(x=>x.trim().slice(0,300)).filter(Boolean).slice(0,20):[];
 const hs=Array.isArray(r.hotspots)?r.hotspots.slice(0,20).map(h=>({x:Number(h?.x),y:Number(h?.y),label:clean(h?.label,120),confidence:Number(h?.confidence)})).filter(h=>h.label&&h.x>=0&&h.x<=100&&h.y>=0&&h.y<=100&&h.confidence>=0&&h.confidence<=1):[];
 return {healthScore:Number(score.toFixed(1)),severity,conditions:list(r.conditions),observations:list(r.observations),farmerTip:clean(r.farmerTip,800),summary:clean(r.summary,1000),hotspots:hs,analysisType:"AI-assisted visual screening",model:MODEL};
}
exports.analyzeAnimalImage = onCall(
  { region: "asia-south1", timeoutSeconds: 60, memory: "512MiB", secrets: [GEMINI_API_KEY] },
  async request => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in before analysing an image.");
    const { captureId, storagePath, animalId } = request.data || {};
    if (typeof captureId !== "string" || !/^capture_[A-Za-z0-9_-]{1,70}$/.test(captureId) ||
        typeof storagePath !== "string" || !storagePath.startsWith(`camera-captures/${uid}/`)) {
      throw new HttpsError("invalid-argument", "Invalid capture reference.");
    }

    const file = bucket.file(storagePath);
    let meta, buf;
    try {
      [meta] = await file.getMetadata();
      if (Number(meta.size) <= 0 || Number(meta.size) > 10 * 1024 * 1024 ||
          !/^image\/(jpeg|png|webp|gif|heic|heif)$/i.test(String(meta.contentType || ""))) {
        throw new HttpsError("invalid-argument", "Invalid image.");
      }
      [buf] = await file.download();
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("not-found", "The uploaded image could not be found.");
    }

    const day = new Date().toISOString().slice(0, 10);
    const quotaRef = db.collection("aiRateLimits").doc(`${uid}_${day}`);
    const captureRef = db.collection("cameraCaptures").doc(captureId);
    const expiry = new Date(Date.now() + CAMERA_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    await db.runTransaction(async transaction => {
      const [quotaSnap, captureSnap] = await Promise.all([
        transaction.get(quotaRef), transaction.get(captureRef)
      ]);
      if (captureSnap.exists) throw new HttpsError("already-exists", "This capture ID has already been used.");
      const used = Number(quotaSnap.exists ? quotaSnap.data().count : 0);
      if (!Number.isFinite(used) || used >= 20) {
        throw new HttpsError("resource-exhausted", "Daily AI screening limit reached. Try again tomorrow.");
      }
      transaction.set(quotaRef, {
        farmerId: uid, date: day, count: used + 1, updatedAt: FieldValue.serverTimestamp()
      });
      transaction.create(captureRef, {
        farmerId: uid, animalId: clean(animalId, 120) || "HERD-GENERIC",
        imagePath: storagePath, status: "processing",
        timestamp: FieldValue.serverTimestamp(), expiresAt: expiry
      });
    });

    let completed = false;
    try {
      await incrementAiMetric(uid, "request");
      const prompt = `You are an AI-assisted livestock health screening system. Analyze only visible evidence. Do not diagnose disease. Return JSON only: {"healthScore":0-10,"severity":"HEALTHY"|"WARNING"|"CRITICAL","conditions":[],"observations":[],"farmerTip":"brief cautious advice in English and Hindi","summary":"evidence-based screening summary","hotspots":[{"x":0-100,"y":0-100,"label":"visible issue","confidence":0-1}]}. If image quality is insufficient, say so and recommend veterinary review for concerning findings.`;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY.value())}`,
        { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [
            { text: prompt }, { inline_data: { mime_type: meta.contentType, data: buf.toString("base64") } }
          ] }], generationConfig: { responseMimeType: "application/json", temperature: 0.1 } }) }
      );
      if (!response.ok) throw new HttpsError("unavailable", "AI screening service is temporarily unavailable.");
      const data = await response.json();
      const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!responseText) throw new HttpsError("data-loss", "AI screening returned no usable result.");
      let parsed;
      try { parsed = JSON.parse(responseText); }
      catch (_) { throw new HttpsError("data-loss", "AI screening returned invalid JSON."); }
      let analysis;
      try { analysis = validate(parsed); }
      catch (_) { throw new HttpsError("data-loss", "AI screening returned an invalid result."); }

      const capture = {
        farmerId: uid, animalId: clean(animalId, 120) || "HERD-GENERIC",
        imagePath: storagePath, timestamp: FieldValue.serverTimestamp(), expiresAt: expiry, ...analysis
      };
      const batch = db.batch();
      batch.set(captureRef, capture);
      if (analysis.healthScore < 6 || analysis.severity === "CRITICAL") {
        batch.set(db.collection("alerts").doc(), {
          farmerId: uid, animalId: capture.animalId, parameter: "AI Visual Screening",
          readingValue: `${analysis.healthScore}/10`, alertType: "AI Visual Anomaly",
          severity: analysis.severity,
          confidenceScore: analysis.hotspots.length ? Math.round(Math.max(...analysis.hotspots.map(h => h.confidence)) * 100) : null,
          message: analysis.summary, timestamp: FieldValue.serverTimestamp(), resolved: false, source: "Nexus AI"
        });
      }
      await batch.commit();
      await incrementAiMetric(uid, "success");
      completed = true;
      return { capture: { id: captureId, ...capture, timestamp: new Date().toISOString() } };
    } catch (error) {
      if (!completed) {
        try {
          await db.runTransaction(async transaction => {
            const snap = await transaction.get(captureRef);
            if (snap.exists && snap.data().farmerId === uid && snap.data().status === "processing") {
              transaction.delete(captureRef);
            }
          });
        } catch (cleanupError) {
          console.error("Failed to clean up AI capture reservation", cleanupError.message);
        }
      }
      if (error instanceof HttpsError) throw error;
      console.error("AI screening failed", error.message);
      throw new HttpsError("unavailable", "AI screening failed. Please try again.");
    }
  }
);
exports.requestDataAction=onCall({region:"asia-south1"},async request=>{
 const uid=request.auth?.uid;if(!uid)throw new HttpsError("unauthenticated","Sign in before requesting data management.");
 const type=String(request.data?.type||"").toLowerCase();
 if(!["export","deletion"].includes(type))throw new HttpsError("invalid-argument","Data action must be export or deletion.");
 const ref=db.collection("dataRequests").doc();
 await ref.set({farmerId:uid,type,status:"pending",requestedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
 return {requestId:ref.id,status:"pending",message:type==="export"?"Your data export request was recorded.":"Your account deletion request was recorded for review."};
});
exports.syncLatestVitals=onDocumentWritten({region:"asia-south1",document:"vitals/{vitalId}"},async event=>{
 const after=event.data?.after;
 if(!after?.exists)return;
 const data=after.data();
 if(typeof data.farmerId!=="string"||typeof data.animalId!=="string")return;
 const latestRef=db.collection("animalLatestVitals").doc(data.farmerId+"_"+data.animalId);
 const current=await latestRef.get();
 const currentTs=current.exists&&current.data().timestamp;
 const nextTs=data.timestamp;
 if(current.exists&&currentTs&&nextTs&&typeof currentTs.toMillis==="function"&&typeof nextTs.toMillis==="function"&&currentTs.toMillis()>=nextTs.toMillis())return;
 await latestRef.set({farmerId:data.farmerId,animalId:data.animalId,bodyTempCelsius:data.bodyTempCelsius??null,heartRateBpm:data.heartRateBpm??null,activityScore:data.activityScore??null,timestamp:nextTs||FieldValue.serverTimestamp(),sourceVitalId:event.params.vitalId,updatedAt:FieldValue.serverTimestamp()},{merge:true});
});
exports.cleanupExpiredCameraCaptures=onSchedule({schedule:"every day 03:15",timeZone:"Asia/Kolkata",region:"asia-south1"},async()=>cleanupExpiredCaptures());
