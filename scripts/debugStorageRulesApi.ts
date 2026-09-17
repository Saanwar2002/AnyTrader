import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import * as fs from "fs";
import * as path from "path";

async function testApi() {
  const storageRules = fs.readFileSync(path.resolve(process.cwd(), "storage.rules"), "utf-8");
  console.log("Initializing testEnv with storage.rules...");
  try {
    const testEnv = await initializeTestEnvironment({
      projectId: "demo-anytrader",
      storage: {
        rules: storageRules,
        host: "127.0.0.1",
        port: 9199,
      },
    });
    console.log("SUCCESS loading storage ruleset!");
    await testEnv.cleanup();
  } catch (err: any) {
    console.error("ERROR loading storage ruleset:", err);
  }
}

testApi();
