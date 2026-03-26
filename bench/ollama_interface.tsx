import * as fs from 'fs';
import * as path from 'path';

interface OllamaInferenceArgs {
  model_name: string;
  prompt: string;
  response_location: string;
}

/**
 * Runs inference using a local Ollama instance and saves the response to a specified file.
 * 
 * @param args - Object containing model_name, prompt, and response_location
 */
export async function ollama_inference({
  model_name,
  prompt,
  response_location,
}: OllamaInferenceArgs): Promise<void> {
  const OLLAMA_API_URL = 'http://localhost:11434/api/generate';

  try {
    // 1. Send the request to the local Ollama API
    const response = await fetch(OLLAMA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model_name,
        prompt: prompt,
        stream: false, // Set to true if you want to handle a streaming response
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API responded with status ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const inferenceResult = data.response;

    // 2. Ensure the destination directory exists
    const dir = path.dirname(response_location);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 3. Write the response to the specified location
    fs.writeFileSync(response_location, inferenceResult, 'utf8');

    console.log(`✅ Success: Output from '${model_name}' saved to ${response_location}`);
  } catch (error) {
    console.error(`❌ Error during Ollama inference with model '${model_name}':`, error);
    throw error;
  }
}

// ==========================================
// Example Usage
// ==========================================
/*
async function run() {
  await ollama_inference({
    model_name: "llama3", // Ensure you have this model pulled via `ollama run llama3`
    prompt: "Write a short poem about the ocean.",
    response_location: "./outputs/ocean_poem.txt"
  });
}

run();
*/
