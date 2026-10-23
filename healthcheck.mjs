import https from 'node:https';
import http from 'node:http';
import {readFileSync} from 'node:fs';
import {X509Certificate} from 'node:crypto';
// Connect to loopback while validating the real DNS SAN and the mounted leaf.
// The CA trust store is not bypassed: this probe explicitly trusts only this cert.
const cert=process.env.TLS_CERT?readFileSync(process.env.TLS_CERT):undefined;
const dns=cert?new X509Certificate(cert).subjectAltName?.match(/DNS:([^,]+)/)?.[1]:undefined;
const request=(cert?https:http).get({hostname:'127.0.0.1',port:Number(process.env.PULSE_PORT||(cert?8443:4173)),path:'/healthz',...(cert?{servername:dns||'localhost',ca:cert,allowPartialTrustChain:true}:{}),timeout:3000},response=>{response.resume();process.exitCode=response.statusCode===200?0:1;});
request.on('timeout',()=>request.destroy(new Error('timeout')));
request.on('error',()=>{process.exitCode=1;});
