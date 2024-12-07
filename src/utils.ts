import { spawn } from "child_process";
import http, { setToken } from "./http";
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
      setToken(existingToken)
      console.log("Token already exists, using saved token.");
      return 
    }
    // const ipResponse = await axios.get("https://icanhazip.com");
    // const publicIp = ipResponse.data.trim();
    const publicIp = "127.0.0.1"

    const secretKey = process.env.SECRET_KEY;

    await http.post("/bot/register", { ip: publicIp, secretKey });
  } catch (error) {
    console.error("Error registering bot:", error);
  }
};

export const executeCommandInShell = (command: string) => {
  return new Promise((resolve, reject) => {
    const shell = spawn("sh", ["-c", command]);

    let output = "";
    let error = "";

    shell.stdout.on("data", (data) => {
      output += data.toString();
    });

    shell.stderr.on("data", (err) => {
      error += err.toString();
    });

    shell.on("close", (code) => {
      if (code === 0) {
        resolve(output.trim());
      } else {
        reject(`Command failed with exit code ${code}: ${error.trim()}`);
      }
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
      console.log("Token file does not exist.");
      return null;
    }
    throw error;
  }
  return null 
};
  
export const saveToken = async (token: string): Promise<void> => {
  try {
    const data = { token };
    await fs.writeFile(TOKEN_FILE, JSON.stringify(data, null, 2), "utf-8");
    console.log("Token saved successfully.");
  } catch (error: any) {
    console.error("Error saving token:", error.message);
    throw error;
  }
};