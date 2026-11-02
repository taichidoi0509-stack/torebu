import {build} from 'esbuild';
import {createHash} from 'node:crypto';
import {rm,mkdir,cp,writeFile,readFile} from 'node:fs/promises';
await rm('docs',{recursive:true,force:true});await mkdir('docs',{recursive:true});await cp('public','docs',{recursive:true});
const result=await build({entryPoints:['client/auth.js'],outfile:'auth-client.js',write:false,bundle:true,minify:true,format:'esm',target:'es2022',legalComments:'none',external:['./app.js?v=7']});
const code=result.outputFiles[0].contents,hash=createHash('sha256').update(code).digest('hex').slice(0,10),filename='auth-client-'+hash+'.js';
await writeFile('docs/'+filename,code);
// Keep old HTML usable during browser/CDN cache transitions.
await writeFile('docs/auth-client.js',code);
const html=(await readFile('public/index.html','utf8')).replace('auth-client.js?v=7',filename);await writeFile('docs/index.html',html);
const sw=(await readFile('public/sw.js','utf8')).replace('auth-client.js?v=7',filename).replace('torebu-github-v7','torebu-github-'+hash);await writeFile('docs/sw.js',sw);
await writeFile('docs/.nojekyll','');
