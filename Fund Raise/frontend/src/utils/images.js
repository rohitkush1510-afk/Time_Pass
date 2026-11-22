const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.85;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function fileToImageDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file || !ALLOWED_TYPES.includes(file.type)) {
      reject(new Error('Please choose a JPG, PNG, WEBP or GIF image'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file'));

    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('That file is not a valid image'));

      image.onload = () => {
        const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));

        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        try {
          resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
        } catch {
          reject(new Error('Could not prepare that image'));
        }
      };

      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}
