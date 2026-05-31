export interface ImageTransformOptions {
  rotate: number;
  flipH: boolean;
  flipV: boolean;
  cropBox: { left: number; top: number; width: number; height: number };
  targetWidth: number;
  targetHeight: number;
}

/**
 * Applies rotation, flipping, and cropping transformations to an image element
 * and draws the result on a new canvas.
 */
export function drawTransformedImage(
  originalImage: HTMLImageElement,
  options: ImageTransformOptions
): HTMLCanvasElement | null {
  const { rotate, flipH, flipV, cropBox, targetWidth, targetHeight } = options;
  const isRotated90 = rotate === 90 || rotate === 270;
  
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return null;
  
  const rotW = isRotated90 ? originalImage.naturalHeight : originalImage.naturalWidth;
  const rotH = isRotated90 ? originalImage.naturalWidth : originalImage.naturalHeight;
  tempCanvas.width = rotW;
  tempCanvas.height = rotH;
  
  tempCtx.translate(rotW / 2, rotH / 2);
  tempCtx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  tempCtx.rotate((rotate * Math.PI) / 180);
  tempCtx.drawImage(
    originalImage,
    -originalImage.naturalWidth / 2,
    -originalImage.naturalHeight / 2
  );
  
  const sX = (cropBox.left / 100) * rotW;
  const sY = (cropBox.top / 100) * rotH;
  const sW = (cropBox.width / 100) * rotW;
  const sH = (cropBox.height / 100) * rotH;
  
  const finalCanvas = document.createElement('canvas');
  const finalCtx = finalCanvas.getContext('2d');
  if (!finalCtx) return null;
  
  const finalW = (targetWidth && targetWidth > 0) ? targetWidth : rotW;
  const finalH = (targetHeight && targetHeight > 0) ? targetHeight : rotH;

  finalCanvas.width = finalW || 1;
  finalCanvas.height = finalH || 1;
  
  finalCtx.drawImage(
    tempCanvas,
    sX, sY, sW, sH,
    0, 0, finalW, finalH
  );
  
  return finalCanvas;
}

/**
 * Modifies file path extension according to the compression format selected.
 */
export const changeExtension = (filePath: string, format: string): string => {
  const parts = filePath.split('.');
  if (parts.length > 1) {
    parts.pop();
  }
  const ext = format === 'image/webp' ? 'webp' : format === 'image/jpeg' ? 'jpg' : 'png';
  return `${parts.join('.')}.${ext}`;
};

/**
 * Formats a file size in bytes to a human-readable string.
 */
export const formatSize = (bytes: number): string => {
  if (bytes === 0 || !bytes) return '—';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Calculates percentage file savings.
 */
export const calculateSavings = (originalSize: number, estimatedSize: number | null): number => {
  if (!estimatedSize || !originalSize) return 0;
  return Math.round(((originalSize - estimatedSize) / originalSize) * 100);
};

export interface CropDragOptions {
  dragType: 'move' | 'nw' | 'ne' | 'sw' | 'se';
  clientX: number;
  clientY: number;
  dragStartX: number;
  dragStartY: number;
  containerRect: { width: number; height: number };
  initialCropBox: { left: number; top: number; width: number; height: number };
  cropAspectRatio: number | null;
}

/**
 * Calculates the new crop box values based on coordinate drag offsets.
 */
export function calculateNewCropBox(options: CropDragOptions) {
  const { dragType, clientX, clientY, dragStartX, dragStartY, containerRect, initialCropBox, cropAspectRatio } = options;
  const pctX = ((clientX - dragStartX) / containerRect.width) * 100;
  const pctY = ((clientY - dragStartY) / containerRect.height) * 100;
  
  let left = initialCropBox.left;
  let top = initialCropBox.top;
  let width = initialCropBox.width;
  let height = initialCropBox.height;
  
  const minSize = 5;
  
  if (dragType === 'move') {
    left = Math.max(0, Math.min(100 - width, left + pctX));
    top = Math.max(0, Math.min(100 - height, top + pctY));
  } else {
    if (dragType === 'nw') {
      const maxLeft = initialCropBox.left + initialCropBox.width - minSize;
      const maxTop = initialCropBox.top + initialCropBox.height - minSize;
      
      left = Math.max(0, Math.min(maxLeft, left + pctX));
      top = Math.max(0, Math.min(maxTop, top + pctY));
      width = initialCropBox.left + initialCropBox.width - left;
      height = initialCropBox.top + initialCropBox.height - top;
    } else if (dragType === 'ne') {
      const maxTop = initialCropBox.top + initialCropBox.height - minSize;
      const maxWidth = 100 - left;
      
      top = Math.max(0, Math.min(maxTop, top + pctY));
      width = Math.max(minSize, Math.min(maxWidth, width + pctX));
      height = initialCropBox.top + initialCropBox.height - top;
    } else if (dragType === 'sw') {
      const maxLeft = initialCropBox.left + initialCropBox.width - minSize;
      const maxHeight = 100 - top;
      
      left = Math.max(0, Math.min(maxLeft, left + pctX));
      width = initialCropBox.left + initialCropBox.width - left;
      height = Math.max(minSize, Math.min(maxHeight, height + pctY));
    } else if (dragType === 'se') {
      const maxWidth = 100 - left;
      const maxHeight = 100 - top;
      
      width = Math.max(minSize, Math.min(maxWidth, width + pctX));
      height = Math.max(minSize, Math.min(maxHeight, height + pctY));
    }
    
    if (cropAspectRatio) {
      let newHeight = width / cropAspectRatio;
      if (top + newHeight > 100) {
        newHeight = 100 - top;
        width = newHeight * cropAspectRatio;
      }
      height = newHeight;
    }
  }
  
  return { left, top, width, height };
}

/**
 * Helper to draw image transformations directly to the target workspace canvas
 */
export function drawToCanvas(
  canvas: HTMLCanvasElement,
  originalImage: HTMLImageElement,
  cropMode: boolean,
  options: ImageTransformOptions
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  const { rotate, flipH, flipV, targetWidth, targetHeight } = options;
  const isRotated90 = rotate === 90 || rotate === 270;
  
  if (cropMode) {
    const canvasW = isRotated90 ? originalImage.naturalHeight : originalImage.naturalWidth;
    const canvasH = isRotated90 ? originalImage.naturalWidth : originalImage.naturalHeight;
    
    canvas.width = canvasW;
    canvas.height = canvasH;
    
    ctx.clearRect(0, 0, canvasW, canvasH);
    
    ctx.translate(canvasW / 2, canvasH / 2);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.drawImage(
      originalImage, 
      -originalImage.naturalWidth / 2, 
      -originalImage.naturalHeight / 2
    );
  } else {
    const transformedCanvas = drawTransformedImage(originalImage, options);
    if (!transformedCanvas) return;
    
    canvas.width = targetWidth || 1;
    canvas.height = targetHeight || 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(transformedCanvas, 0, 0);
  }
}
