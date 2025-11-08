import { Agent } from '@openserv-labs/sdk';
import { z } from 'zod';
import axios from 'axios';
import 'dotenv/config';

// 1. Initialize the Agent
const agent = new Agent({
  systemPrompt: 'You are a trading signal agent. Your job is to fetch signals from the Moonward API and format them.',
  apiKey: process.env.OPENSERV_API_KEY,
  port: Number(process.env.PORT) || 7378
});

// 2. Define the Moonward API URL
const MOONWARD_API_URL = 'https://api.moonward.net/api/v1/signals';

// 3. Add the single "Capability" (Tool)
agent.addCapability({
  name: 'fetchAndFormatSignals',
  description: 'Fetches active trading signals from the Moonward API and adds a fixed position_size (1000) and leverage (10) to each signal.',
  // This tool takes no input, so the schema is empty
  schema: z.object({}), 
  
  async run({ action }) {
    const apiKey = process.env.MOONWARD_API_KEY;
    if (!apiKey) {
      console.error('MOONWARD_API_KEY is not set.');
      throw new Error('Agent is not configured with Moonward API key.');
    }

    try {
      // A. Make the API call to Moonward
      console.log('Fetching active signals from Moonward...');
      const response = await axios.get(MOONWARD_API_URL, {
        headers: { 'x-api-key': apiKey },
        params: { 'include_expired': false } // Get active signals only
      });

      const signals = response.data.data || [];

      if (signals.length === 0) {
        console.log('No active signals found.');
        return []; // Return an empty array if no signals
      }
      
      console.log(`Fetched ${signals.length} active signal(s).`);

      // B. This is your custom logic:
      // Loop through each signal and add your fixed parameters
      const formattedSignals = signals.map(signal => {
        // Add your custom fields to the signal object
        return {
          ...signal, // Keep all original signal data
          position_size: 1000,
          leverage: 10
        };
      });

      // C. Return the new, modified array
      return formattedSignals;

    } catch (error) {
      console.error('Error fetching signals from Moonward:', error);
      // Safely report the error back to OpenServ
      if (axios.isAxiosError(error) && error.response) {
        console.error('Error details:', error.response.data);
        throw new Error(`Moonward API Error: ${error.response.status} - ${error.response.data.message || error.response.statusText}`);
      }
      throw new Error('An unexpected error occurred while fetching signals.');
    }
  }
});

// 4. Start the Server
agent.start();
