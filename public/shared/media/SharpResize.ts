export interface ResizeOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}
type Pending = {
  resolve: (file: File) => void;
  reject: (err: unknown) => void;
};

let worker: Worker | null = null;
const pending = new Map<number, Pending>();
let idCounter = 1;

function ensureWorker() {
  if (
    !worker &&
    typeof window !== "undefined" &&
    typeof Worker !== "undefined"
  ) {
    const workerCode = `self.addEventListener('message', async function(e) {const {id,fileBuffer,type,maxWidth,maxHeight,quality}=e.data;try{const blob=new Blob([fileBuffer],{type});const imageBitmap=await createImageBitmap(blob);const srcW=imageBitmap.width;const srcH=imageBitmap.height;if(srcW<=maxWidth&&srcH<=maxHeight){const arr=await blob.arrayBuffer();self.postMessage({id,success:true,buffer:arr,mime:type});imageBitmap.close();return}const ratio=Math.min(maxWidth/srcW,maxHeight/srcH);const targetW=Math.max(1,Math.round(srcW*ratio));const targetH=Math.max(1,Math.round(srcH*ratio));if(typeof OffscreenCanvas!=='undefined'){const canvas=new OffscreenCanvas(targetW,targetH);const ctx=canvas.getContext('2d');ctx.drawImage(imageBitmap,0,0,targetW,targetH);imageBitmap.close();const blobOut=await canvas.convertToBlob({type:'image/webp',quality});const arrBuf=await blobOut.arrayBuffer();self.postMessage({id,success:true,buffer:arrBuf,mime:blobOut.type},[arrBuf]);return}else{const arr=await blob.arrayBuffer();imageBitmap.close();self.postMessage({id,success:true,buffer:arr,mime:type});return}}catch(err){self.postMessage({id,success:false,error:String(err)})}});`;
    const blob = new Blob([workerCode], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    worker = new Worker(url);
    worker.addEventListener("message", (e) => {
      const { id, success, buffer, mime, error } = e.data;
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (success) {
        const blob = new Blob([buffer], { type: mime });
        const ext = mime.split("/")[1] || "webp";
        const file = new File([blob], `resized.${ext}`, { type: mime });
        p.resolve(file);
      } else {
        p.reject(new Error(error || "Worker error"));
      }
    });
  }
}

export async function resizeImageInWorker(
  file: File,
  opts: ResizeOptions = {},
): Promise<File> {
  if (file.type === "image/gif" || typeof window === "undefined") return file;
  ensureWorker();
  if (!worker) {
    return file;
  }

  const id = idCounter++;
  const { maxWidth = 1280, maxHeight = 1280, quality = 0.8 } = opts;

  const arrayBuffer = await file.arrayBuffer();

  return new Promise<File>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    try {
      worker!.postMessage(
        {
          id,
          fileBuffer: arrayBuffer,
          type: file.type,
          maxWidth,
          maxHeight,
          quality,
        },
        [arrayBuffer],
      );
    } catch {
      worker!.postMessage({
        id,
        fileBuffer: arrayBuffer,
        type: file.type,
        maxWidth,
        maxHeight,
        quality,
      });
    }
  });
}

export async function mainThreadResize(
  file: File,
  opts: ResizeOptions = {},
): Promise<File> {
  if (file.type === "image/gif" || typeof window === "undefined") return file;
  const { maxWidth = 1280, maxHeight = 1280, quality = 0.8 } = opts;

  try {
    const imageBitmap = await createImageBitmap(file);
    const ratio = Math.min(
      maxWidth / imageBitmap.width,
      maxHeight / imageBitmap.height,
    );
    const tw = Math.max(1, Math.round(imageBitmap.width * ratio));
    const th = Math.max(1, Math.round(imageBitmap.height * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(imageBitmap, 0, 0, tw, th);
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, "image/webp", quality),
      );
      if (blob) {
        const outFile = new File(
          [blob],
          file.name.replace(/\.[^/.]+$/, ".webp"),
          { type: blob.type },
        );
        imageBitmap.close();
        return outFile;
      }
    }
    imageBitmap.close();
    return file;
  } catch (err) {
    console.warn("mainThreadResize failed, returning original file", err);
    return file;
  }
}

export async function resizeWithWorkerFallback(
  file: File,
  maxBytes: number,
  opts: ResizeOptions = {},
): Promise<File> {
  try {
    const resized = await resizeImageInWorker(file, opts);
    if (resized.size <= maxBytes) return resized;
    const smaller = await resizeImageInWorker(file, {
      maxWidth: 800,
      maxHeight: 800,
      quality: 0.7,
    });
    if (smaller.size <= maxBytes) return smaller;
    return smaller;
  } catch {
    return await mainThreadResize(file, opts);
  }
}

export default resizeImageInWorker;

export function clampSizesForProfileImages(
  opts?: ResizeOptions,
): ResizeOptions & { maxWidth: number; maxHeight: number } {
  const defaults = { maxWidth: 400, maxHeight: 400, quality: 0.9 };
  return { ...defaults, ...(opts || {}) };
}
