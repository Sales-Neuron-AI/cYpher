import { Agent } from '@openserv-labs/sdk';
import { z } from 'zod';
import axios from 'axios';
import 'dotenv/config';

// Define the Moonward API URL
const MOONWARD_API_URL = 'https://api.moonward.net/api/v1/signals';
// Define the OpenServ API base URL
const OPENSERV_API_URL = 'https://api.openserv.ai';

// 1. We create a new "Custom Agent" class
class CustomMoonwardAgent extends Agent {

  // 2. This is our main function, now private to this class
  private async runFetchAndFormat(action: any) { 
    const apiKey = process.env.MOONWARD_API_KEY;

    if (!apiKey) {
      console.error('CRITICAL ERROR: The MOONWARD_API_KEY variable was not found in process.env. It is undefined or null.');
      throw new Error('Agent is not configured with Moonward API key.');
    }
    console.log(`Found API key in environment. Key length: ${apiKey.length}`);

    try {
      // A. Make the API call to Moonward
      console.log('Fetching active signals from Moonward...');
      const response = await axios.get(MOONWARD_API_URL, {
        headers: { 'x-api-key': apiKey },
        params: { 'include_expired': false }
      });

      const signals = response.data.data || [];

      if (signals.length === 0) {
        console.log('No active signals found.');
        return [];
      }
      
      console.log(`Fetched ${signals.length} active signal(s).`);

      // B. Your custom logic
      const formattedSignals = signals.map((signal: any) => ({
        ...signal,
        position_size: 1000,
        leverage: 10
      }));

      // C. Return the new, modified array
      return formattedSignals;

    } catch (error) {
      console.error('Error fetching signals from Moonward:', error);
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(`Moonward API Error: ${error.response.status} - ${error.response.data.message || error.response.statusText}`);
      }
      throw new Error('An unexpected error occurred while fetching signals.');
    }
  }

  // 3. This is the "override"
  protected async doTask(action: any) {
    if (!action.task) return;

    console.log(`Received task: ${action.task.description}`);
    
    // Read the OpenServ key from the environment
    const openServKey = process.env.OPENSERV_API_KEY;
    if (!openServKey) {
      console.error('CRITICAL ERROR: OPENSERV_API_KEY is not set.');
      return; 
    }
    const headers = { 'x-openserv-key': openServKey };

    try {
      // Run our private fetch function
      const results = await this.runFetchAndFormat(action);
      
      // Get the required outputOptionId from the task data
      const outputOptionId = Object.keys(action.task.outputOptions)[0];

      // Format the output as an object, as the API requires
      const formattedOutput = {
        type: 'structured', // Added the 'type' field
        signals: results    // 'results' is the array [] or [signal]
      };
      
      // We are forcing the type to 'any' to bypass the SDK's incorrect "grammar"
      // and send the correct data to the API.
      const params: any = {
        workspaceId: action.workspace.id,
        taskId: action.task.id,
        outputOptionId: outputOptionId, // The API needs this
        output: formattedOutput         // The API needs this specific object
      };

      // Manually complete the task using the correct parameters
      await this.completeTask(params);

      console.log('Task completed successfully.');

    } catch (error) {
      // Manually mark the task as "errored"
      const errorUrl = `${OPENSERV_API_URL}/workspaces/${action.workspace.id}/tasks/${action.task.id}/error`;
      await axios.post(errorUrl, {
        error: error instanceof Error ? error.message : 'An unknown error occurred.'
      }, { headers });
    }
  }
}

// 4. Initialize and Start our new Custom Agent
const agent = new CustomMoonwardAgent({
  systemPrompt: 'You are a trading signal agent.',
  apiKey: process.env.OPENSERV_API_KEY,
  port: Number(process.env.PORT) || 7378
});

agent.start();
