
import { GoogleGenAI } from "@google/genai";
import { Patient } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

export const generatePatientSummary = async (patient: Patient): Promise<string> => {
  const notes = patient.progressNotes.map(n => `- ${new Date(n.date).toLocaleString()}: ${n.note}`).join('\n');

  const prompt = `
    You are a medical professional specializing in intensive care.
    Generate a concise clinical summary for a patient handoff based on the following details.
    The summary should be in clear, professional language, highlighting the most critical information.
    Format the output as a single paragraph.

    Patient Unit: ${patient.unit}
    Patient Age: ${patient.age} ${patient.ageUnit}
    Gender: ${patient.gender}
    Primary Diagnosis: ${patient.diagnosis}
    Clinical Notes:
    ${notes || 'No notes available.'}
    Current Status: ${patient.outcome}
  `;

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating summary with Gemini:", error);
    return "Error: Could not generate summary. The AI model may be unavailable or there might be an issue with the API key.";
  }
};
