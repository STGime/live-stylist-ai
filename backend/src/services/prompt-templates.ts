export interface PromptTemplate {
  prefix: string;
  suffix: string;
  examples: string[];
}

export const PROMPT_TEMPLATES: Record<string, PromptTemplate> = {
  hairstyle: {
    prefix:
      'Change the hairstyle of the person in this photo.',
    suffix:
      'Keep the person\'s face, skin tone, and facial features exactly the same. ' +
      'The new hairstyle should look natural and realistic, as if the person actually has this hair. ' +
      'Maintain the original photo quality, lighting, and background.',
    examples: [
      'Give them a soft layered bob with warm honey highlights, tucked behind one ear.',
      'Add long, loose beachy waves in a dark chocolate brown color.',
      'Style their hair in a sleek high ponytail with face-framing pieces.',
      'Give them a textured pixie cut with platinum blonde color.',
    ],
  },

  makeup: {
    prefix:
      'Apply the following makeup look to the person in this photo.',
    suffix:
      'Keep the person\'s face shape, features, and skin tone recognizable. ' +
      'The makeup should look professionally applied and realistic — not painted on or artificial. ' +
      'Maintain the original photo lighting and background.',
    examples: [
      'Apply a soft glam look: flawless skin, warm brown smoky eye, defined brows, nude pink lips with gloss.',
      'Create a bold evening look: dramatic winged eyeliner, false lashes, sculpted contour, deep berry matte lips.',
      'Apply a natural "no-makeup makeup" look: even skin, soft peach blush, barely-there mascara, tinted lip balm.',
      'Do a Korean glass-skin look: dewy luminous skin, gradient coral lip tint, soft brown eyeliner, straight brows.',
    ],
  },

  accessory: {
    prefix:
      'Add the following accessory to the person in this photo.',
    suffix:
      'Keep the person\'s face, hair, and clothing unchanged. ' +
      'The accessory should look naturally worn, with correct perspective, lighting, and shadows. ' +
      'Maintain the original photo quality.',
    examples: [
      'Add elegant gold hoop earrings and a delicate layered necklace.',
      'Put on trendy oversized square sunglasses with tortoiseshell frames.',
      'Add a silk headband in deep emerald green tied as a bow.',
      'Put on a wide-brim straw sun hat with a ribbon band.',
    ],
  },

  clothing: {
    prefix:
      'Change the clothing/outfit of the person in this photo.',
    suffix:
      'Keep the person\'s face, hair, and body proportions exactly the same. ' +
      'The new clothing should fit naturally and match the photo\'s lighting. ' +
      'Maintain the original background and photo quality.',
    examples: [
      'Dress them in a tailored black blazer over a white silk camisole.',
      'Change their outfit to a flowy floral midi dress in soft pastels.',
      'Put them in a cozy oversized cream cable-knit sweater.',
      'Dress them in a sleek leather jacket with a band tee underneath.',
    ],
  },

  full_look: {
    prefix:
      'Transform the person\'s complete style in this photo.',
    suffix:
      'Keep the person\'s facial features and identity clearly recognizable. ' +
      'All changes should look cohesive and natural together. ' +
      'Maintain realistic photo quality.',
    examples: [
      'Give them a complete boho-chic transformation: loose wavy hair with braided crown, earthy eyeshadow, flowy white maxi dress, layered gold jewelry.',
      'Transform into a sleek corporate look: polished blowout, subtle makeup with defined brows and nude lip, tailored navy blazer, pearl studs.',
    ],
  },
};

export function buildEditPrompt(
  description: string,
  category?: keyof typeof PROMPT_TEMPLATES,
): string {
  if (category && PROMPT_TEMPLATES[category]) {
    const template = PROMPT_TEMPLATES[category];
    return `${template.prefix} ${description}. ${template.suffix}`;
  }

  return (
    `Apply this style change to the person in the photo: ${description}. ` +
    `Keep the person's face and identity clearly recognizable. ` +
    `Make the change look natural and realistic. Maintain photo quality.`
  );
}
