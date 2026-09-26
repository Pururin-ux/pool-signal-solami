import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const directory=dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const port=Number(process.env.PORT||8765);
createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const name=pathname==='/'?'index.html':pathname.slice(1);
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) {res.writeHead(404).end();return;}
  try {
    const body=await readFile(join(directory,name));
    const extension=name.slice(name.lastIndexOf('.'));
    res.writeHead(200,{'content-type':types[extension]||'text/plain; charset=utf-8','cache-control':'no-store','content-security-policy':"default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src wss://ws.solami.dev; img-src 'self'; script-src 'self'; base-uri 'none'; form-action 'none'"}).end(body);
  } catch {res.writeHead(404).end();}
}).listen(port,'127.0.0.1',()=>console.log(`Pool Signal serving at http://127.0.0.1:${port}`));
