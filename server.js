const express = require("express");
const { exec } = require("child_process");
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/strategy/:username", (req, res) => {
  const username = req.params.username;
  exec(`python3 strategy.py ${username}`, (err, stdout, stderr) => {
    if (err) return res.status(500).send(stderr);
    res.send(stdout);
  });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
