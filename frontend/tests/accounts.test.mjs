import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
const config = "const DEFAULT_CONFIG={apiBaseUrl:'https://offline.invalid',cognito:{region:'ap-southeast-2',clientId:'local-client'}};";
async function moduleFrom(path) {
  const source=(await readFile(new URL(path,import.meta.url),'utf8')).replace("import { DEFAULT_CONFIG } from '../config';",config);
  return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
}
globalThis.localStorage={getItem:()=>null};
const {api}=await moduleFrom('../src/services/api.js');
const {cognitoService}=await moduleFrom('../src/services/cognito.js');
test('API: public browsing; booking/tickets authenticated; lost-found student only',async()=>{
 const calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({})}};
 const visitor={id:'sub',token:'fake-token',role:'visitor',isStudent:false};
 for (const request of [()=>api.bookEvent('event',null),()=>api.getMyBookings(null),()=>api.getItems(visitor),()=>api.reportItem({},visitor)]) await assert.rejects(request);
 assert.equal(calls.length,0);
 await api.getEvents();assert.equal(calls[0].options,undefined);
 await api.bookEvent('event',visitor);assert.equal(calls[1].options.headers.Authorization,visitor.token);
 assert.deepEqual(JSON.parse(calls[1].options.body),{eventId:'event'});
 await api.getMyBookings(visitor);
 const student={...visitor,role:'student',isStudent:true};await api.getItems(student);await api.reportItem({},student);
 assert.equal(calls.length,5);
});
test('Cognito: account type request cannot self-grant student access',async()=>{
 let claims={sub:'sub-123',email:'person@example.com',name:'Jöhn 🎓',profile:'student-requested'};
 const token=()=> 'header.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.signature';
 globalThis.fetch=async()=>({ok:true,json:async()=>({AuthenticationResult:{IdToken:token()}})});
 let user=await cognitoService.signIn('person@example.com','unused');assert.equal(user.role,'visitor');assert.equal(user.isStudent,false);assert.equal(user.id,'sub-123');assert.equal(user.name,'Jöhn 🎓');
 claims['cognito:groups']=['students'];user=await cognitoService.signIn('person@example.com','unused');assert.equal(user.role,'student');assert.equal(user.isStudent,true);
 claims['cognito:groups']=['admins'];user=await cognitoService.signIn('person@example.com','unused');assert.equal(user.role,'admin');assert.equal(user.isStudent,false);
});
test('Signup records request using standard profile attribute',async()=>{
 let payload;globalThis.fetch=async(_,options)=>{payload=JSON.parse(options.body);return {ok:true,json:async()=>({})}};
 await cognitoService.signUp('person@example.com','unused','Person','student');
 assert.deepEqual(payload.UserAttributes.find(a=>a.Name==='profile'),{Name:'profile',Value:'student-requested'});
});

test('Sign-in account options validate membership and retain admin access',async()=>{
 let groups=['visitors'];
 globalThis.fetch=async()=>({ok:true,json:async()=>({AuthenticationResult:{IdToken:'header.'+Buffer.from(JSON.stringify({sub:'account',email:'person@example.com','cognito:groups':groups,profile:'student-requested'})).toString('base64url')+'.signature'}})});
 assert.equal((await cognitoService.signIn('person@example.com','unused','visitor')).role,'visitor');
 await assert.rejects(()=>cognitoService.signIn('person@example.com','unused','student'),/not been approved/);
 groups=['students'];
 assert.equal((await cognitoService.signIn('person@example.com','unused','student')).role,'student');
 await assert.rejects(()=>cognitoService.signIn('person@example.com','unused','visitor'),/Choose Student/);
 groups=['admins'];
 assert.equal((await cognitoService.signIn('person@example.com','unused','student')).role,'admin');
});
