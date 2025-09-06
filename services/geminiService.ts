
import { GoogleGenAI } from "@google/genai";

// Ensure the API key is available. In a real app, you'd have a more robust way to handle this.
if (!process.env.API_KEY) {
    console.warn("API_KEY environment variable not set. AI features will not work.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

export const runPythonCode = async (code: string): Promise<string> => {
    if (!process.env.API_KEY) {
        return "Error: API_KEY is not configured. AI features are disabled.";
    }
    try {
        const prompt = `
            You are a Python interpreter. Execute the following Python code and return ONLY the standard output.
            If there is an error, return ONLY the error message. Do not add any explanations, introductory text, or markdown formatting.
            
            Code:
            \`\`\`python
            ${code}
            \`\`\`
        `;
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                temperature: 0.1,
                thinkingConfig: { thinkingBudget: 0 } 
            }
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error executing Python code via Gemini:", error);
        return `An error occurred while communicating with the AI: ${error instanceof Error ? error.message : String(error)}`;
    }
};

export const askAIQuestion = async (question: string): Promise<string> => {
    if (!process.env.API_KEY) {
        return "Error: API_KEY is not configured. AI features are disabled.";
    }
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: question,
             config: {
                temperature: 0.7,
            }
        });
        return response.text;
    } catch (error) {
        console.error("Error asking AI question via Gemini:", error);
        return `An error occurred while communicating with the AI: ${error instanceof Error ? error.message : String(error)}`;
    }
};
