const http = require('http');
const VERSION = process.env.APP_VERSION || 'blue-v1';
const server = http.createServer((req, res) => {
  const msg = `${new Date().toISOString()} - ${VERSION} - ${req.method} ${req.url}`;
  console.log(msg);
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.end(JSON.stringify({version: VERSION, path: req.url}));
});
server.listen(process.env.PORT || 8080);
