import fs from 'node:fs';
import { createServer } from 'node:http';

const hostname = '127.0.0.1';
const port = 3000;

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*'); // TODO: 本番環境では変更する
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
}

const postPaths = ['/timetable_data.json', '/railway_lines.json', '/stations.json'];
const getPaths = ['/timetable_data.json', '/railway_lines.json', '/stations.json'];

const server = createServer((req, res) => {
  req.on('error', (err) => {
    console.error(err);
    res.statusCode = 400;
    res.end('400: Bad Request');
  });

  if (req.method === 'OPTIONS') {
    // CORSのためのpreflightリクエストのとき
    res.statusCode = 200;
    setCorsHeaders(res);

    res.end();
    return;
  }

  if (req.method === 'GET' && getPaths.includes(req.url)) {
    console.log('GET');
    console.log({ url: req.url });

    const index = getPaths.indexOf(req.url);
    const data = fs.readFileSync('data' + getPaths[index], 'utf-8');

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    setCorsHeaders(res);
    res.end(data);
    return;
  }

  // fooへのpostのとき
  if (req.method === 'POST' && req.headers['content-type'] === 'application/json' && postPaths.includes(req.url)) {
    // JSONデータを受け取る
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      // JSONをパースする
      const data = JSON.parse(body);

      // ファイルに書き込む
      const index = postPaths.indexOf(req.url);
      fs.writeFileSync('data' + postPaths[index], JSON.stringify(data));

      res.statusCode = 200;
      setCorsHeaders(res);

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'ok' }));
    });
    return;
  }

  // それ以外のとき
  res.statusCode = 404;
  res.end('404: Not Found');
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
