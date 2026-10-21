import { parentPort, workerData } from "node:worker_threads";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFStream } from "pdf-lib";
const forbidden = new Set([
  "JavaScript",
  "JS",
  "Launch",
  "OpenAction",
  "AA",
  "EmbeddedFile",
  "EmbeddedFiles",
  "RichMedia",
  "XFA",
  "Encrypt",
  "URI",
  "SubmitForm",
  "ImportData",
  "GoToR",
  "Rendition",
  "Sound",
  "Movie",
  "3D",
]);
try {
  const doc = await PDFDocument.load(workerData, {
    ignoreEncryption: false,
    updateMetadata: false,
    throwOnInvalidObject: true,
  });
  if (doc.isEncrypted || doc.getPageCount() < 1 || doc.getPageCount() > 100)
    throw new Error();
  const objects = doc.context.enumerateIndirectObjects();
  if (objects.length > 5000) throw new Error();
  const seen = new Set();
  let nodes = 0;
  function visit(object, depth = 0) {
    if (seen.has(object)) return;
    seen.add(object);
    if (++nodes > 20000 || depth > 64) throw new Error();
    if (object instanceof PDFName && forbidden.has(object.decodeText()))
      throw new Error();
    if (object instanceof PDFDict)
      for (const [name, value] of object.entries()) {
        visit(name, depth + 1);
        visit(value, depth + 1);
      }
    if (object instanceof PDFArray)
      for (let i = 0; i < object.size(); i++) visit(object.get(i), depth + 1);
    if (object instanceof PDFStream) visit(object.dict, depth + 1);
  }
  for (const [, object] of objects) visit(object);
  parentPort.postMessage(true);
} catch {
  parentPort.postMessage(false);
}
