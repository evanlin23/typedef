export const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
export const isPptx = (file: File) => file.type === PPTX_MIME || file.name.toLowerCase().endsWith('.pptx');
