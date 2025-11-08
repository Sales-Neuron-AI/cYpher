import { Agent } from '@openserv-labs/sdk';
import { z } from 'zod';
import axios from 'axios';
import 'dotenv/config';

// Define the Moonward API URL
const MOONWARD_API_URL = 'https://api.moonward.net/api/v1/signals';

// 1. We create a new "Custom Agent" class
class CustomMoonwardAgent extends Agent {

  // 2. This is our main function, now private to this class
  private async runFetchAndFormat(action: any) { 
    const apiKey = process.env.MOONWARD_API_KEY;

    // --- NEW DEBUGGING LOGS ---
    // This will tell us exactly what the agent sees.
    if (!apiKey) {
      console.error('CRITICAL ERROR: The MOONWARD_API_KEY variable was not found in process.env. It is undefined or null.');
      throw new Error('Agent is not configured with Moonward API key.');
    }
    
    console.log(`Found API key in environment. Key length: ${apiKey.length}`);
    console.log(`Key starts with: '${apiKey.substring(0, 5)}...'`);
    console.log(`Key ends with: '...${apiKey.substring(apiKey.length - 5)}'`);
    // --- END DEBUGGING LOGS ---

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

  // 3. This is the "override" that fixes our problem.
  protected async doTask(action: any) {
    if (!action.task) return;

    // This is OUR log message, so we'll know it's working
    console.log(`Received task: ${action.task.description}`);
    
    try {
      // Run our private fetch function
      const results = await this.runFetchAndFormat(action);
      
      // Manually mark the task as "done" and send the results
      await this.completeTask({
        workspaceId: action.workspace.id,
        taskId: action.task.id,
        output: results
      });

      console.log('Task completed successfully.');

    } catch (error) {
      // Manually mark the task as "errored"
      await this.markTaskAsErrored({
        workspaceId: action.workspace.id,
        taskId: action.task.id,
        error: error instanceof Error ? error.message : 'An unknown error occurred.'
      });
      console.error('Task failed:', error);
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
