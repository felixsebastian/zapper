#!/usr/bin/env node

console.log("Hello, World! 🚀");
console.log("Welcome to Zapper CLI!");

const args = process.argv.slice(2);
if (args.length > 0) {
  console.log(`Arguments provided: ${args.join(", ")}`);
}

// Exit with success code
process.exit(0); 