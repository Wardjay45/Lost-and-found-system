import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
function view(file,{badge={messages:[],unreadCount:0,loading:false,connected:true},save=true}={}){
 const states=[],alerts=[],navigations=[],saved=[];let cursor=0;
 const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return[states[i],value=>{states[i]=value;}];},useEffect(){}};
 const code=require('@babel/core').transformSync(readFileSync(new URL('../src/'+file,import.meta.url),'utf8'),{babelrc:false,configFile:false,plugins:[require.resolve('@babel/plugin-transform-react-jsx'),require.resolve('@babel/plugin-transform-modules-commonjs')]}).code;
 const ctx=vm.createContext({exports:{},URL,require(name){
  if(name==='react')return react;
  if(name==='react-native')return{...Object.fromEntries(['View','Text','ScrollView','SafeAreaView','Modal','ActivityIndicator'].map(name=>[name,name])),StyleSheet:{create:value=>value},Alert:{alert:(...args)=>alerts.push(args)}};
  if(name.includes('SpeechControls'))return{TextInput:'TextInput',TouchableOpacity:'TouchableOpacity',Switch:'Switch'};
  if(name.includes('AccessibilityContext'))return{useThemedStyles:value=>value,useAccessibility:()=>({speak(){},scaledFontSize:size=>size*1.5,accessibilityStyles:{},themeColors:{accent:'#ff0'}})};
  if(name.includes('AuthContext'))return{useAuth:()=>({user:{id:1},logout(){}})};
  if(name.includes('MessageBadgeContext'))return{useMessageBadge:()=>badge};
  if(name.includes('FormIcon'))return{default:'FormIcon',__esModule:true};
  if(name.includes('VoiceAssistant'))return{default:'VoiceAssistant',__esModule:true};
  if(name.includes('config/api'))return{getConfiguredServerUrl:async()=>'',saveServerUrl:async value=>{saved.push(value);return save;},resetServerUrl:async()=>save};
  throw Error('Unexpected import '+name);
 }});vm.runInContext(code,ctx);
 return{alerts,navigations,saved,render(props={}){cursor=0;return ctx.exports.default({navigation:{navigate:(...args)=>navigations.push(args)},...props});}};
}
test('ownership and pickup guide opens safely with or without an item and routes to office messaging without approving a claim',()=>{
 for(const item of [undefined,{itemId:'FOUND-123',description:'Blue bag',location:'Library'}]){
  const screen=view('components/OfficeRecoveryGuide.js');const tree=screen.render({route:{params:{item}}});
  assert.match(JSON.stringify(tree),/administrator will review your claim/);
  assert.doesNotMatch(JSON.stringify(tree),/Verification passed|Handover QR Code|claimed successfully/);
  nodes(tree).find(node=>node.type==='TouchableOpacity'&&JSON.stringify(node.props.children).includes('Message the office')).props.onPress();
  assert.equal(screen.navigations[0][0],'Main');assert.equal(screen.navigations[0][1].screen,'Messages');
 }
});
test('updates show real incoming office replies and distinguish offline from empty',()=>{
 const screen=view('screens/NotificationsScreen.js',{badge:{messages:[{id:1,sender:'user',text:'Outgoing only'},{id:2,sender:'admin',text:'Your report is ready'}],unreadCount:1,connected:true,loading:false}});
 const tree=screen.render();assert.match(JSON.stringify(tree),/Your report is ready/);assert.doesNotMatch(JSON.stringify(tree),/Outgoing only/);
 nodes(tree).find(node=>node.props.accessibilityLabel==='Open office reply: Your report is ready').props.onPress();assert.equal(screen.navigations[0][1].screen,'Messages');
 const offline=view('screens/NotificationsScreen.js',{badge:{messages:[],unreadCount:0,connected:false,loading:false}}).render();assert.match(JSON.stringify(offline),/Unable to sync/);assert.doesNotMatch(JSON.stringify(offline),/No office replies yet/);
});
test('settings rejects malformed URLs and never reports failed persistence as saved',async()=>{
 for(const address of ['http-not-a-url','ftp://campus.test','https://campus.test/api']){
  const screen=view('screens/SettingsScreen.js',{save:false});let tree=screen.render();nodes(tree).find(node=>node.type==='TextInput').props.onChangeText(address);tree=screen.render();
  await nodes(tree).find(node=>node.type==='TouchableOpacity'&&node.props.children.some(child=>child?.type==='Text'&&child.props.children.includes('Save'))).props.onPress();
  assert.notEqual(screen.alerts.at(-1)[0],'Saved');assert.equal(screen.saved.length,address.startsWith('https://')?1:0);
  assert.equal(nodes(tree).some(node=>node.props.accessibilityLabel==='Push notifications'),false);
 }
});
