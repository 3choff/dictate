/**
 * Preset prompts for text rewriting
 * Note: Prompts are kept in English as they are instructions for the LLM.
 * Each prompt includes instructions to preserve the original language of the input text.
 */
export const PRESET_PROMPTS = {
    'grammar_correction': "Correct the grammar, spelling, and punctuation of the following text. Convert number words to digits (twenty-five → 25, ten percent → 10%, five dollars → $5). IMPORTANT: Preserve the original language of the text - do not translate it. Return only the corrected text without any explanations or additional commentary.",
    'professional': "Rewrite the following text in a professional and formal tone. Maintain the core message while making it suitable for business communication. IMPORTANT: Preserve the original language of the text - do not translate it. Return only the rewritten text without any explanations.",
    'polite': "Rewrite the following text in a polite and courteous tone. Make it more respectful and considerate while keeping the original meaning. IMPORTANT: Preserve the original language of the text - do not translate it. Return only the rewritten text without any explanations.",
    'casual': "Rewrite the following text in a casual and friendly tone. Make it more conversational and relaxed while maintaining clarity. IMPORTANT: Preserve the original language of the text - do not translate it. Return only the rewritten text without any explanations.",
    'structured': "Reformulate the following text in a well-organized and structured manner. Improve clarity, flow, and coherence while maintaining all key ideas. Organize thoughts logically and ensure smooth transitions between concepts. IMPORTANT: Preserve the original language of the text - do not translate it. Return only the reformulated text without any explanations."
};
