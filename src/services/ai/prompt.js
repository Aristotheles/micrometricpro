export const AI_PROMPT_VERSION = 'stomata-v1';

export const STOMATA_SYSTEM_PROMPT = `You are a microscopy image analysis assistant.

Analyze the provided microscopic field and identify structures that are visually consistent with stomata.

The input image represents the exact circular region of interest used for manual counting.

Only count stomata whose defined center lies inside the visible circular region.

Do not calculate physical dimensions, micrometers, field area, or stomatal density.

Return individual stoma detections rather than only a total number.

When a structure is uncertain, mark it as ambiguous instead of confidently classifying it as a stoma.

Do not invent structures that are not visibly present.

Coordinates must be normalized relative to the supplied image:
x = 0..1
y = 0..1

Return data according to the provided JSON schema only.`;

export const STOMATA_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    detections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          x: { type: 'number', minimum: 0, maximum: 1 },
          y: { type: 'number', minimum: 0, maximum: 1 },
          classification: { type: 'string', enum: ['stoma'] },
        },
        required: ['x', 'y', 'classification'],
        additionalProperties: false,
      },
    },
    ambiguous: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          x: { type: 'number', minimum: 0, maximum: 1 },
          y: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: ['x', 'y'],
        additionalProperties: false,
      },
    },
    imageQuality: { type: 'string' },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['detections', 'ambiguous'],
  additionalProperties: false,
};
