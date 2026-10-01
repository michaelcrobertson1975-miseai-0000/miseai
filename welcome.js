import {currentUser,googleSignIn,api,signOut} from './auth.js';
const el=id=>document.getElementById(id);
let connection=null,busy=false;
el('google').onclick=async()=>{el('google').disabled=true;try{await googleSignIn();}catch{el('status').textContent="We couldn't open Google sign-in. Please try again.";el('google').disabled=false;}};
el('switch').onclick=()=>signOut().catch(()=>el('status').textContent="We couldn't sign out. Please try again.");
el('copyAccess').onclick=async()=>{if(!connection)return;try{await navigator.clipboard.writeText(connection.apiToken);el('copyStatus').textContent='Copied. Keep this token private.';}catch{el('copyStatus').textContent="Your browser couldn't copy the token. Allow clipboard access and try again.";}};
async function check(){
 if(busy)return;busy=true;connection=null;
 for(const id of ['google','refresh','complete','dashboard','manual','welcome','switch'])el(id).hidden=true;
 el('account').textContent='';el('copyStatus').textContent='';el('status').textContent='Checking your restaurant connection…';
 try{
  const user=await currentUser();
  if(!user){el('title').textContent='Welcome back.';el('intro').textContent='Sign in to open your restaurant workspace.';el('status').textContent="Use the Google account you gave Michael. This opens your existing setup; it doesn't submit another application.";el('google').hidden=false;return;}
  el('account').textContent='Signed in as '+user.email;el('switch').hidden=false;
  const data=await api('onboarding-access');
  if(data.status==='approved'){
   if(!data.restaurant_id||!data.api_token||!data.restaurant_name)throw Error('Incomplete access');
   const base='https://qhfmywontdwwfapowqpo.supabase.co/functions/v1';
   const response=await fetch(base+'/dashboard-wire?restaurant_id='+encodeURIComponent(data.restaurant_id),{headers:{Authorization:'Bearer '+data.api_token},signal:AbortSignal.timeout(20000)});
   const verified=await response.json();if(!response.ok||!verified.success||verified.restaurant?.id!==data.restaurant_id)throw Error('Connection verification failed');
   connection={restaurantId:data.restaurant_id,restaurantName:data.restaurant_name,apiToken:data.api_token,functionsBase:base,viewerRole:data.role};
   sessionStorage.setItem('mise_dashboard_connection',JSON.stringify(connection));
   el('title').textContent='Welcome back, '+data.restaurant_name+'.';el('intro').textContent="Your workspace is ready. Let's take this one step at a time.";el('status').textContent='Your application is already approved, and your restaurant is connected. You do not need to apply again.';
   el('restaurantId').textContent='Restaurant ID: '+data.restaurant_id;
   for(const id of ['dashboard','manual','welcome'])el(id).hidden=false;
  }else if(data.status==='not_applied'){
   sessionStorage.removeItem('mise_dashboard_connection');el('title').textContent="Let's find your restaurant.";el('intro').textContent="This Google account doesn't have an application connected to it yet.";el('status').textContent='Already spoke with Michael or received approval? Check the account shown above, or reply to your welcome email. You do not need to submit another request for an approved restaurant.';el('complete').hidden=false;
  }else if(data.status==='declined'){
   sessionStorage.removeItem('mise_dashboard_connection');el('title').textContent='Your request has been reviewed.';el('intro').textContent='Please contact Michael about the next step.';el('status').textContent='This account does not currently have approved restaurant access.';
  }else{
   sessionStorage.removeItem('mise_dashboard_connection');el('title').textContent="Thank you. We'll take it from here.";el('intro').textContent='Your restaurant request is with Michael.';el('status').textContent="There's no need to submit it again. While you wait, you can look through the starter kit.";el('refresh').textContent='Check for an update';el('refresh').hidden=false;
  }
 }catch{
  sessionStorage.removeItem('mise_dashboard_connection');el('title').textContent="Let's get you connected.";el('intro').textContent="We couldn't confirm your restaurant connection yet.";el('status').textContent='Try again, or reply to your welcome email so Michael can help. Please do not submit a new application.';el('refresh').textContent='Try again';el('refresh').hidden=false;
 }finally{busy=false;}
}
el('refresh').onclick=check;await check();
