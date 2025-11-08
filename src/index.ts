import { Agent, doTaskActionSchema } from '@openserv-labs/sdk';
import { z } from 'zod';
import axios from 'axios';
import 'dotenv/config';

// Define the Moonward API URL
const MOONWARD_API_URL = 'https://api.moonward.net/api/v1/signals';

// 1. We create a new "Custom Agent" class
class CustomMoonwardAgent extends Agent {

  // 2. This is our main function, now private to this class
  private async runFetchAndFormat(action: z.infer<typeof doTaskActionSchema>) {
    const apiKey = process.env.MOONWARD_API_KEY;
    if (!apiKey) {
      throw new Error('Agent is not configured with Moonward API key.');
    }

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
  // We are forcing the SDK to run our code.
  protected async doTask(action: z.infer<typeof doTaskActionSchema>) {
    if (!action.task) return;

    console.log(`Received task: ${action.task.description}`);
    
    // We check if this is the task we care about
    // (We'll just assume any task given to this agent is the fetch task)
    
    try {
      // Run our private fetch function
      const results = await this.runFetchAndFormat(action);
      
      // Manually mark the task as "done" and send the results
      await this.markTaskAsCompleted({
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
