import * as fs from "fs";
import * as path from "path";

function walkDir(dir: string, callback: (path: string) => void) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

walkDir("src", (filePath) => {
  if (filePath.endsWith(".tsx") || filePath.endsWith(".ts")) {
    const code = fs.readFileSync(filePath, "utf8");
    if (code.includes("onSnapshot") && !filePath.includes("firebase.ts")) {
       // Super naive check
       let c = code;
       // Remove all lines with "onSnapshot" that ALSO have an error callback pattern nearby
       // Actually let's just print the filenames to manually inspect
       console.log(filePath);
    }
  }
});
