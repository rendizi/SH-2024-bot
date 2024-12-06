import { spawn } from "child_process";
import express, { Request, Response } from "express";
import "dotenv/config";
import { executeCommandInShell, registerBot } from "./utils";
import { Execution, ExpectedOutput, Exploit, Message, Service } from "./types";
import { sendToGpt, systemPrompt } from "./ai";
import { Mutex } from "async-mutex";
import http from "./http";

const app = express();
export const busyMutex = new Mutex();

let busy = false 

app.use(express.json());

registerBot();

app.post("/scan", async (req: Request, res: Response) => {
    if (busy) {
        res.status(429).send({ message: "System is busy. Please try again later." });
    }
    const { exploit: exploit, service: service }: { exploit: Exploit; service: Service } = req.body;
    console.log(`Scanning service ${service.domain} with exploit ${exploit.title}`);    
    proccessCheck({exploit, service})
    res.status(200).send({ message: "Scanning started!" });
});

const proccessCheck = async ({ exploit, service }: { exploit: Exploit; service: Service }) => {
    const release = await busyMutex.acquire();
    const sysPrompt = systemPrompt({exploit, service})
    const messages: Message[] = []
    messages.push({role: "system", content: sysPrompt})
    try{
        while (true) {
            try {
                const response = await sendToGpt(messages);
                console.log("GPT Response:", response);
        
                let data: ExpectedOutput | null = null;
        
                try {
                    data = JSON.parse(response) as ExpectedOutput;
                } catch (jsonError: any) {
                    console.error("Failed to parse GPT response as JSON:", jsonError);
                    messages.push({ role: "user", content: `Error parsing JSON: ${jsonError.message}` });
                    continue;
                }
        
                if (!data.runCommand || typeof data.runCommand !== "string") {
                    console.error("Invalid runCommand in GPT response:", data);
                    messages.push({ role: "user", content: `Invalid runCommand: ${data.runCommand}` });
                    continue;
                }
        
                try {
                    const result: any = await executeCommandInShell(data.runCommand);
                    console.log("Command Execution Result:", result);
                    
                    try{
                        await http.post("/bot/execution",{command: data.runCommand, output: result.stdout || result.stderr || "nothing", date: Date.now()})
                    }catch(err){
                        console.error(err)
                        console.error("error sending request to main server")
                    }
        
                    messages.push({ role: "user", content: `STDOUT: ${result.stdout}\nSTDERR: ${result.stderr}` });
        
                    if (data.end) {
                        console.log("GPT indicates the process is complete.");
                        console.log("Process completed. Sending results to the main server...");
                        try{
                            await http.post("/bot/verdict", {"verdict": data.verdict, service, exploit})
                        }catch(err){
                            console.error(err)
                            console.error("error sending request to main server")
                        }
                        break;
                    }
                } catch (commandError) {
                    console.error("Error executing command:", commandError);
                    messages.push({
                    role: "user",
                    content: `Command execution failed: ${commandError}`,
                    });
                    continue;
                }
            } catch (err) {
                console.error("Error in GPT processing loop:", err);
                try{
                    await http.post("/bot/error", {err})
                }catch(err){
                    console.error(err)
                }
                break;
            }
        }
    }finally {
        busy = false; 
        release();
    }
   
}

const PORT = 5001;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
