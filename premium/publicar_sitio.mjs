// Publica el sitio de Remotion con las plantillas de Cherry: node publicar_sitio.mjs <nombre-del-sitio>
import {deploySite, getOrCreateBucket} from '@remotion/lambda';
import path from 'node:path';
const nombre = process.argv[2];
if (!nombre) throw new Error('falta el nombre del sitio');
const {bucketName} = await getOrCreateBucket({region: 'us-east-1'});
const r = await deploySite({entryPoint: path.resolve('src/index.ts'), bucketName, region: 'us-east-1', siteName: nombre});
console.log(JSON.stringify({bucketName, serveUrl: r.serveUrl, siteName: r.siteName, stats: r.stats}));
