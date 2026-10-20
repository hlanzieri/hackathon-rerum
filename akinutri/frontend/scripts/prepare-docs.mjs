import {mkdir,copyFile} from 'node:fs/promises';
const source=new URL('../node_modules/swagger-ui-dist/',import.meta.url);
const target=new URL('../public/vendor/',import.meta.url);
await mkdir(target,{recursive:true});
for(const file of ['swagger-ui-bundle.js','swagger-ui.css']){
  await copyFile(new URL(file,source),new URL(file,target));
}
await copyFile(new URL('LICENSE',source),new URL('swagger-ui-LICENSE.txt',target));
