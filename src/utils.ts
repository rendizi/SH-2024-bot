import { spawn } from "child_process";
import http from "./http";
import axios from "axios";
import fs from "fs/promises";
import path from "path";

const TOKEN_FILE = path.resolve(__dirname, "bot_token.json");

const shell = spawn("bash");

shell.stdout.on("data", (data) => {
    console.log(`STDOUT: ${data}`);
  });
  
  shell.stderr.on("data", (data) => {
    console.error(`STDERR: ${data}`);
  });
  
  shell.on("close", (code) => {
    console.log(`Shell exited with code ${code}`);
  });

export const registerBot = async () => {
  try {
    const existingToken = await getSavedToken();
    if (existingToken) {
      console.log("Token already exists, using saved token.");
    }
    const ipResponse = await axios.get("https://icanhazip.com");
    const publicIp = ipResponse.data.trim();

    const secretKey = process.env.SECRET_KEY;

    await http.post("/bot/register", { ip: publicIp, secretKey });
  } catch (error) {
    console.error("Error registering bot:", error);
  }
};

export const executeCommandInShell = (command: string) => {
    return new Promise((resolve, reject) => {
      shell.stdin.write(`${command}\n`); 
  
      let output = "";
      shell.stdout.once("data", (data) => {
        output += data.toString();
        resolve(output);
      });
  
      shell.stderr.once("data", (err) => {
        reject(err.toString());
      });
    });
  };


  export const getSavedToken = async (): Promise<string | null> => {
    try {
      const fileContent = await fs.readFile(TOKEN_FILE, "utf-8");
      const data = JSON.parse(fileContent);
      return data.token || null;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        console.log("Token file does not exist. A new token will be requested.");
      } else {
        console.error("Error reading token file:", error.message);
      }
      return null;
    }
  };
  
export const saveToken = async (token: string): Promise<void> => {
    try {
      const data = { token };
      await fs.writeFile(TOKEN_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (error: any) {
      console.error("Error saving token to file:", error.message);
      throw error;
    }
  };