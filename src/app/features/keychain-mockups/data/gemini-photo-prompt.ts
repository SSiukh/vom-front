export const GEMINI_APP_URL = 'https://gemini.google.com/app';

export const GEMINI_PHOTO_PROMPT = `Using the uploaded photo, create a clean, high-contrast illustration of the main subject suitable for laser engraving.

Requirements:
  - Keep only the main subject (and any person or animal that is part of it), remove all background completely.
  - Place the subject on a pure white background (#FFFFFF).
  - Convert the image into a black ink / line-art illustration, no colors.
  - Use solid black shapes and clean contours, avoid gradients, shadows, blur, or halftones.
  - Preserve accurate proportions, geometry, and recognizable details of the specific subject.
  - Simplify small details but do not distort the overall shape.
  - Lines must be clear, closed, and well-defined, suitable for vector tracing.
  - Avoid sketchy, hand-drawn, cartoon, or comic styles.
  - Avoid artistic effects, textures, lighting effects, or depth.
  - The final image should look like a professional engraving stencil.

Output:
  - High-resolution image (minimum 3000px on the longest side).
  - Pure white background, black illustration only.
  - Ready for SVG conversion and laser engraving.

Do NOT:
  - Add shadows, gradients, reflections, or textures
  - Use grayscale or transparency
  - Stylize or change the subject's design
  - Add background elements
  - Crop or cut off any part of the subject
  - Use pencil, charcoal, watercolor, or sketch styles
  - Add text, logos, or watermarks`;
