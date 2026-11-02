import {build} from 'esbuild';
import {rm,mkdir,cp,writeFile} from 'node:fs/promises';
await rm('docs',{recursive:true,force:true});await mkdir('docs',{recursive:true});await cp('public','docs',{recursive:true});
await build({entryPoints:['client/auth.js'],outfile:'docs/auth-client.js',bundle:true,minify:true,format:'esm',target:'es2022',legalComments:'none',external:['./app.js?v=7']});
await writeFile('docs/.nojekyll','');
