import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import * as receipts from '../../shared/notifications.mjs';
const require = createRequire(import.meta.url);
function harness({ saved = null } = {}) {
  const state=[], refs=[], deps=[], memo=[], effects=[], cleanups=[];
  let si=0,ri=0,ei=0,mi=0;
  const channels=[],removed=[],writes=[];
  const appState={currentState:'active',addEventListener(_event,fn){appState.change=state=>{appState.currentState=state;fn(state);};return {remove(){}};}};
  let snapshot={conversationId:7,messages:[{id:1,conversation_id:'7',sender:'user'},{id:2,conversation_id:'7',sender:'admin'}]}, fail=false;
  const react={createContext:()=>({Provider:'Provider'}),createElement:(type,props,...children)=>({type,props:{...props,children}}),
    useState(initial){const i=si++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return [state[i],value=>{state[i]=typeof value==='function'?value(state[i]):value;}];},
    useRef(initial){const i=ri++;return refs[i]||=( {current:initial} );},
    useCallback(fn,values){const i=mi++;if(!memo[i]||values.some((v,p)=>memo[i].values[p]!==v))memo[i]={values,fn};return memo[i].fn;},
    useEffect(fn,values){const i=ei++;if(!deps[i]||values.some((v,p)=>deps[i][p]!==v)){deps[i]=values;effects.push(()=>{cleanups[i]?.();cleanups[i]=fn();});}},
  };
  const supabase={channel(name){const channel={name,on(_event,filter,callback){channel.filter=filter;channel.callback=callback;return this;},subscribe(callback){callback('SUBSCRIBED');return this;}};channels.push(channel);return channel;},removeChannel:async channel=>{removed.push(channel.name);}};
  const code=require('@babel/core').transformSync(readFileSync(new URL('../src/context/MessageBadgeContext.js',import.meta.url),'utf8'),{babelrc:false,configFile:false,plugins:[require.resolve('@babel/plugin-transform-react-jsx'),require.resolve('@babel/plugin-transform-modules-commonjs')]}).code;
  const context=vm.createContext({exports:{},console,Set,Promise,setInterval:()=>1,clearInterval(){},require(name){
    if(name==='react')return react;
    if(name==='react-native')return {AppState:appState};
    if(name.includes('async-storage'))return {getItem:async()=>saved,setItem:async(key,value)=>writes.push({key,value})};
    if(name.includes('AuthContext'))return {useAuth:()=>({user:{id:5,name:'Student'}})};
    if(name.includes('config/supabase'))return supabase;
    if(name.includes('messageNotifications'))return {loadMessageConversation:async()=>{if(fail)throw Error('offline');return snapshot;}};
    if(name.includes('shared/notifications'))return receipts;
    throw Error('Unexpected import '+name);
  }});
  vm.runInContext(code,context);
  const component=context.exports.MessageBadgeProvider({children:null}).type;
  let value;
  const render=()=>{si=ri=ei=mi=0;value=component({user:{id:5,name:'Student'},children:null}).props.value;return value;};
  const settle=async()=>{for(let pass=0;pass<6;pass++){render();effects.splice(0).forEach(fn=>fn());await new Promise(resolve=>setImmediate(resolve));}return render();};
  return {settle,channels,removed,writes,appState,setSnapshot:next=>{snapshot=next;},setFailure:next=>{fail=next;},unmount:()=>cleanups.forEach(fn=>fn?.())};
}
test('actual mobile provider counts incoming only, saves read receipts, handles live replies, and cleans subscriptions',async()=>{
 const app=harness();
 let badge=await app.settle();
 assert.equal(badge.unreadCount,1);
 assert.equal(app.channels.filter(channel=>channel.filter.table==='messages').length,1);
 assert.equal(app.channels.find(channel=>channel.filter.table==='messages').filter.filter,'conversation_id=eq.7');
 badge.markSeen(badge.messages);
 badge=await app.settle();
 assert.equal(badge.unreadCount,0);
 assert.equal(app.writes.at(-1).key,'lf-message-read-v2:5');
 assert.deepEqual(JSON.parse(app.writes.at(-1).value),{messages:['2']});
 app.setSnapshot({conversationId:7,messages:[...badge.messages,{id:3,conversation_id:'7',sender:'admin'}]});
 app.channels.find(channel=>channel.filter.table==='messages').callback();
 badge=await app.settle();
 assert.equal(badge.unreadCount,1);
 app.appState.change('background');
 badge.markSeen(badge.messages);
 badge=await app.settle();
 assert.equal(badge.unreadCount,1);
 app.setFailure(true);
 await badge.refresh();
 badge=await app.settle();
 assert.equal(badge.connected,false);
 assert.equal(badge.unreadCount,1);
 app.unmount();
 assert.equal(app.removed.length,app.channels.length);
});
test('mobile read receipts restore after reopening the account',async()=>{
 const app=harness({saved:'{"messages":["2"]}'});
 const badge=await app.settle();
 assert.equal(badge.unreadCount,0);
 app.unmount();
});
