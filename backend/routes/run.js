const router = require("express").Router();
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const TEMP_DIR = path.join(__dirname, "../temp_run");

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

router.post("/", async (req, res) => {
  const { code, language } = req.body;

  if (!code) {
    return res.status(400).json({ success: false, error: "No code provided to execute." });
  }

  let extension = "";
  let command = "";

  if (language === "javascript" || language === "js") {
    extension = "js";
    command = "node";
  } else if (language === "python" || language === "py") {
    extension = "py";
    // Try 'python' but fallback to 'py' if needed on Windows
    command = "python";
  } else {
    return res.status(400).json({ success: false, error: `Language '${language}' is not supported for execution.` });
  }

  const filename = `run_${Date.now()}_${Math.floor(Math.random() * 1000)}.${extension}`;
  const filePath = path.join(TEMP_DIR, filename);

  try {
    // Write code to temp file
    fs.writeFileSync(filePath, code);

    // Execute the code with a timeout of 5 seconds
    const child = exec(`${command} "${filePath}"`, { timeout: 5000 }, (error, stdout, stderr) => {
      // Clean up the temp file asynchronously
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) console.error("Temp file cleanup error:", unlinkErr);
      });

      if (error) {
        // Check if timed out
        if (error.killed) {
          return res.json({
            success: false,
            output: stdout,
            error: "Execution Timed Out (Max 5 seconds exceeded). Make sure there are no infinite loops.",
          });
        }
        return res.json({
          success: false,
          output: stdout,
          error: stderr || error.message,
        });
      }

      res.json({
        success: true,
        output: stdout,
        error: stderr || "",
      });
    });

  } catch (err) {
    console.error("Code execution routing error:", err);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (_) {}
    }
    res.status(500).json({ success: false, error: "Internal server error during execution setup." });
  }
});

module.exports = router;
