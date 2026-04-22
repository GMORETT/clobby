#!/usr/bin/env node
import { Command } from "commander";
import { loginCommand } from "./commands/login.js";

const program = new Command();

program
  .name("clobby")
  .description("Connect your agentic coding tools to the Clobby lobby.")
  .version("0.0.1");

program
  .command("login")
  .description("Authenticate this machine with your Clobby account")
  .action(async () => {
    try {
      await loginCommand();
    } catch (err) {
      console.error(`\nError: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program.parse();
