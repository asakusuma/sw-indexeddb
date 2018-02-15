const express = require('express');
const app = express();
const fs = require('fs');
const randomstring = require("randomstring");

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/sw.js', (req, res) => {
  fs.readFile(__dirname + '/sw.js', 'utf8', (err, content) => {
    const replaced = content.replace('%HASH%', randomstring.generate());
    res.set('Content-Type', 'text/javascript');
    res.set('Cache-Control', 'no-cache, no-store, max-life=0');
    res.send(replaced);
  });
});

app.listen(8000, () => console.log('Listening on port 8000'));