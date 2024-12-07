import { spawn } from "child_process";
import express, { Request, Response } from "express";
import "dotenv/config";
import { executeCommandInShell, registerBot, saveToken } from "./utils";
import { Execution, ExpectedOutput, Exploit, Message, Service } from "./types";
import { sendToGpt, systemPrompt } from "./ai";
import { Mutex } from "async-mutex";
import http from "./http";
import fs from "fs/promises";
import path from "path";

const logFilePath = path.resolve(__dirname, "process_check.log");

const logToFile = async (message: string) => {
    try {
      const timestamp = new Date().toISOString();
      await fs.appendFile(logFilePath, `[${timestamp}] ${message}\n`, "utf-8");
    } catch (error) {
      console.error("Failed to write to log file:", error);
    }
  };

const app = express();
export const busyMutex = new Mutex();

let busy = false 

app.use(express.json());

registerBot();

app.post("/scan", async (req: Request, res: Response) => {
    if (busy) {
        res.status(429).send({ message: "System is busy. Please try again later." });
    }
    const { exploit: exploit, service: service, token: token }: { exploit: Exploit; service: Service, token: string } = req.body;
    console.log(`Scanning service ${service.domain} with exploit ${exploit.title}`);  
    console.log(token)  
    await saveToken(token)
    proccessCheck({exploit, service})
    res.status(200).send({ message: "Scanning started!" });
});

const proccessCheck = async ({ exploit, service }: { exploit: Exploit; service: Service }) => {
    const release = await busyMutex.acquire();
    const sysPrompt = systemPrompt({ exploit, service });
    const messages: Message[] = [];
    let sent = false 
    messages.push({ role: "system", content: sysPrompt });
    try {
      while (true) {
        try {
          const response = await sendToGpt(messages);
          messages.push({role:'assistant', content: response})
          console.log("GPT Response:", response);
          await logToFile(`GPT Response: ${response}`);
  
          let data: ExpectedOutput | null = null;
  
          try {
            let parsedResponse;
          
            // Try parsing the initial response
            try {
              parsedResponse = JSON.parse(response);
            } catch (error) {
              if (response) {
                console.log("Initial parsing failed. Attempting to preprocess response...");
                const trimmedResponse = response.trim();
                const preprocessedResponse = trimmedResponse.startsWith("```json")
                  ? trimmedResponse.slice(7, -3).trim()
                  : trimmedResponse;
          
                try {
                  parsedResponse = JSON.parse(preprocessedResponse);
                  console.log("Successfully parsed preprocessed response.");
                } catch (preprocessError: any) {
                  console.error("Failed to parse preprocessed response:", preprocessError);
                  const errorMessage = `Error parsing JSON: ${preprocessError.message}`;
                  await logToFile(errorMessage);
                  messages.push({ role: "user", content: errorMessage });
                  continue;
                }
              } else {
                const nullDataMessage = "Response is null or empty.";
                console.error(nullDataMessage);
                await logToFile(nullDataMessage);
                messages.push({ role: "user", content: nullDataMessage });
                continue;
              }
            }
          
            // Process parsed response
            if (parsedResponse && typeof parsedResponse === "object") {
              data = Array.isArray(parsedResponse) ? parsedResponse[0] : parsedResponse;
            }
        
          } catch (error: any) {
            const genericErrorMessage = `Unexpected error while handling response: ${error.message}`;
            console.error(genericErrorMessage);
            await logToFile(genericErrorMessage);
            messages.push({ role: "user", content: genericErrorMessage });
          }

          if (!data) {
            const invalidDataMessage = "Parsed response is null or invalid after preprocessing.";
            console.error(invalidDataMessage);
            await logToFile(invalidDataMessage);
            messages.push({ role: "user", content: invalidDataMessage });
            continue;
          }
          
  
          if (!data.runCommand || typeof data.runCommand !== "string") {
            const invalidCommandMessage = `Invalid runCommand in GPT response: ${JSON.stringify(data)}`;
            console.error(invalidCommandMessage);
            await logToFile(invalidCommandMessage);
  
            messages.push({ role: "user", content: `Invalid runCommand: ${data.runCommand}` });
            continue;
          }
  
          try {
            const result: any = await executeCommandInShell(data.runCommand);
            const commandResultMessage = `Command Execution Result: ${JSON.stringify(result)}`;
            console.log(commandResultMessage);
            await logToFile(commandResultMessage);
  
            try {
              const resp = await http.post("/bot/execution", {
                command: data.runCommand,
                output: result.stdout || result.stderr || "nothing",
                date: Date.now(),
              });
              console.log(resp.data)
            } catch (err: any) {
              let verdictError = `Error sending verdict to main server: ${err.message}`;
  
                // Check if the error contains a response object
                if (err.response) {
                  const { status, data } = err.response;
                  verdictError += ` | Status Code: ${status}`;
                  verdictError += ` | Response Body: ${JSON.stringify(data)}`;
                }
                
                console.error(verdictError);
                await logToFile(verdictError);
            }
  
            messages.push({ role: "user", content: `${commandResultMessage}` });
  
            if (data.end || data.verdict) {
              const completionMessage = `GPT indicates the process is complete. Verdict: ${data.verdict}`;
              console.log(completionMessage);
              await logToFile(completionMessage);
  
              try {
                const response = await http.post("/bot/verdict", { verdict: data.verdict, service, exploit });
                console.log(response.data)
                sent = true 
              } catch (err: any) {
                let verdictError = `Error sending verdict to main server: ${err.message}`;
  
                // Check if the error contains a response object
                if (err.response) {
                  const { status, data } = err.response;
                  verdictError += ` | Status Code: ${status}`;
                  verdictError += ` | Response Body: ${JSON.stringify(data)}`;
                }
                
                console.error(verdictError);
                await logToFile(verdictError);
              }
              break;
            }
          } catch (commandError) {
            const commandExecutionError = `Error executing command: ${commandError}`;
            console.error(commandExecutionError);
            await logToFile(commandExecutionError);
  
            messages.push({
              role: "user",
              content: `Command execution failed: ${commandError}`,
            });
            continue;
          }
        } catch (err) {
          const processingError = `Error in GPT processing loop: ${err}`;
          console.error(processingError);
          await logToFile(processingError);
  
          try {
            await http.post("/bot/error", { err });
          } catch (err) {
            const errorReportError = `Error reporting error to main server: ${err}`;
            console.error(errorReportError);
            await logToFile(errorReportError);
          }
          break;
        }
      }
    } finally {
      busy = false;
      release();
      await logToFile("Process check completed.");
    }

    if (!sent){
      try {
        await http.post("/bot/verdict", { verdict: "potential vulnerability", service, exploit });
      } catch (err: any) {
        let verdictError = `Error sending verdict to main server: ${err.message}`;
  
                // Check if the error contains a response object
                if (err.response) {
                  const { status, data } = err.response;
                  verdictError += ` | Status Code: ${status}`;
                  verdictError += ` | Response Body: ${JSON.stringify(data)}`;
                }
                
                console.error(verdictError);
                await logToFile(verdictError);
      }
    }
  };


const PORT = 5001;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
